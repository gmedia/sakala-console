#!/bin/sh

# Points this Console image at an installation when the container starts.
#
# The image is built with one set of public values (PUBLIC_API_URL, PUBLIC_APP_URL,
# PUBLIC_REVERB_*), which docker/security-headers.mjs records in build.env. Any of those names set
# in the container's environment replaces the built value. This script then writes two files that
# docker/Caddyfile serves:
#
#   runtime-config.js        loaded by src/app.html before the app starts (src/lib/config/runtime.ts)
#   security-headers.caddy   the Content-Security-Policy, naming the API and Reverb origins in use
#
# With none of those names set, both files are the ones the image was built with, so an image whose
# container sets nothing behaves exactly as before. Setting a name to an empty value counts as
# setting it; an empty PUBLIC_REVERB_KEY switches realtime off.
#
# Every value is checked before it reaches the browser or the policy. A bad value stops the
# container with a message instead of serving a console that cannot reach its API.

set -eu

template_dir=${SAKALA_CONSOLE_TEMPLATE_DIR:-/etc/sakala-console}
runtime_dir=${SAKALA_CONSOLE_RUNTIME_DIR:-/run/sakala-console}
default_config=${SAKALA_CONSOLE_DEFAULT_CONFIG:-/srv/runtime-config.js}
default_headers=${SAKALA_CONSOLE_DEFAULT_HEADERS:-/etc/caddy/security-headers.caddy}

keys='PUBLIC_API_URL PUBLIC_APP_URL PUBLIC_REVERB_HOST PUBLIC_REVERB_PORT PUBLIC_REVERB_SCHEME PUBLIC_REVERB_KEY'

fail() {
    printf 'sakala-console: %s\n' "$1" >&2
    exit 1
}

# Writes through a temporary file, so Caddy never reads half a file.
publish() {
    target="$runtime_dir/$1"
    tmp="$target.tmp"
    cat > "$tmp"
    mv -f "$tmp" "$target"
}

is_set_at_runtime() {
    printenv "$1" > /dev/null 2>&1
}

# Sets `present` and `value` for one key: the runtime value when the container sets it, otherwise
# the value the image was built with. build.env holds unquoted KEY=value lines and is never
# evaluated.
lookup() {
    if is_set_at_runtime "$1"; then
        present=1
        value=$(printenv "$1")
    elif grep -q "^$1=" "$template_dir/build.env" 2> /dev/null; then
        present=1
        value=$(sed -n "s/^$1=//p" "$template_dir/build.env" | head -n 1)
    else
        present=0
        value=
    fi
}

check_host() {
    case $2 in
        '' | *[!A-Za-z0-9.-]*) fail "$1 must be a host name (letters, digits, dots, hyphens), got: $2" ;;
    esac
}

check_port() {
    case $2 in
        '' | *[!0-9]*) fail "$1 must be a port number, got: $2" ;;
    esac
    if [ "${#2}" -gt 5 ] || [ "$2" -lt 1 ] || [ "$2" -gt 65535 ]; then
        fail "$1 must be a port between 1 and 65535, got: $2"
    fi
}

# Accepts http and https URLs with a plain host name, an optional port, and an optional path, and
# sets `origin` to scheme://host[:port] in the form a browser compares (lower case, no default port).
check_url() {
    case $2 in
        http://*) scheme=http rest=${2#http://} ;;
        https://*) scheme=https rest=${2#https://} ;;
        *) fail "$1 must be an http:// or https:// URL, got: $2" ;;
    esac
    case $2 in
        *[!A-Za-z0-9._~:/%-]*) fail "$1 contains a character that is not allowed in this setting: $2" ;;
    esac
    authority=${rest%%/*}
    host=${authority%%:*}
    check_host "$1 host" "$host"
    origin="$scheme://$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')"
    case $authority in
        *:*)
            port=${authority#*:}
            check_port "$1 port" "$port"
            if { [ "$scheme" = https ] && [ "$port" != 443 ]; } || { [ "$scheme" = http ] && [ "$port" != 80 ]; }; then
                origin="$origin:$port"
            fi
            ;;
    esac
}

mkdir -p "$runtime_dir"

overridden=
for key in $keys; do
    if is_set_at_runtime "$key"; then
        overridden="$overridden $key"
    fi
done

if [ -z "$overridden" ]; then
    publish runtime-config.js < "$default_config"
    publish security-headers.caddy < "$default_headers"
    exec "$@"
fi

[ -r "$template_dir/csp.caddy.template" ] ||
    fail "$template_dir/csp.caddy.template is missing; this image cannot be configured at runtime."

json=
api_origin=
for key in $keys; do
    lookup "$key"
    [ "$present" -eq 1 ] || continue

    if [ -n "$value" ]; then
        case $key in
            PUBLIC_API_URL)
                check_url "$key" "$value"
                api_origin=$origin
                ;;
            PUBLIC_APP_URL) check_url "$key" "$value" ;;
            PUBLIC_REVERB_HOST) check_host "$key" "$value" ;;
            PUBLIC_REVERB_PORT) check_port "$key" "$value" ;;
            PUBLIC_REVERB_SCHEME)
                case $value in
                    http | https) ;;
                    *) fail "$key must be http or https, got: $value" ;;
                esac
                ;;
            PUBLIC_REVERB_KEY)
                case $value in
                    *[!A-Za-z0-9._-]*) fail "$key may only hold letters, digits, dots, underscores, and hyphens." ;;
                esac
                ;;
        esac
    fi

    # Every value passed a character check that excludes quotes and backslashes, so it is a valid
    # JSON string as it stands.
    json="$json${json:+,}\"$key\":\"$value\""
done

[ -n "$api_origin" ] || fail "PUBLIC_API_URL is empty; the console needs the URL of its API."

# Mirrors reverbOrigin in docker/security-headers.mjs: realtime needs both a key and a host.
lookup PUBLIC_REVERB_KEY
reverb_key=$value
lookup PUBLIC_REVERB_HOST
reverb_host=$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')
reverb_origin=
if [ -n "$reverb_key" ] && [ -n "$reverb_host" ]; then
    lookup PUBLIC_REVERB_SCHEME
    reverb_scheme=ws
    [ "$value" != https ] || reverb_scheme=wss
    lookup PUBLIC_REVERB_PORT
    reverb_origin="$reverb_scheme://$reverb_host${value:+:$value}"
fi

printf 'window.__SAKALA_RUNTIME_CONFIG__ = {%s};\n' "$json" | publish runtime-config.js

sed \
    -e 's/^# Generated by docker\/security-headers.mjs during the image build./# Generated by docker\/entrypoint.sh when the container started./' \
    -e "s|__SAKALA_API_ORIGIN__|$api_origin|g" \
    -e "s| __SAKALA_REVERB_ORIGIN__|${reverb_origin:+ $reverb_origin}|g" \
    "$template_dir/csp.caddy.template" | publish security-headers.caddy

printf 'sakala-console: runtime settings from%s; API %s, realtime %s\n' \
    "$overridden" "$api_origin" "${reverb_origin:-off}" >&2

exec "$@"
