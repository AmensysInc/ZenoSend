FROM node:20-alpine as build
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc* ./
RUN npm ci || npm i
COPY . .
ARG VITE_API_BASE=/api
ARG VITE_API_KEY=
ENV VITE_API_BASE=$VITE_API_BASE VITE_API_KEY=$VITE_API_KEY
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
