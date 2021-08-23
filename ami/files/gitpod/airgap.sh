#!/usr/bin/env bash

set -o pipefail
set -o nounset
set -o errexit

DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)

# Extract images from nodes:
# kubectl get nodes -o json | jq --raw-output '.items[].status.images[].names | .[]'
IMAGES=$(cat "${DIR}/airgap-images.txt")

# Download images
xargs -n1 nerdctl --namespace k8s.io pull <<< "${IMAGES}"
