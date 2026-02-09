# Dashboard Dockerfile — Node 20 Alpine
# Builds Next.js for production, serves on $PORT
#
# Environment variables needed at RUNTIME (set in Railway):
#   GOOGLE_SHEET_ID
#   GOOGLE_SERVICE_ACCOUNT_JSON
#   DASHBOARD_PASSWORD

FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --production=false

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects telemetry — disable it
ENV NEXT_TELEMETRY_DISABLED=1

# Build (API routes are dynamic, so no env vars needed at build time)
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Railway sets $PORT automatically
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
