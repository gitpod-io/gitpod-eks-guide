#!/usr/bin/env bash

set -o pipefail
set -o nounset
set -o errexit

git clone -b k5.13 https://github.com/toby63/shiftfs-dkms.git /tmp/shiftfs-k513
cd /tmp/shiftfs-k513
make -f Makefile.dkms
modinfo shiftfs

reboot
