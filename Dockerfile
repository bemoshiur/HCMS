# CAAB HCMS — self-contained demo image (app + migrate + seed + serve).
# Amplify Hosting is the primary deployment; this image backs `docker compose up`
# for a fully local/self-hosted run. It keeps the full node_modules so the
# Prisma CLI and tsx (migrate + seed at container start) are available.
FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# prisma schema is needed because the postinstall runs `prisma generate`
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && pnpm build
EXPOSE 3000
# migrate → seed → serve (idempotent; the demo dataset is deterministic)
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/seed.ts && pnpm start"]
