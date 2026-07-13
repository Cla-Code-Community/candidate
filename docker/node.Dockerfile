FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./

COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY front_admin/package*.json ./front_admin/

RUN npm ci

####################################################

FROM deps AS backend

COPY backend ./backend

WORKDIR /app/backend

CMD ["npx","tsx","src/server.ts"]

####################################################

FROM deps AS frontend

ARG VITE_API_BASE_URL
ARG VITE_API_URL

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_URL=$VITE_API_URL

COPY frontend ./frontend

WORKDIR /app/frontend

RUN npm run build

####################################################

FROM nginx:1.27-alpine AS frontend-runtime

COPY --from=frontend /app/frontend/dist /usr/share/nginx/html

####################################################

FROM deps AS front-admin

ARG VITE_API_URL
ARG VITE_APP_ENV=production

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_ENV=$VITE_APP_ENV

COPY front_admin ./front_admin

WORKDIR /app/front_admin

RUN npm run build

####################################################

FROM nginx:1.27-alpine AS front-admin-runtime

COPY --from=front-admin /app/front_admin/dist /usr/share/nginx/html
