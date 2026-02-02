# OCR Pipeline Migration Plan (Railway Converter)

Status: Implemented. Use this doc as reference; see `docs/local-e2e.md` for
local converter run steps.

Goal: replace CloudConvert with a self-hosted PDF → image converter running in a Railway container (Poppler or MuPDF), keep R2 storage and the existing OCR pipeline intact.

## Architecture (Target)
- Trigger: `POST /api/ocr/start` (unchanged entrypoint) requests a conversion job.
- Converter service (Railway): downloads the PDF from R2, runs Poppler/MuPDF, streams page images to `assets/{assetId}/pages/page-XXXX.jpg`, and writes `conversion-status.json` + metadata to R2.
- Next.js API polls the converter status (or waits on the converter response) via `convertPdfToImages`, then proceeds with the existing OCR pipeline on the newly stored page images.
- Storage layout stays the same; OCR + extraction logic remains unchanged.

## Converter Service (Railway)
- Base: Debian-slim image with Poppler (`pdftoppm`) or MuPDF (`mutool draw`).
- Command example: `pdftoppm -jpeg -r 200 /tmp/input.pdf /tmp/page` (adjust DPI/quality).
- Responsibilities:
  - Download PDF from R2 using R2 credentials or a signed read URL.
  - Convert to JPEG/PNG; stream-upload each page to `assets/{assetId}/pages/page-####.jpg` in R2.
  - Maintain `conversion-status.json` (status, pagesProcessed, totalPages, startedAt, completedAt, error).
  - Optionally write `metadata.json` (totalPages, originalFilename, convertedAt).
  - Return a simple JSON response `{ success, totalPages, errors }`.
- API surface (Railway):
  - `POST /convert`: body `{ assetId, sourceKey, dpi?, quality?, format? }`.
  - Optional: `GET /convert/:assetId/status` if we choose to poll instead of waiting on the initial request.
- Environment needed on Railway: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, optional `CONVERTER_TOKEN` for shared-secret auth.

## Next.js Changes
- Replace CloudConvert usage with converter service calls.
- Keep existing `convertPdfToImages` signature so downstream OCR code stays unchanged.
- Add a small HTTP client to call the Railway converter and (if needed) poll status.
- Keep `conversion-status.json` writes centralized (converter writes primary updates; Next.js may read-only).

## File-Level Plan
- `lib/services/pdf-conversion.ts`
  - Remove CloudConvert client logic.
  - Implement `convertPdfToImages` to call the Railway converter (`/convert`) and optionally poll `/status` until done.
  - Keep `getConversionProgress` behavior intact (reads from R2).
  - Add helper to include `CONVERTER_TOKEN` header if configured.
- `app/api/ocr/start/route.ts`
  - Replace `validateCloudConvertConfig` with `validateConverterConfig`.
  - Ensure the start handler queues the job and awaits the converter response (or minimal polling) before launching OCR.
  - Preserve asset status updates (`conversion_queued` → `conversion_processing` → `conversion_completed`/`ocr_*`).
- `lib/env.ts`
  - Remove `CLOUDCONVERT_API_KEY`.
  - Add `CONVERTER_URL` (Railway deployment URL) and `CONVERTER_TOKEN` (optional shared secret).
- `docs/progress.md`
  - Add a note that CloudConvert was removed in favor of the self-hosted Railway converter.
- `docs/learnings.md`
  - Add an entry about Poppler/MuPDF-based conversion (why and how).
- `scripts/` (new)
  - Add `converter/Dockerfile` (Debian-slim + Poppler/MuPDF) and `converter/convert.ts` (Railway worker) to the repo for easy deployment.
  - Include a `README.md` in the converter folder with deploy/run instructions (Railway).

## Implementation Steps (sequence)
1) Add converter service code (Dockerfile + `convert.ts`) under `scripts/converter/`.
2) Update `lib/env.ts` for `CONVERTER_URL`/`CONVERTER_TOKEN`; drop CloudConvert env.
3) Refactor `lib/services/pdf-conversion.ts` to call the new converter service and keep the same return shape.
4) Update `app/api/ocr/start/route.ts` to validate the new converter config and remove CloudConvert dependency.
5) Update docs (`progress.md`, `learnings.md`) to reflect the migration.
6) Test flow with a large PDF: start OCR → confirm pages appear in R2 and OCR runs → check statuses.
7) Run `bun x ultracite fix` to satisfy formatting/lint rules.

## Notes / Defaults
- Use JPEG at 150–200 DPI to balance quality and size for handwritten OCR.
- Stream uploads and delete local temp files to keep disk usage low.
- Keep page numbering zero-padded to 4 digits to match existing storage helpers.
- If Railway idle spins down, expect a cold start; add generous timeouts for the converter HTTP call/polling.
