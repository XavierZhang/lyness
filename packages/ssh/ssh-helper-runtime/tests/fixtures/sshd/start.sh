#!/bin/sh
set -eu
ssh-keygen -q -t ed25519 -N '' -f /etc/ssh/ssh_host_ed25519_key
install -d -m 700 -o lyn -g lyn /home/lyn/.ssh
install -m 600 -o lyn -g lyn /fixture-key.pub /home/lyn/.ssh/authorized_keys
install -d -m 700 -o lyn -g lyn /home/lyn/workspace
exec /usr/sbin/sshd -D -e -f /etc/ssh/sshd_config
