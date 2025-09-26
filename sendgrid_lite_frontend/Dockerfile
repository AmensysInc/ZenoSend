# ---------- build stage ----------
FROM node:20-alpine as build
WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* .npmrc* ./
RUN npm ci || npm i

COPY . .

# pass base + api vars BEFORE build
ARG VITE_BASE=/
ARG VITE_API_BASE=http://localhost:8000
ARG VITE_API_KEY=

# set them as environment for the build
ENV VITE_BASE=$VITE_BASE \
    VITE_API_BASE=$VITE_API_BASE \
    VITE_API_KEY=$VITE_API_KEY

RUN npm run build

# ---------- runtime ----------
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
