# ─────────────────────────────────────────────────────────────
# AirWatch - Dockerfile
# Base: node:18-alpine (ringan, cocok untuk produksi)
# ─────────────────────────────────────────────────────────────

FROM node:18-alpine

# Metadata label (best practice)
LABEL maintainer="Komputasi Awan - Kubernetes Project"
LABEL description="AirWatch - Air Quality Monitoring App (SDG 11 & 13)"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Copy package files terlebih dahulu (memanfaatkan Docker layer cache)
COPY package*.json ./

# Install dependencies (production only)
RUN npm install --omit=dev

# Copy source code aplikasi
COPY . .

# Expose port yang digunakan Express
EXPOSE 3000

# Environment variables default
ENV NODE_ENV=production
ENV PORT=3000

# Jalankan aplikasi
CMD ["node", "server.js"]
