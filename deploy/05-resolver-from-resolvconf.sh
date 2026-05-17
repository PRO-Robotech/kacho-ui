#!/bin/sh
# Берём первый nameserver из /etc/resolv.conf и подставляем в template'е nginx
# до того как `20-envsubst-on-templates.sh` его скопирует в conf.d.
#
# Зачем: nginx требует literal IP в `resolver`-директиве. /etc/resolv.conf —
# единственный cluster-agnostic источник DNS-IP (kubelet кладёт правильный
# nameserver на каждом cluster: kind 10.96.0.10, e2c825 10.100.0.10, и т.д.).

NS=$(awk '/^nameserver/ {print $2; exit}' /etc/resolv.conf)
if [ -z "$NS" ]; then
    echo "[05-resolver] FATAL: no nameserver in /etc/resolv.conf" >&2
    exit 1
fi
TPL=/etc/nginx/templates/default.conf.template
if [ ! -f "$TPL" ]; then
    echo "[05-resolver] FATAL: $TPL not found" >&2
    exit 1
fi
# Прямой sed-replace в template — не полагаемся на envsubst export-propagation.
sed -i "s|\${KUBE_DNS_SERVER}|$NS|g" "$TPL"
echo "[05-resolver] nameserver $NS из /etc/resolv.conf подставлен в $TPL"
