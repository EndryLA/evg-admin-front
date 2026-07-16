FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist/evg-admin/browser /usr/share/nginx/html
RUN printf 'server {\n listen 80;\n root /usr/share/nginx/html;\n index index.html;\n location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80