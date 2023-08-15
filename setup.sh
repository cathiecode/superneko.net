#!/bin/bash -x
set -eu

EMAIL=catihecode+letsencrypt@gmail.com
DOMAIN=staging.superneko.net

if [ $(whoami) != root ]; then
  echo "is not root"
  exit 1
fi

apt-get update

apt-get -y upgrade

# Docker Install

apt-get install -y ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg

chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update

apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# nginx
apt-get install -y nginx

# CertBot
apt-get install -y snapd

snap install --classic certbot

certbot certonly --nginx -d $DOMAIN -d www.$DOMAIN -m $EMAIL

cp src/certbot-refresh /etc/cron.weekly/

chmod +x /etc/cron.weekly/certbot-refresh

# nginx config
sed -e "s/<DOMAIN>/$DOMAIN/" src/nginx-misskey.conf > /etc/nginx/conf.d/misskey.conf

systemctl restart nginx

# fail2ban
apt-get install -y fail2ban

systemctl enable fail2ban

echo "Ready to run!"
