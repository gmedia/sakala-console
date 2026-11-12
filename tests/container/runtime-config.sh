#!/usr/bin/env bash

# Proves that one built Console image serves any installation: it starts the image with different
# public settings and checks what a browser would receive. Needs Docker. Touches no server.
#
#   tests/container/runtime-config.sh            build the image, then test it
#   IMAGE=<ref> tests/container/runtime-config.sh   test an image that is already built
#   BROWSER=1 tests/container/runtime-config.sh  also open the console in Chromium (Playwright)
#
# The image is built with the values of a made-up hosted installation (api.hosted.example), the
# way the release pipeline builds it for app.sakala.dev, and then pointed at api.selfhost.example
# when the container starts.

set -euo pipefail

cd "$(dirname "$0")/../.."

image=${IMAGE:-}
name_prefix=sakala-console-rc-test
work=$(mktemp -d)
failures=0

cleanup() {
    docker ps -aq --filter "name=^${name_prefix}-" | xargs -r docker rm -f > /dev/null
    rm -rf "$work"
}
trap cleanup EXIT

pass() { printf 'ok   %s\n' "$1"; }
fail() {
    printf 'FAIL %s\n' "$1" >&2
    failures=$((failures + 1))
}
expect_contains() {
    if grep -qF -- "$2" <<< "$3"; then pass "$1"; else fail "$1: expected to find '$2' in: $3"; fi
}
expect_absent() {
    if grep -qF -- "$2" <<< "$3"; then fail "$1: did not expect '$2' in: $3"; else pass "$1"; fi
}
expect_equal() {
    if [ "$2" = "$3" ]; then pass "$1"; else fail "$1: expected '$2', got '$3'"; fi
}

if [ -z "$image" ]; then
    image=sakala-console:runtime-config-test
    cat > "$work/frontend.env" <<'ENV'
PUBLIC_API_URL=https://api.hosted.example
PUBLIC_APP_URL=https://app.hosted.example
PUBLIC_REVERB_HOST=api.hosted.example
PUBLIC_REVERB_PORT=443
PUBLIC_REVERB_SCHEME=https
PUBLIC_REVERB_KEY=hosted-key
ENV
    docker build --quiet \
        --secret "id=frontend_env,src=$work/frontend.env" \
        --build-arg "FRONTEND_ENV_SHA=$(sha256sum "$work/frontend.env" | cut -d' ' -f1)" \
        -t "$image" . > /dev/null
    pass "built $image"
fi

# Starts a container on a free loopback port and prints the port once /healthz answers.
start() {
    local name=$1
    shift
    docker run -d --name "$name_prefix-$name" -p 127.0.0.1::8080 "$@" "$image" > /dev/null
    local port
    port=$(docker port "$name_prefix-$name" 8080/tcp | head -n 1 | sed 's/.*://')
    for _ in $(seq 1 50); do
        if curl -fsS -o /dev/null "http://127.0.0.1:$port/healthz" 2> /dev/null; then
            printf '%s\n' "$port"
            return 0
        fi
        sleep 0.2
    done
    docker logs "$name_prefix-$name" >&2
    return 1
}

csp() { curl -fsS -D - -o /dev/null "http://127.0.0.1:$1/" | tr -d '\r' | sed -n 's/^[Cc]ontent-[Ss]ecurity-[Pp]olicy: //p'; }
config() { curl -fsS "http://127.0.0.1:$1/runtime-config.js"; }

# 1. Nothing set: exactly what the image was built with.
port=$(start built)
expect_contains "no env: runtime config is the empty default" 'window.__SAKALA_RUNTIME_CONFIG__ = {};' "$(config "$port")"
expect_contains "no env: CSP names the built API" "connect-src 'self' https://api.hosted.example wss://api.hosted.example:443" "$(csp "$port")"
expect_contains "no env: index.html loads the runtime config first" '<script src="/runtime-config.js"></script>' "$(curl -fsS "http://127.0.0.1:$port/projects")"

# 1b. Build files never fall back to the SPA shell: a tab left open across a deploy asks for old
# chunks, and index.html served as JavaScript is what made it reload unpredictably.
headers() { curl -sS -D - -o /dev/null "http://127.0.0.1:$port$1" | tr -d '\r'; }
# Prints the value of one header, matched case-insensitively, from the output of `headers`.
header_value() { sed -n "s/^$1: //Ip" <<< "$2" | head -n 1; }
missing=$(headers /_app/immutable/missing.js)
expect_contains "build files: a missing chunk is a 404" 'HTTP/1.1 404' "$missing"
expect_absent "build files: a missing chunk is not served as HTML" 'Content-Type: text/html' "$missing"
expect_contains "build files: a missing chunk keeps the CSP" "Content-Security-Policy: default-src 'self'" "$missing"
expect_contains "build files: a missing file elsewhere under /_app is a 404" 'HTTP/1.1 404' "$(headers /_app/missing.json)"
chunk=$(curl -fsS "http://127.0.0.1:$port/projects" | grep -o '/_app/immutable/[^"]*\.js' | head -n 1)
existing=$(headers "$chunk")
expect_contains "build files: an existing chunk is served" 'HTTP/1.1 200' "$existing"
expect_contains "build files: an existing chunk is JavaScript" 'Content-Type: text/javascript' "$existing"
expect_contains "build files: the version file is served" 'HTTP/1.1 200' "$(headers /_app/version.json)"
shell=$(headers /projects)
expect_contains "build files: a deep link still gets the SPA shell" 'Content-Type: text/html' "$shell"

# 1c. Cache-Control. Every HTML response is the SPA shell and says no-transform, so Cloudflare does
# not inject its Web Analytics beacon, which the CSP would block. The shell is still revalidated on
# each load, still compressed, and still carries every security header.
for path in / /index.html /admin /projects; do
    response=$(headers "$path")
    expect_contains "shell $path: served as HTML" 'Content-Type: text/html' "$response"
    expect_equal "shell $path: Cache-Control" 'no-cache, no-transform' "$(header_value Cache-Control "$response")"
    expect_contains "shell $path: keeps the CSP" "Content-Security-Policy: default-src 'self'" "$response"
    expect_contains "shell $path: keeps frame-ancestors" "frame-ancestors 'none'" "$response"
    expect_equal "shell $path: X-Content-Type-Options" 'nosniff' "$(header_value X-Content-Type-Options "$response")"
    expect_equal "shell $path: X-Frame-Options" 'DENY' "$(header_value X-Frame-Options "$response")"
    expect_equal "shell $path: Referrer-Policy" 'strict-origin-when-cross-origin' "$(header_value Referrer-Policy "$response")"
done
compressed=$(curl -sS -D - -o /dev/null -H 'Accept-Encoding: gzip' "http://127.0.0.1:$port/admin" | tr -d '\r')
expect_equal "shell: still gzip-compressed by Caddy" 'gzip' "$(header_value Content-Encoding "$compressed")"
expect_equal "shell: compressed response keeps no-transform" 'no-cache, no-transform' "$(header_value Cache-Control "$compressed")"
runtime=$(headers /runtime-config.js)
expect_contains "runtime config: still served" 'HTTP/1.1 200' "$runtime"
expect_contains "runtime config: is JavaScript" 'Content-Type: text/javascript' "$runtime"
expect_equal "runtime config: revalidated on each load" 'no-cache' "$(header_value Cache-Control "$runtime")"
expect_contains "runtime config: keeps the CSP" "Content-Security-Policy: default-src 'self'" "$runtime"
expect_equal "build files: a missing chunk is never stored" 'no-store' "$(header_value Cache-Control "$missing")"
expect_equal "build files: an existing chunk gets no shell Cache-Control" '' "$(header_value Cache-Control "$existing")"

# 2. Another installation.
selfhost=(
    -e PUBLIC_API_URL=https://api.selfhost.example
    -e PUBLIC_APP_URL=https://app.selfhost.example
    -e PUBLIC_REVERB_HOST=api.selfhost.example
    -e PUBLIC_REVERB_PORT=443
    -e PUBLIC_REVERB_SCHEME=https
    -e PUBLIC_REVERB_KEY=selfhost-key
)
selfhost_port=$(start selfhost "${selfhost[@]}")
body=$(config "$selfhost_port")
expect_contains "self-host: runtime config names the configured API" '"PUBLIC_API_URL":"https://api.selfhost.example"' "$body"
expect_contains "self-host: runtime config carries the Reverb key" '"PUBLIC_REVERB_KEY":"selfhost-key"' "$body"
policy=$(csp "$selfhost_port")
expect_contains "self-host: CSP allows the configured API and Reverb" "connect-src 'self' https://api.selfhost.example wss://api.selfhost.example:443" "$policy"
expect_contains "self-host: CSP keeps script-src strict" "script-src 'self' 'sha256-" "$policy"
expect_absent "self-host: CSP no longer names the built API" 'hosted.example' "$policy"
expect_absent "self-host: CSP has no inline script allowance" "'unsafe-inline' 'sha256" "$policy"

# 3. Read-only root filesystem with a tmpfs for the rendered files.
ro_port=$(start readonly --read-only --tmpfs /run/sakala-console:mode=1777 --tmpfs /config --tmpfs /data -e PUBLIC_API_URL=https://api.readonly.example) ||
    fail "read-only: container did not become healthy"
if [ -n "${ro_port:-}" ]; then
    expect_contains "read-only: runtime config is rendered into the tmpfs" '"PUBLIC_API_URL":"https://api.readonly.example"' "$(config "$ro_port")"
fi

# 4. A bad value stops the container instead of serving a broken console.
docker run --name "$name_prefix-invalid" -e PUBLIC_API_URL=ftp://api.selfhost.example "$image" > /dev/null 2> "$work/invalid.log" && status=0 || status=$?
if [ "$status" -ne 0 ]; then pass "invalid: container refuses to start (exit $status)"; else fail "invalid: container started"; fi
expect_contains "invalid: the log names the setting" 'PUBLIC_API_URL must be an http:// or https:// URL' "$(cat "$work/invalid.log")"

# 5. Optional: a real browser against the self-host container calls the configured API.
if [ "${BROWSER:-0}" = 1 ]; then
    if CONSOLE_URL="http://127.0.0.1:$selfhost_port" EXPECTED_API_ORIGIN=https://api.selfhost.example \
        pnpm -s exec playwright test -c tests/container/playwright.config.ts; then
        pass "browser: the console calls the configured API"
    else
        fail "browser: see the Playwright output above"
    fi
fi

if [ "$failures" -gt 0 ]; then
    printf '%s check(s) failed.\n' "$failures" >&2
    exit 1
fi
printf 'All container checks passed.\n'
