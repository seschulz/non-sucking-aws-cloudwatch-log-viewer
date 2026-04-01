# Stage 1: Build
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/

RUN npm ci

COPY client/ client/
COPY server/ server/

RUN npm run build

# Stage 2: Runtime
FROM node:22-slim

WORKDIR /app

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/

RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=build /app/server/dist/ server/dist/
COPY --from=build /app/client/dist/ client/dist/

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
