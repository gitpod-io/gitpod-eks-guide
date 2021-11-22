#!/usr/bin/env bash

set -o pipefail
set -o nounset
set -o errexit

# Update OS
apt update

# Install required packages
apt --no-install-recommends install -y \
  apt-transport-https ca-certificates curl gnupg2 software-properties-common \
  iptables libseccomp2 socat conntrack ipset \
  fuse3 \
  jq \
  iproute2 \
  auditd \
  ethtool \
  net-tools \
  linux-aws \
  dkms

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

# Enable cgroups2
# sed -i 's/GRUB_CMDLINE_LINUX="\(.*\)"/GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=1 \1"/g' /etc/default/grub

# Install containerd
curl -sSL https://github.com/containerd/nerdctl/releases/download/v0.14.0/nerdctl-full-0.14.0-linux-amd64.tar.gz -o - | tar -xz -C /usr/local

# copy the portmap plugin to support hostport
mkdir -p /opt/cni/bin
ln -s /usr/local/libexec/cni/portmap /opt/cni/bin

cp /usr/local/lib/systemd/system/* /lib/systemd/system/

# Configure containerd
mkdir -p /etc/containerd/
cp /etc/packer/files/gitpod/containerd.toml /etc/containerd/config.toml
# Enable stargz-snapshotter plugin
mkdir -p /etc/containerd-stargz-grpc
cp /etc/packer/files/gitpod/containerd-stargz-grpc.toml /etc/containerd-stargz-grpc/config.toml
cp /etc/packer/files/gitpod/stargz-snapshotter.service  /lib/systemd/system/stargz-snapshotter.service

# Reload systemd
systemctl daemon-reload

# Start containerd and stargz
systemctl enable containerd
systemctl enable stargz-snapshotter

echo "image-endpoint: unix:///run/containerd-stargz-grpc/containerd-stargz-grpc.sock" >> /etc/crictl.yaml

systemctl start containerd
systemctl start stargz-snapshotter

# Prepare images airgap tgz
chmod +x /etc/packer/files/gitpod/airgap.sh
/etc/packer/files/gitpod/airgap.sh

sleep 60
systemctl stop containerd
