# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Public browser configuration (PUBLIC_API_URL, PUBLIC_APP_URL, PUBLIC_REVERB_*)
# is read by $env/static/public at build time from a single env file that the
# deployment passes as the BuildKit secret `frontend_env`. One file per target
# environment; nothing is defaulted to a production origin. The secret is a
# mount, so it never lands in an image layer, but compiled PUBLIC_* values are
# visible in the browser bundle by design. The Reverb app secret is not a
# PUBLIC_* value and must never be in this file.
#
# BuildKit secret contents do not take part in the cache key, so the
# deployment hashes the exact env file and passes it as FRONTEND_ENV_SHA; it is
# consumed in the same RUN as the build so a changed file always rebuilds.
#
# The same RUN writes the Content-Security-Policy, which needs that env file for
# the API and Reverb origins and the built HTML for the hash of its inline script.
# It also writes /app/runtime-template: the same policy with the origins left as
# placeholders, and the public values above, so docker/entrypoint.sh can point
# the image at another installation when the container starts.
ARG FRONTEND_ENV_SHA
RUN --mount=type=secret,id=frontend_env,target=/app/.env.production,required=true \
    test -n "$FRONTEND_ENV_SHA" \
    && pnpm build \
    && node docker/security-headers.mjs .env.production build /app/security-headers.caddy /app/runtime-template

FROM caddy:2.10-alpine AS runtime

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/console-entrypoint
COPY --from=build /app/security-headers.caddy /etc/caddy/security-headers.caddy
COPY --from=build /app/runtime-template /etc/sakala-console
COPY --from=build /app/build /srv

# /run/sakala-console holds what docker/entrypoint.sh renders at start. It is
# seeded with the build-time files, so the image still serves them if something
# starts Caddy without the entrypoint. With a read-only root filesystem, mount
# a tmpfs there; the entrypoint fills it on every start.
RUN addgroup --system sakala \
    && adduser --system --disabled-password --ingroup sakala sakala \
    && mkdir -p /config/caddy /data/caddy /run/sakala-console \
    && cp /srv/runtime-config.js /etc/caddy/security-headers.caddy /run/sakala-console/ \
    && chown -R sakala:sakala /config /data /run/sakala-console

USER sakala

ENV XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/data

EXPOSE 8080

# Public settings (PUBLIC_API_URL, PUBLIC_APP_URL, PUBLIC_REVERB_*) set on the
# container replace the built ones. See "Konfigurasi saat container start" in README.md.
ENTRYPOINT ["/usr/local/bin/console-entrypoint"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1
