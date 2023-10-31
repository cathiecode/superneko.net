FROM ghcr.io/cathiecode/docker-cron:latest

RUN apk add certbot rclone certbot-nginx nginx postgresql15

COPY ./src/backup /backup
COPY ./src/certbot-renew /certbot-renew
COPY ./src/.pgpass /root/.pgpass
