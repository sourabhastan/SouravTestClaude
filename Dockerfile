# syntax=docker/dockerfile:1.6

# Stage 1: build the React frontend
FROM node:20-alpine AS web-build
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY web/ ./
RUN npm run build

# Stage 2: install backend prod deps (root package.json)
FROM node:20-alpine AS server-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Stage 3: runtime
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    TURSO_DATABASE_URL=file:/data/app.db
WORKDIR /app
COPY --from=server-deps /app/node_modules ./node_modules
COPY package.json ./
COPY server/ ./server/
COPY --from=web-build /app/web/dist ./web/dist
ARG BUILD_TIME=unknown
ENV BUILD_TIME=$BUILD_TIME
VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server/src/index.js"]
