# syntax=docker/dockerfile:1
# 生产镜像：Node 20 Alpine + 中国时区 + Next.js standalone + 完整 node_modules（保底 Prisma CLI / effect 等依赖树）

FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl tzdata
ENV TZ=Asia/Shanghai
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 构建前生成 Prisma Client（与 schema 一致）
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache tzdata openssl libc6-compat
ENV TZ=Asia/Shanghai
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
# 暴力完整复制 builder 依赖树，覆盖 standalone 自带的残缺 node_modules，终结 effect/fast-check 等缺失
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

RUN chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 已有库无 migration 历史时用 db push 绕过 P3005；非交互需 --accept-data-loss（生产请评估数据风险）
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node server.js"]
