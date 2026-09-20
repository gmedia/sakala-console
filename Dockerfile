# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# These values are public browser configuration and must be supplied by the
# deployment build. They are deliberately not defaulted to a production origin.
ARG PUBLIC_API_URL
ARG PUBLIC_APP_URL
ENV PUBLIC_API_URL=$PUBLIC_API_URL
ENV PUBLIC_APP_URL=$PUBLIC_APP_URL

# Reverb connection metadata read by src/lib/realtime/env.ts through
# $env/static/public, so it must exist at build time. All four are public
# values; the Reverb app secret never belongs here. Leaving them empty
# builds a console with realtime disabled.
ARG PUBLIC_REVERB_HOST
ARG PUBLIC_REVERB_PORT
ARG PUBLIC_REVERB_SCHEME
ARG PUBLIC_REVERB_KEY
ENV PUBLIC_REVERB_HOST=$PUBLIC_REVERB_HOST
ENV PUBLIC_REVERB_PORT=$PUBLIC_REVERB_PORT
ENV PUBLIC_REVERB_SCHEME=$PUBLIC_REVERB_SCHEME
ENV PUBLIC_REVERB_KEY=$PUBLIC_REVERB_KEY

RUN pnpm build

FROM caddy:2.10-alpine AS runtime

COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/build /srv

RUN addgroup --system sakala \
    && adduser --system --disabled-password --ingroup sakala sakala \
    && mkdir -p /config/caddy /data/caddy \
    && chown -R sakala:sakala /config /data

USER sakala

ENV XDG_CONFIG_HOME=/config \
    XDG_DATA_HOME=/data

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null 2>&1 || exit 1
