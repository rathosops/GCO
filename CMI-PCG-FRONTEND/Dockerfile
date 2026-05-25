# ============================================
# Dockerfile - CMI-PCG Frontend (ARM64 ok)
# ============================================

# ---------------------------
# STAGE 1: Build
# ---------------------------
FROM node:20-alpine AS build

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .
RUN npm run build

# ---------------------------
# STAGE 2: Production
# ---------------------------
FROM nginx:1.25-alpine AS production

RUN apk add --no-cache curl

# Copia nginx.conf como MAIN config
COPY nginx.conf /etc/nginx/nginx.conf

# Copia build
COPY --from=build /app/dist /usr/share/nginx/html

# Permissões para USER nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    mkdir -p /tmp && chown -R nginx:nginx /tmp

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

USER nginx

CMD ["nginx", "-g", "daemon off;"]
