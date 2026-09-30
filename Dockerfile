# syntax=docker/dockerfile:1
# The share page's web player (docs/features/share.md): the static build,
# served by nginx under /web/ on the API's host - the API serves the page
# itself (/live/:id), which loads /web/player.js. Runs as nginx's
# unprivileged user.

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/web
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
