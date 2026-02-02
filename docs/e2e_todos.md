# E2E Implementation Checklist

Status legend: [ ] pending, [~] in progress, [x] done

Scope: Implement full E2E per `docs/plan.md`. The PDF converter will run locally during development; deploy later.

## Pipeline (Sources → Extraction → Classification → Compare → Notes)

- [x] Aggregate classification across all completed sources for a project (assets + Notion), not just R2 PDFs.
- [x] Persist structured extraction output for Notion sources (match PDF extraction shape).
- [x] Update comparison to consume aggregated classification (topper + user sources).
- [x] Ensure generation uses aggregated comparison + classification for the project.
- [x] Add explicit status transitions and error handling for all pipeline stages (ingest → extract → classify → compare → generate).

## Notion Sources

- [x] Run LLM extraction on Notion content and persist structured output.
- [x] Add a UI trigger to process Notion sources (project page) that calls `/api/sources/process`.
- [x] Include Notion extraction in classification, comparison, and note generation.
- [ ] (Owner: user) Restrict sources to Notion-only in the UI for now.

## Assets / PDF OCR Flow

- [x] Implement `/api/assets/[id]/process` (or update UI) to orchestrate OCR + extraction for an asset.
- [ ] Validate local converter wiring in `/api/ocr/start`, `/api/ocr/status`, `/api/ocr`.
- [x] Pass extraction parameters from Settings into `/api/extract`.

## Settings & Models

- [x] Wire model selection from Settings into server-side AI calls.
- [x] Confirm settings are global (localStorage) and apply across all projects (documented in Local E2E doc).
- [x] Implement strategy doc extraction flow (use `strategyPageId` to auto-populate parameters/themes).

## UI & UX

- [x] Create per-theme comparison page `app/themes/[id]/compare/page.tsx`.
- [x] Wire `components/classification-review.tsx` into the workflow.
- [x] Show pipeline status + retry actions on `app/projects/[id]/page.tsx`.
- [x] Surface Notion source processing status in the workflow and block classification until sources finish.

## Data / DB Consistency

- [x] Ensure `contentSources` can store structured extraction output (schema update if needed).
- [x] Align asset/source completion rules with “classification should aggregate all completed assets for a project.”
- [ ] Add any required backfills/migrations for new fields.

## Local Converter (Dev Only)

- [x] Document local converter startup steps and required env vars.
- [ ] Verify local OCR → extraction roundtrip with a sample PDF.

## Testing / Validation

- [ ] Add integration tests for Notion extraction + classification aggregation.
- [x] Create a local E2E checklist (Notion → classify → compare → generate → sync).
- [x] Run `bun x ultracite check` and `bun run test` before E2E validation.

## Docs / Plan Alignment

- [x] Update `docs/plan.md` sprint status to reflect current implementation (validation pending).
- [x] Refresh `docs/progress.md` current status and note E2E validation gaps.
- [x] Add/update a “Local E2E” doc with env vars and flow steps.
