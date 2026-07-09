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

COPY frontend ./frontend

WORKDIR /app/frontend

RUN npm run build

####################################################

FROM nginx:1.27-alpine AS frontend-runtime

COPY --from=frontend /app/frontend/dist /usr/share/nginx/html

####################################################

FROM deps AS front-admin

COPY front_admin ./front_admin

WORKDIR /app/front_admin

RUN npm run build

####################################################

FROM nginx:1.27-alpine AS front-admin-runtime

COPY --from=front-admin /app/front_admin/dist /usr/share/nginx/html