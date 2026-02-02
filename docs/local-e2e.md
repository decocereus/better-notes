# Local E2E Guide

This doc covers the local, end-to-end flow for BetterNotes, including the
PDF converter service that runs locally during development.

## Required Env (.env.local)

Core:
- `NEXT_PUBLIC_CONVEX_URL`
- `OPENROUTER_API_KEY`
- `NOTION_API_KEY` (optional if you paste in UI; required for server-side fetch)

Storage (R2):
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Local PDF converter:
- `CONVERTER_URL` (e.g. `http://localhost:3000`)
- `CONVERTER_TOKEN` (optional; must match converter if set)

## Local Services

1) Convex (database + functions)
```bash
bunx convex dev
```
If needed, copy the generated `NEXT_PUBLIC_CONVEX_URL` into `.env.local`.

2) PDF Converter (local)
```bash
cd scripts/converter
npm install
npm run dev
```
Notes:
- Requires Poppler (`pdftoppm`). On macOS: `brew install poppler`.
- Uses `R2_*` env vars to read/write assets and conversion status files.

3) App
```bash
cd ../..
bun dev
```

## Local E2E Checklist

Note: If you're running Notion-only, skip the PDF/OCR steps below. UI restriction
to Notion-only is currently manual (owner: user).

1. Create a project and select a theme page (Notion).
2. Add Notion page(s) as sources and process them.
3. (Optional) Upload a PDF and trigger OCR + extraction.
4. (Optional) Confirm extraction completes (asset status shows extraction completed).
5. Run classification for the project (aggregates all completed sources).
6. Run comparison for a theme.
7. Generate notes for a theme.
8. Sync generated notes to Notion.

## Troubleshooting

- OCR pipeline stuck in conversion:
  - Ensure `CONVERTER_URL` is reachable and converter is running.
  - Check R2 credentials and bucket access.
- OCR status always "processing":
  - Verify `assets/{assetId}/conversion-status.json` and `ocr-status.json`
    exist in R2 (converter and OCR pipeline write these files).
- Missing Notion content:
  - Ensure `NOTION_API_KEY` is set and the integration has access to pages.
