# syntax=docker/dockerfile:1.6

# Stage 1: build the React frontend
FROM node:20-alpine AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# Stage 2: install server prod deps
FROM node:20-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN apk add --no-cache python3 make g++ \
    && npm install --omit=dev --no-audit --no-fund \
    && apk del python3 make g++

# Stage 3: runtime
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/app.db
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=web-build /app/web/dist ./web/dist
ARG BUILD_TIME=unknown
ENV BUILD_TIME=$BUILD_TIME
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server/src/index.js"]
