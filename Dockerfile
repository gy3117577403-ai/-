# syntax=docker/dockerfile:1
# 生产镜像：Node 20 Alpine + 中国时区 + Next.js standalone

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
# 必须在 runner 且紧接 standalone 之后安装，才能把 Prisma CLI 及 effect 等完整依赖写入最终镜像（standalone 不会带上这些）
RUN npm install prisma && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 运行时 Prisma Client 引擎与生成产物
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
