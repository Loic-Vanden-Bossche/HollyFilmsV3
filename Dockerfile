FROM node:24-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY prisma.config.ts tsconfig.server.json ./
COPY prisma ./prisma
COPY server ./server
COPY shared ./shared
COPY src/jellyfin.ts ./src/jellyfin.ts
COPY tests/accounts.test.ts ./tests/accounts.test.ts
RUN npm run build:api

USER node
ENV HOLLYFILMS_API_HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "server/index.ts"]
