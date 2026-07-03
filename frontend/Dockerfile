# ---- Etapa 1: build ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm ci --workspace=frontend --include-workspace-root
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm run build

# ---- Etapa 2: serve ----
FROM nginx:1.27-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80