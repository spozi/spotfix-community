FROM node:25-alpine3.22 AS build
WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.29.8-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-runtime-env.sh /docker-entrypoint.d/40-runtime-env.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-env.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
