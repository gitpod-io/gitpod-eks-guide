#!/usr/bin/env bash

set -o pipefail
set -o nounset
set -o errexit

export DEBIAN_FRONTEND=noninteractive

# shellcheck disable=SC1091
source /etc/packer/files/functions.sh

# wait for cloud-init to finish
wait_for_cloudinit

# upgrade the operating system
apt update -y && apt dist-upgrade -y

# install dependencies
apt-get install -y \
    ca-certificates \
    curl \
    auditd \
    parted \
    unzip \
    lsb-release

install_jq

# enable audit log
systemctl enable auditd && systemctl start auditd

# enable the /etc/environment
configure_http_proxy

# install aws cli
install_awscliv2

# install ssm agent
install_ssmagent

# partition the disks
systemctl stop rsyslog irqbalance polkit
partition_disks /dev/nvme1n1

reboot
