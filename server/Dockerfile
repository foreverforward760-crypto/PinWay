# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Non-root user
RUN addgroup -S pinway && adduser -S pinway -G pinway

COPY --from=deps /app/node_modules ./node_modules
COPY server/ .

ENV NODE_ENV=production
USER pinway

EXPOSE 4000

# Run DB migrations then start the API server
CMD ["sh", "-c", "node migrations/run.js && node index.js"]
