#!/bin/bash

set -euo pipefail

if [ "$#" -ne 3 ]; then
    echo "Invalid number of parameters. Expected <path eksctl configuration>"
    exit 1
fi

EKSCTL_CONFIG=$1
DOMAIN=$2
CERTIFICATE_ARN=$3

if [ ! -f "${EKSCTL_CONFIG}" ]; then
    echo "Configuration file ${EKSCTL_CONFIG} does not exist."
    exit 1
fi

# extract details form the ecktl configuration file
CLUSTER_NAME=$(yq eval '.metadata.name' "${EKSCTL_CONFIG}")
AWS_REGION=$(yq eval '.metadata.region' "${EKSCTL_CONFIG}")

# Check the Certificate exists
CERT_DETAILS=$(aws acm describe-certificate --certificate-arn "${CERTIFICATE_ARN}")
if [ $? -eq 1 ]; then
    echo "The secret ${CERTIFICATE_ARN} does not exist."
    exit 1
else
    echo "Valid certificate ARN found. Validating if required DNS names are present in the certificate SubjectAlternativeNames field"
    # NAMES=$(echo "$CERT_DETAILS" | jq --raw-output '.Certificate.SubjectAlternativeNames')
fi

# Create EKS cluster without nodes.
eksctl create cluster --config-file "${EKSCTL_CONFIG}" --without-nodegroup

# Disable default AWS CNI provider.
kubectl patch ds -n kube-system aws-node -p '{"spec":{"template":{"spec":{"nodeSelector":{"non-calico": "true"}}}}}'

# Install Calico opetator.
kubectl apply -f https://docs.projectcalico.org/manifests/tigera-operator.yaml

# Create Calico CNI installation
kubectl apply -f - <<EOF
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  calicoNetwork:
    ipPools:
      - blockSize: 26
        cidr: 172.16.0.0/16
        encapsulation: VXLANCrossSubnet
        natOutgoing: Enabled
        nodeSelector: all()
    linuxDataplane: BPF
    hostPorts: null
  cni:
    type: Calico
  kubernetesProvider: EKS
  flexVolumePath: /var/lib/kubelet/plugins
EOF

# Setup Calico
kubectl create namespace calico-system || true
kubectl apply -f - <<EOF
kind: ConfigMap
apiVersion: v1
metadata:
  name: kubernetes-services-endpoint
  namespace: calico-system
data:
  # extract load balanced domain name created by EKS
  KUBERNETES_SERVICE_HOST: $(aws eks describe-cluster --name "${CLUSTER_NAME}" --query "cluster.endpoint" --output text)
  KUBERNETES_SERVICE_PORT: "443"
EOF

# Create cluster nodes defined in the configuration file
eksctl create nodegroup --config-file="${EKSCTL_CONFIG}"

# Restart tigera-operator
kubectl delete pod -n tigera-operator -l k8s-app=tigera-operator

# Disable kube-proxy (deletion is also an option)
kubectl patch ds -n kube-system kube-proxy -p '{"spec":{"template":{"spec":{"nodeSelector":{"non-calico": "true"}}}}}'

# Create RDS database, S3 bucket for docker-registry and IAM account for gitpod S3 storage
the cdk application will generates a gitpod-values.yaml file to be used by helm

# TODO: remove once we can reference a secret in the helm chart.
# generated password cannot excede 41 characters (RDS limitation)
SSM_KEY="/gitpod/cluster/${CLUSTER_NAME}/region/${AWS_REGION}"
aws ssm put-parameter \
  --overwrite \
  --name "${SSM_KEY}" \
  --type String \
  --value "$(date +%s | sha256sum | base64 | head -c 35 ; echo)"

cdk deploy \
  --context clustername="${CLUSTER_NAME}" \
  --context region="${AWS_REGION}" \
  --context domain="${DOMAIN}" \
  --context certificatearn="${CERTIFICATE_ARN}" \
  --context identityoidcissuer="$(aws eks describe-cluster --name "${CLUSTER_NAME}" --query "cluster.identity.oidc.issuer" --output text)" \
  --require-approval never \
  --all

echo "done."
