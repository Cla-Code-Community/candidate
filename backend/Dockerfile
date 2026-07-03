FROM node:24-alpine

WORKDIR /app

# Copia os package.json da raiz e do backend
COPY package*.json ./
COPY backend/package*.json ./backend/

# Instala tudo com workspaces (tsx vem da raiz)
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-factor 2 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000
RUN npm ci --workspace=backend --include-workspace-root

# Copia o código do backend
COPY backend/ ./backend/

RUN mkdir -p /app/backend/output

EXPOSE 3001

# Roda a partir da pasta do workspace
WORKDIR /app/backend
CMD ["npx", "tsx", "src/server.ts"]
