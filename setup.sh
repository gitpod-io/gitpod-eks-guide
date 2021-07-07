#!/usr/bin/env bash

set -euo pipefail

function variables_from_context() {
    # Create EKS cluster without nodes
    # Generate a new kubeconfig file in the local directory
    KUBECONFIG=".kubeconfig"

    # extract details form the ecktl configuration file
    CLUSTER_NAME=$(yq eval '.metadata.name' "${EKSCTL_CONFIG}")
    AWS_REGION=$(yq eval '.metadata.region' "${EKSCTL_CONFIG}")

    ACCOUNT_ID=$(${AWS_CMD} sts get-caller-identity | jq -r .Account)

    export KUBECONFIG
    export CLUSTER_NAME
    export AWS_REGION
    export ACCOUNT_ID
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

    if [ -z "${CERTIFICATE_ARN}" ]; then
      echo "Missing CERTIFICATE_ARN environment variable."
      exit 1;
    fi

    if [ -z "${DOMAIN}" ]; then
      echo "Missing DOMAIN environment variable."
      exit 1;
    fi

    AWS_CMD="aws"
    if [ -z "${AWS_PROFILE}" ]; then
      echo "Missing (optional) AWS profile."
    else
      echo "Using the AWS profile: ${AWS_PROFILE}"
      AWS_CMD="aws --profile $AWS_PROFILE"
    fi

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

    # Check the certificate exists
    if ! ${AWS_CMD} acm describe-certificate --certificate-arn "${CERTIFICATE_ARN}" --region "${AWS_REGION}" >/dev/null 2>&1; then
        echo "The secret ${CERTIFICATE_ARN} does not exist."
        exit 1
    fi

    if ! eksctl get cluster "${CLUSTER_NAME}" > /dev/null 2>&1; then
        # https://eksctl.io/usage/managing-nodegroups/
        eksctl create cluster --config-file "${EKSCTL_CONFIG}" --without-nodegroup --kubeconfig ${KUBECONFIG}
    fi

    # Disable default AWS CNI provider.
    # The reason for this change is related to the number of containers we can have in ec2 instances
    # https://github.com/awslabs/amazon-eks-ami/blob/master/files/eni-max-pods.txt
    # https://docs.aws.amazon.com/eks/latest/userguide/pod-networking.html
    kubectl patch ds -n kube-system aws-node -p '{"spec":{"template":{"spec":{"nodeSelector":{"non-calico": "true"}}}}}'
    # Install Calico.
    kubectl apply -f https://docs.projectcalico.org/manifests/calico-vxlan.yaml

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

    # Create RDS database, S3 bucket for docker-registry and IAM account for gitpod S3 storage
    # the cdk application will generates a gitpod-values.yaml file to be used by helm

    # TODO: remove once we can reference a secret in the helm chart.
    # generated password cannot excede 41 characters (RDS limitation)
    SSM_KEY="/gitpod/cluster/${CLUSTER_NAME}/region/${AWS_REGION}"
    ${AWS_CMD} ssm put-parameter \
        --overwrite \
        --name "${SSM_KEY}" \
        --type String \
        --value "$(date +%s | sha256sum | base64 | head -c 35 ; echo)" \
        --region "${AWS_REGION}" > /dev/null 2>&1

    # deploy CDK stacks
    cdk deploy \
        --context clusterName="${CLUSTER_NAME}" \
        --context region="${AWS_REGION}" \
        --context domain="${DOMAIN}" \
        --context certificatearn="${CERTIFICATE_ARN}" \
        --context identityoidcissuer="$(${AWS_CMD} eks describe-cluster --name "${CLUSTER_NAME}" --query "cluster.identity.oidc.issuer" --output text --region "${AWS_REGION}")" \
        --require-approval never \
        --all

    # wait for update of the ingress status
    sleep 5

    ALB_URL=$(kubectl get ingress gitpod -o json | jq -r .status.loadBalancer.ingress[0].hostname)
    if [ -n "${ALB_URL}" ];then
        printf '\nLoad balancer hostname: %s\n' "${ALB_URL}"
    fi
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

        cdk destroy \
            --context clusterName="${CLUSTER_NAME}" \
            --context region="${AWS_REGION}" \
            --context domain="${DOMAIN}" \
            --context certificatearn="${CERTIFICATE_ARN}" \
            --context identityoidcissuer="3333" \
            --require-approval never \
            --force \
            --all \
        && cdk context --clear \
        && eksctl delete cluster "${CLUSTER_NAME}"
    fi
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
        *)
            echo "Unknown command: $1"
            echo "Usage: $0 [--install|--uninstall]"
        ;;
    esac
    echo "done"
}

main "$@"
