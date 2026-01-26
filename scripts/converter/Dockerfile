# Self-hosted PDF-to-Image Converter for Railway
# Uses Poppler (pdftoppm) for reliable PDF-to-JPEG conversion

FROM node:20-slim

# Install Poppler utilities for PDF conversion
RUN apt-get update && apt-get install -y \
    poppler-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (dev deps included for TypeScript build)
RUN npm install

# Copy converter source
COPY convert.ts tsconfig.json ./

# Build TypeScript
RUN npm run build

# Prune dev dependencies for a smaller image
RUN npm prune --production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run converter
CMD ["node", "convert.js"]
