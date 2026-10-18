# ============================================================
# Universal Review Analyzer — Lightweight Node.js Container
# API-driven backend: Apify + Yelp + Gemini AI
# ============================================================
FROM node:20-alpine

WORKDIR /app

# Copy server package manifests
COPY server/package*.json ./server/

# Install production dependencies (lightweight, no browser binaries)
RUN cd server && npm install --omit=dev

# Copy application source files
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start server
CMD ["node", "server/server.js"]
