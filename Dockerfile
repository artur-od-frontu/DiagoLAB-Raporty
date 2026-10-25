# DiagoLAB Raporty+ — multi-stage Dockerfile
# ============================================

# ---------- Etap 1: zależności ----------
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---------- Etap 2: build ----------
FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- Etap 3: produkcja ----------
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Chromium do generowania PDF
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      chromium fonts-liberation fonts-noto-color-emoji \
      libatk-bridge2.0-0 libatk1.0-0 libcups2 libgbm1 \
      libnss3 libpango-1.0-0 libxcomposite1 libxdamage1 \
      libxrandr2 libxkbcommon0 libdrm2 libatspi2.0-0 && \
    rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/usr/lib/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Kopiuj wyłącznie niezbędne artefakty
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
