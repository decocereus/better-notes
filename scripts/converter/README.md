# PDF-to-Image Converter Service

Self-hosted PDF-to-image converter using Poppler's `pdftoppm`. Designed to run on Railway as a replacement for CloudConvert.

## Features

- Converts PDF pages to JPEG images
- Configurable DPI and quality settings
- Direct R2 storage integration
- Progress tracking via conversion-status.json
- Zero-padded page numbering (page-0001.jpg, page-0002.jpg, etc.)

## API Endpoints

### POST /convert

Convert a PDF to images.

**Request Body:**
```json
{
  "assetId": "abc123",
  "sourceKey": "uploads/document.pdf",
  "dpi": 150,
  "quality": 85,
  "format": "jpg"
}
```

**Response:**
```json
{
  "success": true,
  "totalPages": 42,
  "errors": []
}
```

### GET /convert/:assetId/status

Check conversion progress.

**Response:**
```json
{
  "status": "processing",
  "pagesProcessed": 25,
  "totalPages": 42,
  "startedAt": "2024-01-23T10:00:00.000Z"
}
```

### GET /health

Health check endpoint.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 3000) |
| `CONVERTER_TOKEN` | No | Shared secret for authentication |
| `R2_ENDPOINT` | Yes | Cloudflare R2 endpoint URL |
| `R2_ACCESS_KEY_ID` | Yes | R2 access key ID |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 secret access key |
| `R2_BUCKET_NAME` | Yes | R2 bucket name |

## Deploy to Railway

1. Create a new Railway project
2. Connect this repository (or use Railway CLI)
3. Set the root directory to `scripts/converter`
4. Add the environment variables above
5. Deploy

Railway will automatically build the Docker image and start the service.

## Local Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
npm start
```

## Storage Layout

The converter writes files to R2 with this structure:

```
assets/{assetId}/
  metadata.json           # { totalPages, originalFilename, convertedAt }
  conversion-status.json  # { status, pagesProcessed, totalPages, ... }
  pages/
    page-0001.jpg
    page-0002.jpg
    ...
```
