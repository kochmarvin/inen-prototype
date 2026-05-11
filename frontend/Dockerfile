FROM node:20-alpine AS build

WORKDIR /app

# Backend URL is baked into the bundle at build time. Override with
# `--build-arg VITE_BACKEND_URL=...` or in docker-compose.yml.
ARG VITE_BACKEND_URL=http://localhost:3000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src

RUN npm run build

FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -q -O - http://localhost:80/ >/dev/null 2>&1 || exit 1
