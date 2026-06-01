# Stage 1: Install dependencies + download Playwright Chromium
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@8.15.5 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
# Download Chromium for Playwright (used for IMDB scraping) — commented out, IMDB parsing disabled
# RUN pnpm exec playwright install chromium
# pnpm virtual store keeps playwright and playwright-core as sibling symlinks.
# RUN PLAYWRIGHT_STORE=$(dirname "$(readlink -f node_modules/playwright)") \
#     && cp -rL "$PLAYWRIGHT_STORE" /playwright-env

# Stage 2: Build application
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_ENV_VALIDATION=1

# NEXT_PUBLIC_* vars must be available at build time as they are inlined into the JS bundle
ARG NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ARG NEXT_PUBLIC_CLOUDINARY_FOLDER
ENV NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=$NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
ENV NEXT_PUBLIC_CLOUDINARY_FOLDER=$NEXT_PUBLIC_CLOUDINARY_FOLDER

RUN corepack enable && corepack prepare pnpm@8.15.5 --activate
RUN pnpm prisma generate
RUN pnpm build

# Stage 3: Production runtime — Alpine to match the builder and avoid OpenSSL version mismatch
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# openssl is required by Prisma at runtime; libc6-compat ensures glibc-compatible shims
RUN apk add --no-cache openssl libc6-compat

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma engines from the pnpm virtual store — Next.js standalone file tracing does not follow
# nested .prisma directories inside the pnpm store, so engines must be copied explicitly
COPY --from=builder --chown=nextjs:nodejs \
  /app/node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma \
  ./node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Tell Playwright where to find the pre-downloaded Chromium — commented out
# ENV PLAYWRIGHT_BROWSERS_PATH=/home/nextjs/.cache/ms-playwright
# ENV NODE_PATH=/app/playwright-env

CMD ["node", "server.js"]
