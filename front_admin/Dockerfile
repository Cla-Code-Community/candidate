# ---- Build ----
FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY front_admin/package*.json ./front_admin/

RUN npm ci --workspace=front_admin --include-workspace-root

COPY front_admin ./front_admin

WORKDIR /app/front_admin

ARG VITE_API_URL
ARG VITE_APP_ENV=production

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_ENV=$VITE_APP_ENV

RUN npm run build

# ---- Runtime ----
FROM nginx:1.27-alpine

COPY --from=build /app/front_admin/dist /usr/share/nginx/html

COPY front_admin/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
