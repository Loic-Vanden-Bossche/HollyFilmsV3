# Build from the repository root. No environment file or secret is needed.
FROM node:24-bookworm-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54 AS base
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS dependencies
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/shared/package.json apps/shared/package.json
COPY apps/infrastructure/package.json apps/infrastructure/package.json
RUN corepack yarn install --immutable

FROM dependencies AS web-build
COPY apps/web apps/web
COPY apps/shared apps/shared
RUN corepack yarn build:web && \
    find apps/web/dist/assets -type f \( -name '*.js' -o -name '*.css' -o -name '*.wasm' -o -name '*.svg' -o -name '*.ttf' \) \
      -size +1024c -exec gzip -6 -n -k {} +

FROM dependencies AS api-build
COPY apps/api apps/api
COPY apps/shared apps/shared
RUN corepack yarn build:api && corepack yarn workspaces focus @hollyfilms/api

FROM base AS api
COPY apps/api/worker/requirements.txt /tmp/subtitle-sync-requirements.txt
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg python3-venv && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/subtitle-sync && /opt/subtitle-sync/bin/pip install --no-cache-dir -r /tmp/subtitle-sync-requirements.txt
ENV SUBTITLE_SYNC_PYTHON=/opt/subtitle-sync/bin/python
LABEL org.opencontainers.image.title="HollyFilms API"
ARG SOURCE_URL
LABEL org.opencontainers.image.source=$SOURCE_URL
ENV NODE_ENV=production HOLLYFILMS_API_HOST=0.0.0.0 PORT=3000
COPY --from=api-build /app/package.json ./package.json
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/apps/api ./apps/api
COPY --from=api-build /app/apps/shared ./apps/shared
USER node
EXPOSE 3000
CMD ["node", "apps/api/src/index.ts"]

FROM nginx/nginx-unprivileged:stable-alpine@sha256:ea4fd7ab5a8dc6348c18240bd3546f355f8373cd8f112580f7d8bd8ff5a74772 AS web
USER root
RUN apk add --no-cache --upgrade ca-certificates && update-ca-certificates
LABEL org.opencontainers.image.title="HollyFilms Web"
ARG SOURCE_URL
LABEL org.opencontainers.image.source=$SOURCE_URL
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
COPY apps/infrastructure/docker/nginx.conf.template /opt/hollyfilms/nginx.conf.template
COPY apps/infrastructure/docker/start-web.sh /opt/hollyfilms/start-web.sh
USER 101
EXPOSE 8080
ENTRYPOINT ["sh", "/opt/hollyfilms/start-web.sh"]
