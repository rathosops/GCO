# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Argumentos de build para variáveis de ambiente
# Agora usamos caminhos relativos, válidos de qualquer máquina:
# - /api -> será proxied pelo Nginx para o backend
# - /ws  -> será proxied pelo Nginx para o WebSocket do backend
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/ws

ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_WS_URL=${VITE_WS_URL}

# Instalar dependências
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copiar código e buildar
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

# Copiar arquivos buildados
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar configuração do nginx
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
