# syntax=docker/dockerfile:1.6
# Build stage — pinned to $BUILDPLATFORM so the heavy `npm ci`/`npm run build`
# run natively (Vite output is arch-agnostic JS); only the tiny nginx runtime
# stage is per-target. Base from mirror.gcr.io to keep the DockerHub pull
# budget free (multiarch build in CI, KAC-127).
FROM --platform=$BUILDPLATFORM mirror.gcr.io/library/node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts postcss.config.js tailwind.config.js index.html ./
# public/ — статика, копируемая Vite в dist root (favicon, paws-logo.svg).
# Без неё внутри docker-сборки эти файлы отсутствуют → 404 (был баг с favicon).
COPY public ./public
COPY src ./src

RUN npm run build

# Runtime stage — nginx serves /usr/share/nginx/html, proxy_pass /v1/* → api-gateway
FROM mirror.gcr.io/library/nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
# Resolver-IP экспортируется из /etc/resolv.conf на startup (нумерация 05- идёт
# ДО `20-envsubst-on-templates.sh` стандартного nginx Docker image, поэтому
# ${KUBE_DNS_SERVER} в template подставится cluster-agnostic'но — kind/e2c825/любой).
COPY deploy/05-resolver-from-resolvconf.sh /docker-entrypoint.d/05-resolver-from-resolvconf.sh
RUN chmod +x /docker-entrypoint.d/05-resolver-from-resolvconf.sh

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
