#!/usr/bin/env bash

set -o pipefail
set -o nounset
set -o errexit

# shellcheck disable=SC1091
source /etc/packer/files/functions.sh

apt-get install -y apt-transport-https ca-certificates curl gnupg-agent software-properties-common

add-apt-repository -y ppa:tuxinvader/lts-mainline
apt-get update
apt-get install -y linux-generic-5.13

# Install required packages
apt-get install -y \
  iptables libseccomp2 socat conntrack ipset \
  fuse3 \
  jq \
  iproute2 \
  auditd \
  ethtool \
  net-tools

mkdir -p /etc/modules-load.d/

# Enable modules
cat <<EOF > /etc/modules-load.d/k8s.conf
ena
overlay
fuse
br_netfilter
EOF

# Disable modules
cat <<EOF > /etc/modprobe.d/kubernetes-blacklist.conf
blacklist dccp
blacklist sctp
EOF

# Configure grub
echo "GRUB_GFXPAYLOAD_LINUX=keep" >> /etc/default/grub
# Enable cgroups2
sed -i 's/GRUB_CMDLINE_LINUX="\(.*\)"/GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=1 cgroup_no_v1=all \1"/g' /etc/default/grub
update-grub2

# Install containerd
curl -sSL https://github.com/containerd/nerdctl/releases/download/v0.11.1/nerdctl-full-0.11.1-linux-amd64.tar.gz -o - | tar -xz -C /usr/local

mkdir -p /etc/containerd /etc/containerd/certs.d

cp /etc/packer/files/gitpod/containerd.toml /etc/containerd/config.toml

cp /usr/local/lib/systemd/system/* /lib/systemd/system/
sed -i 's/--log-level=debug//g' /lib/systemd/system/stargz-snapshotter.service

cp /usr/local/lib/systemd/system/* /lib/systemd/system/
# Disable software irqbalance service
systemctl stop irqbalance.service
systemctl disable irqbalance.service

# Reload systemd
systemctl daemon-reload

mkdir -p /etc/containerd-stargz-grpc/

# Start containerd and stargz
systemctl enable containerd
systemctl enable stargz-snapshotter

systemctl start containerd

# Prepare images airgap tgz
#chmod +x /etc/packer/files/gitpod/airgap.sh
#/etc/packer/files/gitpod/airgap.sh

sleep 60
systemctl stop containerd
