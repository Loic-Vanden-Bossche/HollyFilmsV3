FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
COPY apps/shared/package.json ./apps/shared/
RUN corepack yarn install --immutable

COPY apps/api ./apps/api
COPY apps/shared ./apps/shared
RUN corepack yarn build:api

USER node
ENV HOLLYFILMS_API_HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "apps/api/src/index.ts"]
