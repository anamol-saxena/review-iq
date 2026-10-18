# ============================================================
# Universal Review Analyzer — Container Image for Google Cloud Run
# Uses official Playwright image containing pre-installed Chromium
# and all required OS system dependencies.
# ============================================================
FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /app

# Copy server package manifests
COPY server/package*.json ./server/

# Install dependencies (skipping playwright download as browser is pre-installed in image)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN cd server && npm install --omit=dev

# Copy application source files
COPY . .

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Start server
CMD ["node", "server/server.js"]
