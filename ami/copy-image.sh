#!/usr/bin/env bash

SOURCE_AMI=$1
if [ -z "$SOURCE_AMI" ]; then
    echo -e "Please provider a valid AMI image"
    exit 1
fi

set -euo pipefail

SOURCE_REGION=us-west-2
TARGET_REGIONS=(
    us-west-1
    eu-west-1
    eu-west-2
    eu-west-3
    eu-central-1
    us-east-1
    us-east-2
)

if ! aws ec2 describe-images --region us-west-2 --image-ids "${SOURCE_AMI}" >/dev/null 2>&1; then
    echo "The AMI image with ID ${SOURCE_AMI} does not exist."
    exit 1
fi

NAME=$(aws ec2 describe-images --region us-west-2 --image-ids "${SOURCE_AMI}" --query 'Images[*].[Name]' --output text)

for TO_REGION in ${TARGET_REGIONS[*]};do
    aws ec2 copy-image \
        --name "$NAME" \
        --source-image-id "${SOURCE_AMI}" \
        --source-region "${SOURCE_REGION}" \
        --region "${TO_REGION}" \
        --output text
done
