# ─── Build stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# API base URL is baked in at build time (Vite inlines VITE_* env vars).
ARG VITE_API_URL=http://localhost:8000/api/v1
RUN printf 'VITE_API_URL=%s\n' "$VITE_API_URL" > .env.production \
    && npx vite build

# ─── Serve stage ────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback (client-side routes resolve to index.html) and cache headers: see nginx.conf.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
