#!/bin/sh
set -eu

: "${JELLYFIN_URL:?JELLYFIN_URL is required}"
JELLYFIN_URL=${JELLYFIN_URL%/}
# Only origins, not arbitrary nginx directives or a public frontend URL.
printf '%s' "$JELLYFIN_URL" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$' || {
  echo 'JELLYFIN_URL must be an HTTP(S) origin without a path' >&2
  exit 1
}
export JELLYFIN_URL
RESOLVERS=$(awk '/^nameserver / { printf "%s ", $2 }' /etc/resolv.conf)
export RESOLVERS
envsubst '${JELLYFIN_URL} ${RESOLVERS}' < /opt/hollyfilms/nginx.conf.template > /tmp/hollyfilms-nginx.conf
exec nginx -c /tmp/hollyfilms-nginx.conf -g 'daemon off;'
