# EnglishPro — продакшен-образ (multi-stage, standalone-сборка Next.js)
# Сборка:   docker build -t englishpro .
# Запуск:   docker compose up -d   (см. docker-compose.yml)

# ---- 1. Зависимости ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json bun.lock* package-lock.json* ./
COPY prisma ./prisma
# postinstall сам выполняет prisma generate
RUN npm install --legacy-peer-deps --no-audit --no-fund

# ---- 2. Сборка ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- 3. Рантайм ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_URL=file:/app/db/custom.db

# standalone-сервер (+ static и public уже внутри после npm run build)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

# Prisma CLI для первичной миграции БД при старте + скрипт бэкапа
# Prisma и все его зависимости
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma

RUN mkdir -p /app/db /app/backups

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node server.js"]
