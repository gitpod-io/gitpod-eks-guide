#!/usr/bin/env bash

set -eo pipefail

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

function variables_from_context() {
    # Create EKS cluster without nodes
    # Generate a new kubeconfig file in the local directory
    KUBECONFIG=".kubeconfig"

    # extract details form the ecktl configuration file
    CLUSTER_NAME=$(yq eval '.metadata.name' "${EKSCTL_CONFIG}")
    AWS_REGION=$(yq eval '.metadata.region' "${EKSCTL_CONFIG}")

    ACCOUNT_ID=$(${AWS_CMD} sts get-caller-identity | jq -r .Account)

    # use the default bucket?
    if [ -z "${CONTAINER_REGISTRY_BUCKET}" ]; then
        CONTAINER_REGISTRY_BUCKET="container-registry-${CLUSTER_NAME}-${ACCOUNT_ID}"
    fi

    CREATE_S3_BUCKET="false"
    if ! "${AWS_CMD}" s3api head-bucket --bucket "${CONTAINER_REGISTRY_BUCKET}" >/dev/null 2>&1; then
        CREATE_S3_BUCKET="true"
    fi

    export KUBECONFIG
    export CLUSTER_NAME
    export AWS_REGION
    export ACCOUNT_ID
    export CREATE_S3_BUCKET
    export CONTAINER_REGISTRY_BUCKET
}

function check_prerequisites() {
    EKSCTL_CONFIG=$1
    if [ ! -f "${EKSCTL_CONFIG}" ]; then
        echo "The eksctl configuration file ${EKSCTL_CONFIG} does not exist."
        exit 1
    else
        echo "Using eksctl configuration file: ${EKSCTL_CONFIG}"
    fi
    export EKSCTL_CONFIG

    if [ -z "${DOMAIN}" ]; then
        echo "Missing DOMAIN environment variable."
        exit 1;
    fi

    AWS_CMD="aws"
    if [ -z "${AWS_PROFILE}" ]; then
        echo "Missing (optional) AWS profile."
        unset AWS_PROFILE
    else
        echo "Using the AWS profile: ${AWS_PROFILE}"
        AWS_CMD="aws --profile ${AWS_PROFILE}"
    fi
    export AWS_CMD

    if [ -z "${ROUTE53_ZONEID}" ]; then
        echo "Missing (optional) ROUTE53_ZONEID environment variable."
        echo "Please configure the CNAME with the URL of the load balancer manually."
    else
        echo "Using external-dns. No manual intervention required."
    fi
}

# Bootstrap AWS CDK - https://docs.aws.amazon.com/cdk/latest/guide/bootstrapping.html
function ensure_aws_cdk() {
    pushd /tmp > /dev/null 2>&1; cdk bootstrap "aws://${ACCOUNT_ID}/${AWS_REGION}"; popd > /dev/null 2>&1
}

function install() {
    check_prerequisites "$1"
    variables_from_context
    ensure_aws_cdk

    if ! eksctl get cluster "${CLUSTER_NAME}" > /dev/null 2>&1; then
        # https://eksctl.io/usage/managing-nodegroups/
        eksctl create cluster --config-file "${EKSCTL_CONFIG}" --without-nodegroup --kubeconfig ${KUBECONFIG}
    else
        aws eks update-kubeconfig --region "${AWS_REGION}" --name "${CLUSTER_NAME}"
    fi

    # Disable default AWS CNI provider.
    # The reason for this change is related to the number of containers we can have in ec2 instances
    # https://github.com/awslabs/amazon-eks-ami/blob/master/files/eni-max-pods.txt
    # https://docs.aws.amazon.com/eks/latest/userguide/pod-networking.html
    kubectl patch ds -n kube-system aws-node -p '{"spec":{"template":{"spec":{"nodeSelector":{"non-calico": "true"}}}}}'
    # Install Calico - https://projectcalico.docs.tigera.io/getting-started/kubernetes/managed-public-cloud/eks
    kubectl apply -f https://docs.projectcalico.org/manifests/calico-vxlan.yaml
    kubectl -n kube-system set env daemonset/calico-node FELIX_AWSSRCDSTCHECK=Disable

    # Create secret with container registry credentials
    if [ -n "${IMAGE_PULL_SECRET_FILE}" ] && [ -f "${IMAGE_PULL_SECRET_FILE}" ]; then
        kubectl create secret generic gitpod-image-pull-secret \
            --from-file=.dockerconfigjson="${IMAGE_PULL_SECRET_FILE}" \
            --type=kubernetes.io/dockerconfigjson  >/dev/null 2>&1 || true
    fi

    if ${AWS_CMD} iam get-role --role-name "${CLUSTER_NAME}-region-${AWS_REGION}-role-eksadmin" > /dev/null 2>&1; then
        KUBECTL_ROLE_ARN=$(${AWS_CMD} iam get-role --role-name "${CLUSTER_NAME}-region-${AWS_REGION}-role-eksadmin" | jq -r .Role.Arn)
    else
        echo "Creating Role for EKS access"
        # Create IAM role and mapping to Kubernetes user and groups.
        POLICY=$(echo -n '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":"arn:aws:iam::'; echo -n "$ACCOUNT_ID"; echo -n ':root"},"Action":"sts:AssumeRole","Condition":{}}]}')
        KUBECTL_ROLE_ARN=$(${AWS_CMD} iam create-role \
            --role-name "${CLUSTER_NAME}-region-${AWS_REGION}-role-eksadmin" \
            --description "Kubernetes role (for AWS IAM Authenticator for Kubernetes)." \
            --assume-role-policy-document "$POLICY" \
            --output text \
            --query 'Role.Arn')
    fi
    export KUBECTL_ROLE_ARN

    # check if the identity mapping already exists
    # Manage IAM users and roles https://eksctl.io/usage/iam-identity-mappings/
    if ! eksctl get iamidentitymapping --cluster "${CLUSTER_NAME}" --arn "${KUBECTL_ROLE_ARN}" > /dev/null 2>&1; then
        echo "Creating mapping from IAM role ${KUBECTL_ROLE_ARN}"
        eksctl create iamidentitymapping \
            --cluster "${CLUSTER_NAME}" \
            --arn "${KUBECTL_ROLE_ARN}" \
            --username eksadmin \
            --group system:masters
    fi

    # Create cluster nodes defined in the configuration file
    eksctl create nodegroup --config-file="${EKSCTL_CONFIG}"

    # Restart tigera-operator
    kubectl delete pod -n tigera-operator -l k8s-app=tigera-operator > /dev/null 2>&1

    MYSQL_GITPOD_USERNAME="gitpod"
    MYSQL_GITPOD_PASSWORD=$(openssl rand -hex 18)
    MYSQL_GITPOD_SECRET="mysql-gitpod-token"
    MYSQL_GITPOD_ENCRYPTION_KEY='[{"name":"general","version":1,"primary":true,"material":"4uGh1q8y2DYryJwrVMHs0kWXJlqvHWWt/KJuNi04edI="}]'
    SECRET_STORAGE="object-storage-gitpod-token"

    # generated password cannot excede 41 characters (RDS limitation)
    SSM_KEY="/gitpod/cluster/${CLUSTER_NAME}/region/${AWS_REGION}"
    ${AWS_CMD} ssm put-parameter \
        --overwrite \
        --name "${SSM_KEY}" \
        --type String \
        --value "${MYSQL_GITPOD_PASSWORD}" \
        --region "${AWS_REGION}" > /dev/null 2>&1

    # deploy CDK stacks
    cdk deploy \
        --context clusterName="${CLUSTER_NAME}" \
        --context region="${AWS_REGION}" \
        --context domain="${DOMAIN}" \
        --context identityoidcissuer="$(${AWS_CMD} eks describe-cluster --name "${CLUSTER_NAME}" --query "cluster.identity.oidc.issuer" --output text --region "${AWS_REGION}")" \
        --context certificatearn="${CERTIFICATE_ARN}" \
        --require-approval never \
        --outputs-file cdk-outputs.json \
        --all

    output_config
}

function output_config() {

  MYSQL_HOST=$(jq -r '. | to_entries[] | select(.key | startswith("ServicesRDS")).value.MysqlEndpoint ' < cdk-outputs.json)
  S3_ACCESS_KEY=$(jq -r '. | to_entries[] | select(.key | startswith("ServicesRegistry")).value.AccessKeyId ' < cdk-outputs.json)
  S3_SECRET_KEY=$(jq -r '. | to_entries[] | select(.key | startswith("ServicesRegistry")).value.SecretAccessKey ' < cdk-outputs.json)

  cat << NEXTSTEPS

==========================
🎉🥳🔥🧡🚀

Your cloud infrastructure is ready to install Gitpod. Please visit
https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod
for your next steps.

Passwords may change on subsequents runs of this guide.

=================
Config Parameters
=================

Domain Name: ${DOMAIN}

Database
========
Host: ${MYSQL_HOST}
Username: ${MYSQL_GITPOD_USERNAME}
Password: ${MYSQL_GITPOD_PASSWORD}
Port: 3306

Container Registry and Object Storage
========
S3 BUCKET NAME: ${CONTAINER_REGISTRY_BUCKET}
S3 ACCESS KEY: ${S3_ACCESS_KEY}
S3 SECRET KEY: ${S3_SECRET_KEY}

TLS Certificates
================
Issuer name: gitpod-selfsigned-issuer
Issuer type: Issuer

The guide to start the Gitpod installer starts here:
https://www.gitpod.io/docs/self-hosted/latest/getting-started#step-4-install-gitpod

The first commands will be:

curl https://kots.io/install | bash
kubectl kots install gitpod -n gitpod

Once Gitpod is installed, and the DNS records are updated, Run the following commands:

# remove shiftfs-module-loader container.
# TODO: remove once the container is removed from the installer
kubectl patch daemonset ws-daemon --type json -p='[{"op": "remove",  "path": "/spec/template/spec/initContainers/3"}]'
NEXTSTEPS

}


function uninstall() {
    check_prerequisites "$1"
    variables_from_context

    read -p "Are you sure you want to delete: Gitpod, Services/Registry, Services/RDS, Services, Addons, Setup (y/n)? " -n 1 -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if ! ${AWS_CMD} eks describe-cluster --name "${CLUSTER_NAME}" --region "${AWS_REGION}" > /dev/null; then
            exit 1
        fi

        KUBECTL_ROLE_ARN=$(${AWS_CMD} iam get-role --role-name "${CLUSTER_NAME}-region-${AWS_REGION}-role-eksadmin" | jq -r .Role.Arn)
        export KUBECTL_ROLE_ARN

        SSM_KEY="/gitpod/cluster/${CLUSTER_NAME}/region/${AWS_REGION}"

        cdk destroy \
            --context clusterName="${CLUSTER_NAME}" \
            --context region="${AWS_REGION}" \
            --context domain="${DOMAIN}" \
            --context identityoidcissuer="$(${AWS_CMD} eks describe-cluster --name "${CLUSTER_NAME}" --query "cluster.identity.oidc.issuer" --output text --region "${AWS_REGION}")" \
            --context certificatearn="${CERTIFICATE_ARN}" \
            --require-approval never \
            --force \
            --all \
        && cdk context --clear \
        && eksctl delete cluster "${CLUSTER_NAME}" --wait \
        && ${AWS_CMD} ssm delete-parameter --name "${SSM_KEY}" --region "${AWS_REGION}"
    cat << UNINSTALL
=====
Remove Registry Bucket with aws commands:
aws s3 rm s3://${CONTAINER_REGISTRY_BUCKET} --recursive
aws s3 rb s3://${CONTAINER_REGISTRY_BUCKET} --force
=====
UNINSTALL
    fi
}

function auth() {
    AUTHPROVIDERS_CONFIG=${1:="auth-providers-patch.yaml"}
    if [ ! -f "${AUTHPROVIDERS_CONFIG}" ]; then
        echo "The auth provider configuration file ${AUTHPROVIDERS_CONFIG} does not exist."
        exit 1
    else
        echo "Using the auth providers configuration file: ${AUTHPROVIDERS_CONFIG}"
    fi

    # Patching the configuration with the user auth provider/s
    kubectl --kubeconfig .kubeconfig patch configmap auth-providers-config --type merge --patch "$(cat ${AUTHPROVIDERS_CONFIG})"
    # Restart the server component
    kubectl --kubeconfig .kubeconfig rollout restart deployment/server
}

function main() {
    if [[ $# -ne 1 ]]; then
        echo "Usage: $0 [--install|--uninstall]"
        exit
    fi

    case $1 in
        '--install')
            install "eks-cluster.yaml"
        ;;
        '--uninstall')
            uninstall "eks-cluster.yaml"
        ;;
        '--auth')
            auth "auth-providers-patch.yaml"
        ;;
        *)
            echo "Unknown command: $1"
            echo "Usage: $0 [--install|--uninstall]"
        ;;
    esac
    echo "done"
}

main "$@"
