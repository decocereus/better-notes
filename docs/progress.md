# Progress

Track completed work, current status, and next steps.

## Current Status

**End-to-End Pipeline (Notion → Classify → Compare → Generate)** ✅ Implemented
**Local Converter Integration** ✅ Implemented (validation pending)
**E2E Validation Gaps:** Local converter wiring check, sample PDF run, integration tests, backfills (see `docs/e2e_todos.md`)
**Build Status:** ✅ Passing (`bun run build`)
**Tests:** ✅ 172 passing (`bun run test`)

---

## 2026-02-06: Project Page Overhaul

### Sprint A: Data Persistence Layer (completed)
- Added 3 new Convex tables: `classificationJobs`, `comparisonResults`, `generatedNotes`
- Created CRUD functions for each table with proper indexes
- Wired `/api/classify`, `/api/compare`, `/api/generate` routes to persist results to Convex on completion
- Updated `project-workflow.tsx` to load persisted state from Convex instead of localStorage

### Sprint B: Project Page UX (completed)
- Created `PipelineStepper` component — horizontal progress indicator for 5 pipeline stages
- Integrated stepper into project detail page with scroll-to-section navigation
- Created `EditProjectDialog` and enabled the previously disabled Edit button
- Added search input to projects list page with client-side filtering
- Added `sonner` toast notifications for classification/comparison completions

### Sprint C: Features (completed)
- Added "Process All" bulk processing button for pending/failed sources
- Created export utilities (`lib/utils/export.ts`) and `ExportMenu` component
- Added "From Library" tab to add source dialog for asset reuse across projects
- Added toast notifications to retry failed items flow

### Sprint D: Testing & Polish (completed)
- All lint/typecheck passes with 0 errors
- Component tests for PipelineStepper, ExportMenu
- Unit tests for export utilities
- No Convex function tests (no convex-test infrastructure — noted as tech debt)

---

## E2E Pipeline Status (2026-02-02) - Implemented, Validation Pending

Core pipeline flows (Notion sources → extraction → classification → comparison → note generation → Notion sync)
are implemented. Remaining validation steps are tracked in `docs/e2e_todos.md`, including local converter wiring,
sample PDF roundtrip, integration tests for Notion aggregation, and any backfills/migrations.

---

## Chunked Essay Processing (2026-01-27) - Complete

**Problem:** When processing large PDFs (1400+ pages), users experienced gaps in essay extraction - not all essays were being extracted. The existing parallel processing didn't have retry logic, so failed batches resulted in permanently lost essays.

**Solution:** New chunked processor with robust error handling, retry logic, and comprehensive gap detection.

### Key Features

1. **Chunked Processing**: Groups essays into chunks (15 essays/chunk) for better error isolation
2. **Retry Logic**: Each chunk retried up to 2 times with exponential backoff
3. **Gap Detection**: Identifies pages not covered by any detected essay
4. **Comprehensive Logging**: Detailed stats on success/failure rates, retries, and coverage
5. **Large PDF Validation**: Warnings when essay count seems suspiciously low

### Architecture

- PDFs ≤ 500 pages: Standard parallel processing
- PDFs > 500 pages: Chunked processing with retry logic
- Boundary detection: Retry failed 50-page batches
- Extraction: Process 15-essay chunks with per-chunk retry

### Files Added/Modified

- `lib/extraction/chunked-processor.ts` - New chunked processor (NEW)
- `lib/extraction/essay-detector.ts` - Added batch retry logic
- `lib/extraction/index.ts` - Export new functions
- `app/api/extract/route.ts` - Use chunked processor for large PDFs

### Usage

For PDFs > 500 pages, chunked processing is automatic via `/api/extract`:

```typescript
const { results, stats } = await processEssaysInChunks(
  ocrResults,
  parameters,
  sourceRef,
  { essaysPerChunk: 15, maxRetries: 2 }
);
// stats includes: successful, failed, retried, gaps, errors
```

---

## Extraction Quality & Parallelization (2026-01-27) - Complete

**Problem:** Extraction output had poor field usage (field names as content, usage guidance in wrong fields) and sequential processing was slow for 200-500+ essays. Additionally, large PDFs (1300+ pages) were only partially processed because all pages were sent to the LLM in a single boundary detection prompt.

**Solution:** Three-phase fix: (1) Few-shot examples for field quality, (2) Parallel batch extraction, (3) Chunked boundary detection.

### Phase 1: Prompt Improvements
- Added concrete few-shot examples showing CORRECT field usage
- Added WRONG examples to prevent common mistakes
- Clarified field purposes: content = headline, verbatimText = exact quote, detailsMarkdown = usage guidance
- Reinforced quality-over-quantity principle

### Phase 2: Parallel Extraction
- `extractContentBatch()` now processes essays in parallel batches
- Default concurrency: 3, max: 5 (to avoid rate limits)
- Uses `Promise.allSettled` for partial success handling
- Falls back to sequential for small batches
- Maintains result ordering despite parallel execution

### Phase 3: Chunked Boundary Detection
- `detectEssayBoundaries()` now splits large PDFs into 50-page batches
- Batches overlap by 5 pages to detect essays at boundaries
- Processes batches in parallel (concurrency: 3)
- Merges results, handling duplicate/overlapping essays from overlap regions
- Ensures all 1300+ pages are now processed instead of just ~900

### Files Modified
- `lib/llm/prompts/extraction.ts` - Few-shot examples in system prompt
- `lib/extraction/content-extractor.ts` - Parallel batch processing
- `lib/extraction/essay-detector.ts` - Chunked boundary detection for large PDFs

---

## Extracted Content Browser UI Redesign (2026-01-27) - Complete

**Problem:** The extracted content browser was cramped, markdown wasn't rendering properly, and metadata badges cluttered the view with repetitive text labels.

**Solution:** Complete UI redesign with scholarly/editorial aesthetic featuring three-level collapsible hierarchy and proper markdown rendering.

### Changes
- Three-level collapsible hierarchy: Essays → Content Type Sections → Individual Items
- Markdown rendering via ai-elements `MessageResponse` (Streamdown)
- Generous spacing with `space-y-6` between essays, `py-4` between items
- Blockquote styling for verbatim text with left border accent
- Subtle metadata indicators: colored dots for quality, small icons for multi-use/overused
- shadcn `Collapsible` components with `Button` triggers throughout

### Files Modified
- `components/extracted-content-browser.tsx` - Complete rewrite

---

## Patterns Library UX + Markdown Summaries (2026-01-26) - Complete

**Problem:** Pattern cards were unclear and sometimes contained metadata lines as items. The UI lacked context, and there was no easy way to rerun extraction after prompt/schema tweaks.

**Solution:** Keep JSON as the source of truth, add markdown summaries per content type for UX, and render highlights via ai-elements. Added a re-extract dialog that reruns extraction using existing OCR.

### Updates
- Extraction output includes `sections[]` with markdown summaries per content type.
- Patterns page renders “Highlights” per type using ai-elements `MessageResponse`.
- Cards show snippet + usage context, plus source and essay badges.
- Re-extract dialog on `/patterns` to rerun extraction without re-OCR.
- `/api/patterns?includeItems=false` provides a lightweight summary for other pages.

---

## Self-Hosted PDF Converter Migration (2026-01-25) - Complete

**Problem:** CloudConvert is a paid third-party service with usage limits and costs. For large PDF processing (500MB+, 1300+ pages), a self-hosted solution is more economical and reliable.

**Solution:** Replaced CloudConvert with a self-hosted Railway converter service using Poppler's `pdftoppm` for PDF-to-JPEG conversion.

### Architecture

```
PDF Upload → Railway Converter (Poppler pdftoppm) → R2 Storage
    → Downloads PDF from R2
    → Converts pages to JPEG (150 DPI, 85% quality)
    → Uploads page images to R2
    → Writes conversion-status.json
    → OCR pipeline continues as before
```

### Files Created

- `scripts/converter/Dockerfile` - Debian-slim + Poppler image for Railway
- `scripts/converter/convert.ts` - HTTP server with /convert and /status endpoints
- `scripts/converter/package.json` - Dependencies for S3 client and TypeScript
- `scripts/converter/tsconfig.json` - TypeScript configuration
- `scripts/converter/README.md` - Deployment and usage documentation

### Files Modified

- `lib/env.ts` - Replaced `CLOUDCONVERT_API_KEY` with `CONVERTER_URL` and `CONVERTER_TOKEN`
- `lib/services/pdf-conversion.ts` - Complete rewrite to call Railway converter service
- `app/api/ocr/start/route.ts` - Updated to use `validateConverterConfig`

### Environment Variables Required

```env
CONVERTER_URL=https://your-converter.railway.app  # Railway deployment URL
CONVERTER_TOKEN=xxx                                # Optional shared secret
```

### Deployment

1. Create new Railway project
2. Set root directory to `scripts/converter`
3. Add R2 environment variables (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME)
4. Optionally add CONVERTER_TOKEN for authentication
5. Deploy - Railway auto-builds from Dockerfile

---

## OCR Pipeline Redesign (2026-01-23) - Complete

**Problem:** Large PDFs (500MB+, 1300+ pages) fail to process because Google's PDF limit is 50MB and OpenRouter has a 5MB file size limit.

**Solution:** Convert PDF to page images first, then OCR each image independently with multi-model fallback (Gemini Flash primary → Claude Sonnet for retries).

### Architecture

```
PDF Upload → Railway Converter (PDF-to-images) → R2 Storage
    → Gemini Flash (parallel OCR, 10 pages at a time)
    → Quality Check (confidence, word count, illegible ratio)
    → Claude Sonnet retry (low-quality pages)
    → Extraction Pipeline
```

### Files Created

**Types:**
- `types/ocr.ts` - PageOcrResult, ConversionStatus, OcrStatus, RetryThresholds, AssetOcrResults, OcrPipelineProgress

**Storage Helpers:**
- `lib/storage/page-images.ts` - List/read page images from R2
- `lib/storage/ocr-results.ts` - Read/write per-page JSON results

**OCR Service:**
- `lib/ai/models.ts` - Model selection (Gemini Flash, Claude Sonnet)
- `lib/ai/retry-logic.ts` - Quality thresholds, retry decision logic
- `lib/ai/ocr.ts` - Complete rewrite for page-image OCR

**PDF Conversion:**
- `lib/services/pdf-conversion.ts` - CloudConvert API client

**API Routes:**
- `app/api/ocr/start/route.ts` - Trigger full pipeline (conversion + OCR)
- `app/api/ocr/status/route.ts` - Progress polling endpoint
- `app/api/ocr/retry/route.ts` - Manual retry endpoint
- `app/api/ocr/results/route.ts` - Fetch results (single page or combined)

**Tests:**
- `lib/ai/__tests__/retry-logic.test.ts` - 22 tests for retry logic

### Files Modified

- `types/asset.ts` - Added conversion_* status values
- `convex/schema.ts` - Added conversion status values to schema
- `convex/assets.ts` - Added conversion status values to validator
- `lib/env.ts` - Added ANTHROPIC_API_KEY, CLOUDCONVERT_API_KEY
- `app/api/ocr/route.ts` - Updated to support both legacy and new pipeline
- `app/api/extract/route.ts` - Updated to read from per-page OCR format
- `components/processing-status-badge.tsx` - Added conversion status UI

### R2 Storage Structure

```
assets/{assetId}/
  metadata.json                    # Page count, dimensions
  conversion-status.json           # { status, pagesProcessed, totalPages }
  ocr-status.json                  # { status, pagesProcessed, retriedCount }
  pages/
    page-0001.jpg                  # Converted images
    page-0002.jpg
    ...
  ocr/
    page-0001.json                 # Per-page OCR results
    page-0002.json
    ...
```

### Retry Thresholds

```typescript
const DEFAULT_RETRY_THRESHOLDS = {
  minWordCount: 30,        // Retry if < 30 words
  maxIllegibleRatio: 0.15, // Retry if > 15% illegible
  minConfidence: 0.7,      // Retry if confidence < 70%
};
```

### Environment Variables Required

```env
CONVERTER_URL=xxx             # Self-hosted Railway converter URL
CONVERTER_TOKEN=xxx           # Optional shared secret for converter
ANTHROPIC_API_KEY=xxx         # For Claude Sonnet fallback
GOOGLE_GENERATIVE_AI_API_KEY=xxx  # For Gemini Flash primary
```

---

## Bug Fix: OpenRouter 5MB File Limit (2026-01-23) - Complete

**Problem:** OCR pipeline failed for large PDFs (190MB) because OpenRouter downloads files before forwarding them to the underlying model, enforcing a 5MB file size limit.

**Solution:** Use `@ai-sdk/google` directly for PDF OCR to bypass OpenRouter. Download PDF to buffer and pass directly to Gemini 2.5 Flash.

**Files Modified:**
- `lib/env.ts` - Added `GOOGLE_GENERATIVE_AI_API_KEY` environment variable
- `lib/ai/ocr.ts` - Rewrote `performDirectPdfOcr` to download PDF and pass as buffer to Gemini
- `components/asset-card.tsx` - Added "Retry Processing" button for failed assets

**Key Change:**
```typescript
// Before (fails for files >5MB):
const model = getModel("OCR");  // Goes through OpenRouter

// After (supports large files):
const { google } = require("@ai-sdk/google");
const model = google("gemini-2.5-flash");

// Download PDF and pass as buffer
const pdfResponse = await fetch(pdfUrl);
const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

const result = await generateText({
  model,
  system: PDF_OCR_SYSTEM_PROMPT,
  messages: [{
    role: "user",
    content: [
      { type: "text", text: userPrompt },
      { type: "file", data: pdfBuffer, mediaType: "application/pdf" },
    ],
  }],
});
```

**Setup Required:**
- Add `GOOGLE_GENERATIVE_AI_API_KEY` to `.env.local`

**UI Enhancement:**
- Added retry button on asset card for failed assets - displays below error message with "Retry Processing" label

---

## Sprint 14 - Global Asset Library & Automated Processing Pipeline (2026-01-23) - Complete

### Overview

Built a global asset library that tracks ALL uploads in Convex with an automated processing pipeline: **Upload → OCR → Pattern Extraction → Persistent Storage**.

**Problems Solved:**
1. Unassigned files no longer lost - Files uploaded without a project now have database records
2. Global view available - Can see all uploaded files across the system at `/assets`
3. Automated pipeline - OCR and extraction triggered automatically after upload
4. Persistent patterns - Extracted patterns stored in Convex, not localStorage

### Files Created

**Types:**
- `types/asset.ts` - AssetProcessingStatus, Asset, AssetStats, ExtractionResultMetadata types with helper functions

**Convex Schema & Functions:**
- `convex/schema.ts` - Added `assets` and `extractionResults` tables with indexes
- `convex/assets.ts` - CRUD operations: list, get, getByKey, getStats, create, assignToProject, updateStatus, remove, listByProject
- `convex/extractionResults.ts` - create, getByAsset, list, removeByAsset functions

**API Routes:**
- `app/api/assets/route.ts` - GET (list with filters), POST (create after upload with autoProcess)
- `app/api/assets/[id]/route.ts` - GET (with preview URL), PATCH (assign to project), DELETE (remove from Convex + R2)
- `app/api/assets/[id]/process/route.ts` - POST (trigger OCR → extraction pipeline)

**UI Components:**
- `components/processing-status-badge.tsx` - Status indicator with colors/icons per status
- `components/asset-card.tsx` - Asset display card with actions dropdown
- `components/assign-asset-dialog.tsx` - Project assignment dialog
- `components/asset-detail-dialog.tsx` - Asset details view with preview and extraction results
- `components/assets-content.tsx` - Main content with stats cards, filters, asset grid
- `app/assets/page.tsx` - Assets page (Server Component)

**Migration:**
- `scripts/migrate-unassigned-files.ts` - Creates asset records for existing R2 files

### Files Modified

- `app/api/ocr/route.ts` - Added `assetId` and `autoExtract` params, updates asset status after OCR
- `app/api/extract/route.ts` - Added `assetId` param, updates asset status and creates extractionResults record
- `components/upload-zone.tsx` - Added `autoProcess` prop, creates asset record after R2 upload
- `components/layout/sidebar.tsx` - Added Assets nav item with FolderOpen icon

### Processing Pipeline Flow

```
User uploads file → UploadZone → R2 (signed URL)
       ↓
POST /api/assets (create record, autoProcess=true)
       ↓
POST /api/assets/[id]/process
       ↓
POST /api/ocr (with assetId, autoExtract=true)
       ↓
[Background] OCR processing
       ↓
Update asset: status=ocr_completed, ocrWordCount
       ↓
[Auto] POST /api/extract (with assetId, ocrJobId)
       ↓
[Background] Extraction processing
       ↓
Update asset: status=extraction_completed, extractedItemCount
       ↓
Create extractionResults record in Convex
       ↓
Available in /assets UI and /patterns page
```

### Asset Processing States

```typescript
type AssetProcessingStatus =
  | "pending"
  | "ocr_queued"
  | "ocr_processing"
  | "ocr_completed"
  | "ocr_failed"
  | "extraction_queued"
  | "extraction_processing"
  | "extraction_completed"
  | "extraction_failed";
```

### Key Features

- Automatic pipeline: Upload PDF → OCR starts automatically → Extraction starts after OCR completes
- Asset library UI with stats cards (total, unassigned, processing, completed)
- Filters by status and assignment
- Search by filename
- Assign/unassign assets to projects
- View asset details with preview and extraction results
- Delete assets (removes from both Convex and R2)
- Migration script for existing R2 files

---

## Sprint 13 - Multi-Theme Pages (2026-01-23) - Complete

### Sprint 13.2: API & Settings Cleanup ✅ Completed

**Goal:** Remove global themePageId from settings, update components to use Convex

**Completed Tasks:**
- [x] 13.2.1: Removed themePageId/themePageTitle from AppSettings type
- [x] 13.2.2: Updated API routes to get theme data from Convex (classify, themes routes)
- [x] 13.2.3: Updated settings-client-wrapper.tsx to check Notion connection via API
- [x] 13.2.4: Updated parameters-content.tsx to check connection via API
- [x] 13.2.5: Rewrote dashboard-stats.tsx to aggregate stats from all theme pages in Convex
- [x] 13.2.6: Rewrote themes-content.tsx to list theme pages from Convex
- [x] 13.2.7: Updated global-compare-content.tsx to show "select project" message
- [x] 13.2.8: Updated theme-compare-content.tsx to show "select project" message
- [x] 13.2.9: Updated theme-detail-content.tsx to show "select project" message
- [x] 13.2.10: Updated dashboard-content.tsx SetupWizard to use API and Convex
- [x] 13.2.11: Updated classification-workflow.tsx to accept themePageId as required prop
- [x] 13.2.12: Fixed all TypeScript errors from removed settings properties
- [x] 13.2.13: Updated tests to use proper mocks for API calls and Convex queries

**Key Changes:**
- Notion connection now checked via `/api/notion/connect` API (returns `{ valid: boolean }`)
- Theme pages now fetched from Convex via `useQuery(api.themePages.list)`
- Dashboard stats aggregate from ALL theme pages (not just one global page)
- Compare/detail pages show "Select a Project" since themes are per-project
- ClassificationWorkflow now requires `themePageId` prop (not from settings)

### Sprint 13.1: Schema & Convex Functions ✅ Completed

**Goal:** Set up database foundation for multi-theme pages

**Completed Tasks:**
- [x] 13.1.1: Updated `convex/schema.ts` - added themePages table with notionPageId, title, themes array, stats object, lastSyncedAt, createdAt; added themePageId reference to projects; added indexes
- [x] 13.1.2: Created `convex/themePages.ts` - list, get, getByNotionId, create, sync, remove functions
- [x] 13.1.3: Updated `convex/projects.ts` - added themePageId to create mutation, added listByThemePage query, updated update mutation to support themePageId
- [x] 13.1.4: Deleted existing projects (clean slate migration)
- [x] 13.1.5: Deployed schema changes with `bunx convex dev`

**Additional Changes (to fix TypeScript errors):**
- [x] Updated `components/create-project-dialog.tsx` - added theme page selector dropdown with useQuery for theme pages list
- [x] Updated `biome.jsonc` - added override for convex/ directory to use camelCase filenames (Convex requirement)

**Key Schema Changes:**
```typescript
// New themePages table
themePages: defineTable({
  notionPageId: v.string(),
  title: v.string(),
  themes: v.array(v.any()),  // MainTheme[]
  stats: v.object({
    mainThemes: v.number(),
    miniThemes: v.number(),
    questions: v.number(),
    yearRange: v.optional(v.object({ min: v.number(), max: v.number() })),
  }),
  lastSyncedAt: v.string(),
  createdAt: v.string(),
})

// Modified projects table
projects: defineTable({
  ...existing fields,
  themePageId: v.id("themePages"),  // Required reference
})
```

### Sprint 13.6: Testing & Cleanup ✅ Completed

**Goal:** Final testing, bug fixes, and cleanup

**Completed Tasks:**
- [x] 13.6.1: Created `components/ui/alert.tsx` - Alert, AlertTitle, AlertDescription components
- [x] 13.6.2: Updated `types/project.ts` - Added `themePageId` to Project interface
- [x] 13.6.3: Fixed namespace import lint error in alert.tsx
- [x] 13.6.4: Verified all TypeScript errors resolved (`bun run check` passes)
- [x] 13.6.5: Verified all tests pass (`bun run test`)

### Sprint 13.5: Project Creation Flow ✅ Completed

**Goal:** Update project creation and detail views for required theme page selection

**Completed Tasks:**
- [x] 13.5.1: Updated `components/add-theme-page-dialog.tsx` - Made controllable with `open`/`onOpenChange` props
- [x] 13.5.2: Updated `components/create-project-dialog.tsx` - Integrated controlled AddThemePageDialog, inline "Add new theme page" option
- [x] 13.5.3: Updated `components/project-detail-content.tsx` - Added missing theme page warning with reassignment dropdown
- [x] 13.5.4: Added theme page info card when theme is valid

**Key Changes:**
- AddThemePageDialog supports both trigger-based and controlled modes
- Project creation shows inline "Add new theme page" option when no theme pages exist
- Project detail shows warning when theme page was deleted with option to select another
- Theme page info card displays stats and links to theme detail page

### Sprint 13.4: Theme Page Detail UI ✅ Completed

**Goal:** Build theme page detail view with resync and delete functionality

**Completed Tasks:**
- [x] 13.4.1: Rewrote `components/theme-detail-content.tsx` - Complete rewrite with Convex integration
- [x] 13.4.2: Added resync functionality - Fetches latest from Notion and updates Convex
- [x] 13.4.3: Added delete functionality with affected projects warning
- [x] 13.4.4: Added theme tree display with stats

**Key Features:**
- Resync button fetches theme hierarchy from Notion API and updates Convex
- Delete with confirmation dialog showing list of affected projects
- Theme tree with MainTheme → MiniTheme → Questions hierarchy
- Stats display (main themes, mini themes, questions, year range)

### Sprint 13.3: Theme Pages List UI ✅ Completed

**Goal:** Build theme pages list with add/sync/delete capabilities

**Completed Tasks:**
- [x] 13.3.1: Created `components/theme-page-card.tsx` - Card component for theme page display
- [x] 13.3.2: Created `components/add-theme-page-dialog.tsx` - Dialog for adding theme pages from Notion
- [x] 13.3.3: Created `app/api/notion/check-duplicate/route.ts` - API for duplicate detection
- [x] 13.3.4: Updated `components/themes-content.tsx` - Integrated new components

**Files Created:**
- `components/theme-page-card.tsx` - Card with title, stats, last synced time, click to navigate
- `components/add-theme-page-dialog.tsx` - Multi-step flow: search → parsing → confirm → save
- `app/api/notion/check-duplicate/route.ts` - Checks if Notion page already exists as theme page

**Key Features:**
- Theme page cards show title, stats (main themes, questions), last synced time
- Add theme page dialog with Notion page search and duplicate prevention
- Multi-step flow with parsing preview before saving
- Cards link to theme detail page

---

## Bug Fixes & Feature: Content Source Processing (2026-01-23) ✅ Completed

### Bug Fixes

**1. DOMMatrix/pdf.js SSR Build Error**
- **Problem:** Build failed with "ReferenceError: DOMMatrix is not defined" in `/api/ocr` route
- **Solution:** Changed to dynamic imports with legacy build (`pdfjs-dist/legacy/build/pdf.mjs`)
- **File:** `lib/pdf/stream.ts`

**2. Select.Item Empty Value Error**
- **Problem:** Radix UI Select threw error for empty string value in project selector
- **Solution:** Changed empty value to "none" with proper handling
- **File:** `components/upload-content.tsx`

**3. Dashboard Stats API 405 Error**
- **Problem:** Dashboard stats tried to fetch themes API with wrong method
- **Solution:** Updated to use GET request with query params
- **File:** `components/dashboard-stats.tsx`

**4. Theme Parser Not Finding Themes**
- **Problem:** Theme page used `bulleted_list_item` blocks with children instead of `toggle` blocks
- **Solution:** Added support for bulleted_list_item as main/mini theme containers
- **File:** `lib/notion/theme-parser.ts`

**5. Source Processing Invalid URL Error**
- **Problem:** Processing route received full Notion URLs but API expects page IDs
- **Solution:** Added `extractPageId()` helper to handle URLs, UUIDs, and raw IDs
- **File:** `app/api/sources/process/route.ts`

### New Feature: Content Source Processing

**Problem:** Content sources added to projects stayed at "Pending" status forever. Also, the UX was inconsistent - other pages allowed searching Notion pages, but add source dialog required pasting URLs.

**Solution:**
1. Replaced URL input with NotionPageSearch component for consistent UX
2. Created processing pipeline that extracts content from Notion pages
3. Added Process/Retry buttons for manual processing control

**Files Created:**
- `app/api/sources/process/route.ts` - API endpoint for processing content sources
  - Fetches Notion page content recursively
  - Extracts text from all block types (paragraphs, headings, lists, code, quotes, etc.)
  - Updates source status via Convex mutations
  - Handles URLs, UUIDs, and raw page IDs
- `lib/utils/logger.ts` - Structured logging utility with log levels

**Files Modified:**
- `components/add-source-dialog.tsx` - Replaced URL input with NotionPageSearch
  - Auto-triggers processing after adding source
  - Stores page ID as reference instead of URL
- `components/source-list.tsx` - Added processing controls
  - Extracted SourceItem and ProcessButton components
  - Shows Process button for pending sources
  - Shows Retry button for failed sources
  - Displays character count for completed sources
- `components/project-detail-content.tsx` - Added projectId prop to SourceList
- `types/project.ts` - Added metadata field to ContentSource interface
- `lib/notion/client.ts` - Added appendChildren() and deleteBlock() methods
- `app/api/themes/route.ts` - Added GET endpoint support

**Key Features:**
- Notion page search for consistent UX across the app
- Recursive content extraction (handles nested blocks)
- Status tracking: pending → processing → completed/failed
- Manual Process/Retry controls
- Shows extracted content character count
- Error display for failed sources

---

## Bug Fix: DOMMatrix/pdf.js SSR Issue (2026-01-23) ✅ RESOLVED

**Problem:** Build failed with "ReferenceError: DOMMatrix is not defined" in `/api/ocr` route. This was a pre-existing issue from Sprint 8.

**Root Cause:** `pdfjs-dist` uses browser-only APIs (`DOMMatrix`) that don't exist in Node.js. The module was imported at the top level, causing the error during Next.js build when it evaluated the imports.

**Solution:**
- Changed from top-level imports to **dynamic imports** with module caching
- Used the **legacy build** (`pdfjs-dist/legacy/build/pdf.mjs`) for server-side processing
- The legacy build is designed for Node.js and doesn't use `DOMMatrix`

**Files Modified:**
- `lib/pdf/stream.ts` - Added `getPdfjs()` async helper with dynamic import

**Key Code Change:**
```typescript
// Before (broken):
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// After (working):
async function getPdfjs() {
  if (typeof window === "undefined") {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return await import("pdfjs-dist");
}
```

### Remaining Notes

- Pre-existing lint issues in example files (component-example.tsx, some shadcn components) - these are template files

---

## Sprint 12 - Note Generation & Notion Sync (2026-01-23) ✅ Completed

**Goal:** Generate dual-section notes (Your Notes + Topper Insights) and sync to Notion

**Completed Tasks:**
- [x] 12.1: Create generation types (types/generation.ts)
- [x] 12.2: Create generation prompts (lib/llm/prompts/generation.ts)
- [x] 12.3: Create note generator (lib/generation/note-generator.ts)
- [x] 12.4: Create conciseness enforcer (lib/generation/conciseness.ts)
- [x] 12.5: Create Notion block builder (lib/notion/block-builder.ts)
- [x] 12.6: Create Notion destination config (settings UI)
- [x] 12.7: Create Notion sync API (app/api/notion/sync/route.ts)
- [x] 12.8: Create generate API route (app/api/generate/route.ts)
- [x] 12.9: Create notes preview component (components/revision-note.tsx)
- [x] 12.10: Create sync status component (components/sync-status.tsx)
- [x] 12.11: Integrate notes into theme page
- [x] 12.12: Create notes list page

**Lint fixes applied:**
- Moved regex patterns to top-level constants for performance
- Replaced nested ternaries with render functions
- Used content-based keys instead of array indices
- Used aria-hidden for decorative emoji elements
- Added block statements to single-line returns
- Fixed useEffect dependencies by moving useCallback above dependent effects

---

### Sprint 11 Completed (2026-01-23)

All Sprint 11 tasks completed and verified with typecheck and lint.

**Completed Tasks:**
- [x] 11.1: Create comparison types (types/comparison.ts)
- [x] 11.2: Create comparison prompts (lib/llm/prompts/comparison.ts)
- [x] 11.3: Create gap analyzer (lib/comparison/gap-analyzer.ts)
- [x] 11.4: Create suggestion generator (lib/comparison/suggestions.ts)
- [x] 11.5: Create compare API route (app/api/compare/route.ts)
- [x] 11.6: Create comparison results component (components/comparison-results.tsx)
- [x] 11.7: Create per-theme comparison page (app/themes/[id]/compare/page.tsx)
- [x] 11.8: Create global comparison view (components/global-compare-content.tsx)

**Lint fixes applied:**
- Added helper function `calculateCoveragePercent()` to replace nested ternaries
- Refactored `summarizeContentForPrompt()` into smaller functions: `formatItemFlags()`, `formatContentItem()`, `groupContentByType()`
- Fixed `export from` pattern for re-exported constants
- Extracted `getPriorityBadgeVariant()` and `ThemeResultCardStatus()` components to eliminate nested ternaries
- Converted recursive polling to while-loop pattern for reduced complexity
- Added block statements to all single-line if returns

---

## Completed Work

### Sprint 12 - Note Generation & Notion Sync (2026-01-23) - Completed

**Demo:** Users can generate dual-section revision notes (Your Notes + Topper Insights) from classified content. Notes enforce word limits (350 for Your Notes, 300 for Topper Insights) using LLM-based condensation. Generated notes can be synced to a configured Notion page, with bulk sync support for multiple notes.

**Files Created:**
- `types/generation.ts` - Types for GeneratedNote, NoteSection, NoteItem, SyncResult, SyncStatus
- `lib/llm/prompts/generation.ts` - System prompts for note generation and condensation
- `lib/llm/schemas/generation.ts` - Zod schemas for structured LLM note output
- `lib/generation/note-generator.ts` - Main note generation with dual-section format
- `lib/generation/conciseness.ts` - Word limit enforcement with LLM-based condensation
- `lib/generation/index.ts` - Barrel export for generation module
- `lib/notion/block-builder.ts` - Convert GeneratedNote to Notion block format
- `app/api/generate/route.ts` - POST endpoint to generate notes for a theme
- `app/api/notion/sync/route.ts` - POST endpoint to sync notes to Notion
- `app/api/notion/page/[pageId]/route.ts` - GET endpoint for page info
- `components/revision-note.tsx` - Note preview with dual-section display
- `components/sync-status.tsx` - Sync status display, button, badge, bulk sync
- `components/note-generation-panel.tsx` - Generation panel for theme pages
- `components/notion-destination-config.tsx` - Output page search and selection
- `components/notes-list-content.tsx` - Notes list with search, filter, bulk sync
- `app/notes/page.tsx` - Notes list page route

**Files Modified:**
- `lib/notion/client.ts` - Added appendChildren() and deleteBlock() methods
- `app/api/notion/search/route.ts` - Added GET endpoint for search with query params
- `app/settings/page.tsx` - Updated to use SettingsClientWrapper
- `components/theme-detail-content.tsx` - Added NoteGenerationPanel for mini themes

**Key Features:**
- Dual-section note format: "Your Notes" (user content, 350 words max) + "Topper Insights" (topper additions, 300 words max)
- LLM-based note generation using Claude via structured output
- Word limit enforcement with intelligent condensation
- Cross-theme references flagged for multi-use content
- Sync to Notion with append/replace modes
- Bulk sync for multiple notes with progress tracking
- Search and filter notes by theme
- Notes grouped by main theme
- Copy section content to clipboard
- Sync status tracking (not_synced, syncing, synced, failed)

**Architecture:**
- Uses Vercel AI SDK `generateObject` with Zod schemas for type-safe LLM output
- Notes include version tracking for regeneration
- Notion blocks include headers, dividers, bullet lists, and callouts
- Settings store output page ID for sync destination
- Generation panel integrated into mini theme detail view

---

### Sprint 11 - Comparison & Gap Analysis (2026-01-23) - Completed

**Demo:** User content can be compared against topper content per theme. Gap analysis identifies what content types, example categories, or quality levels the user is missing. Suggestions are generated with actionable improvement recommendations. Results display with coverage charts, gap severity badges, and expandable details.

**Files Created:**
- `types/comparison.ts` - Types for comparison results, gaps, suggestions, coverage stats
- `lib/llm/prompts/comparison.ts` - System prompts for gap analysis and readiness assessment
- `lib/llm/schemas/comparison.ts` - Zod schemas for structured comparison output
- `lib/comparison/gap-analyzer.ts` - Core gap analysis with LLM and statistical fallback
- `lib/comparison/suggestions.ts` - Suggestion generation based on gaps
- `lib/comparison/index.ts` - Barrel export for comparison module
- `app/api/compare/route.ts` - POST to start comparison job, GET for status/results
- `components/comparison-results.tsx` - Coverage charts, gaps list, suggestions display
- `components/theme-compare-content.tsx` - Per-theme comparison UI with job controls
- `components/global-compare-content.tsx` - Global comparison across all themes
- `app/themes/[id]/compare/page.tsx` - Per-theme comparison page
- `app/compare/page.tsx` - Global comparison page (updated)

**Files Modified:**
- `types/processing.ts` - Added "comparison" to ProcessingJobType

**Key Features:**
- Gap analysis using Claude Sonnet via structured output
- Coverage statistics by content type and example category
- Gap severity levels: high, medium, low
- Suggestion types: add (new content), improve (quality), diversify (categories)
- LLM-generated reasoning for gaps and suggestions
- Fallback to statistical gap analysis if LLM fails
- Score calculation with configurable weights (coverage, quality, diversity)
- Global comparison runs all themes sequentially
- Export comparison report as JSON
- Expandable gap and suggestion items with reference content

**Architecture:**
- Uses Vercel AI SDK `generateObject` with Zod schemas for type-safe LLM output
- Comparison jobs stored in `processing/{jobId}/comparison-results.json`
- Polling-based job status with configurable timeout
- Classification job ID stored in localStorage for cross-page access

---

### Sprint 10 Completed (2026-01-23)

All Sprint 10 tasks completed and verified with typecheck and lint.

**Completed Tasks:**
- [x] 10.1: Create classification prompts (lib/llm/prompts/classification.ts)
- [x] 10.2: Create classification schemas (lib/llm/schemas/classification.ts)
- [x] 10.3: Create classifier (lib/classification/classifier.ts)
- [x] 10.4: Create cross-theme handler (lib/classification/cross-theme.ts)
- [x] 10.5: Create content aggregator (lib/classification/aggregator.ts)
- [x] 10.6: Create user content fetcher (lib/notion/content-fetcher.ts)
- [x] 10.7: Create classify API route (app/api/classify/route.ts)
- [x] 10.8: Create classification review component (components/classification-review.tsx)
- [x] 10.9: Create theme content view (components/theme-detail-content.tsx)
- [x] 10.10: Integrate classification into workflow (components/classification-workflow.tsx)

**Lint fixes applied:**
- Added default case to switch statements in aggregator.ts
- Removed unused variable `aggregatedIds` in aggregator.ts
- Changed async function to sync returning Promise in classifier.ts
- Moved regex patterns to top-level constants in content-fetcher.ts
- Extracted helper functions to reduce cognitive complexity (getStatusBgColor, getStatusTitle, getRelevanceColor, etc.)
- Replaced nested ternaries with helper functions
- Fixed non-null assertions with proper null checks

---

## Completed Work

### Sprint 10 - Theme Classification (2026-01-23) - Completed

**Demo:** Extracted content from topper essays can be classified against a theme hierarchy fetched from Notion. Classification uses LLM to match content to relevant themes based on semantic similarity. Cross-theme content (appearing in 3+ themes) is flagged for multi-use. Content can be browsed by theme with filtering and search.

**Files Created:**
- `lib/llm/prompts/classification.ts` - System prompts and user prompts for classification
- `lib/llm/schemas/classification.ts` - Zod schemas for structured classification output
- `lib/classification/classifier.ts` - Main classifier with batch processing and relevance scoring
- `lib/classification/cross-theme.ts` - Cross-theme content analysis and multi-use flagging
- `lib/classification/aggregator.ts` - Aggregates content by theme with statistics
- `lib/classification/index.ts` - Barrel export for classification module
- `lib/notion/content-fetcher.ts` - Fetches user content from Notion for classification
- `app/api/classify/route.ts` - POST to start classification job, GET for status/results
- `components/classification-review.tsx` - Filter and browse classified content by theme
- `components/classification-workflow.tsx` - Workflow component for triggering classification
- `components/theme-detail-content.tsx` - Theme detail view with classified content

**Files Modified:**
- `lib/ai/client.ts` - Added CLASSIFICATION model type
- `app/themes/[id]/page.tsx` - Uses ThemeDetailContent component

**Key Features:**
- Theme classification using Claude Haiku via structured output
- Relevance scoring (0-1 scale, threshold 0.5)
- Cross-theme content detection (content in 3+ themes flagged as multi-use)
- Content aggregation per theme with type breakdown (introductions, examples, quotes, etc.)
- Classification statistics (total classified, unclassified, multi-theme count, average mappings)
- Filtering by theme, relevance score, content type
- Search across classified content
- Collapsible content sections by type
- Background job processing with progress tracking

**Architecture:**
- Uses Vercel AI SDK `generateObject` with Zod schemas for type-safe LLM output
- Batch classification (MAX_BATCH_SIZE = 10) for efficiency
- Classification results stored in `processing/{jobId}/classification-results.json`
- Theme hierarchy: MainTheme → MiniTheme → Questions

---

### Sprint 9 - Content Extraction Engine (2026-01-23) - Completed

**Demo:** The extraction engine can detect essay boundaries in OCR'd PDFs, extract structured content (introductions, conclusions, examples, quotes, thinkers, arguments, books/poems, keywords) using LLM, score content quality, and flag overused examples.

**Files Created:**
- `lib/extraction/essay-detector.ts` - Detects essay boundaries in multi-page PDFs using LLM
- `lib/extraction/content-extractor.ts` - Main extraction logic with batch processing
- `lib/extraction/quality.ts` - Quality scoring, multi-use assessment, overused detection
- `lib/extraction/index.ts` - Barrel export for extraction module
- `lib/llm/prompts/extraction.ts` - System prompts and dynamic extraction prompts
- `lib/llm/schemas/extraction.ts` - Zod schemas for structured LLM extraction output
- `app/api/extract/route.ts` - POST to start extraction job, GET for status/results
- `components/extracted-content-browser.tsx` - Filter and browse extracted content
- `components/patterns-content.tsx` - Patterns page with extraction integration

**Files Modified:**
- `lib/hooks/use-settings.ts` - Added extractionParameters to AppSettings
- `components/parameters-content.tsx` - Full extraction parameters configuration UI
- `app/patterns/page.tsx` - Uses PatternsContent client component

**Key Features:**
- Essay boundary detection using Claude Sonnet via structured output
- Content extraction with 8 content types and 11 example categories
- Quality scoring (high/medium/low) based on content patterns
- Overused example detection with customizable list
- Multi-use content flagging for cross-theme applicability
- Filtering by type, quality, category, overused status
- Stats summary (total, high quality, multi-use, overused counts)
- Collapsible groups by content type

**Architecture:**
- Uses Vercel AI SDK `generateObject` with Zod schemas for type-safe LLM output
- Background processing with job persistence in R2
- Extraction results stored in `processing/{jobId}/extraction-results.json`
- Local state for extracted items with localStorage persistence

**Dependencies:**
- Existing: ai, zod, @ai-sdk/openai

---

### Database Migration - Convex Integration (2026-01-23) - Completed

**Problem:** Projects created in the app showed "Project Not Found" after creation.

**Root Cause:** The architecture was fundamentally broken - projects were saved to `localStorage` on the client, but API routes (which run on the server) tried to read from `localStorage` which doesn't exist server-side.

**Solution:** Migrated from localStorage to Convex database for proper client-server data persistence.

**Files Created:**
- `convex/schema.ts` - Database schema with tables for projects, contentSources, settings
- `convex/projects.ts` - Queries and mutations for project CRUD operations
- `convex/settings.ts` - Queries and mutations for settings storage
- `components/convex-client-provider.tsx` - ConvexProvider wrapper component

**Files Modified:**
- `app/layout.tsx` - Added ConvexClientProvider
- `components/projects-content.tsx` - Migrated to Convex useQuery/useMutation
- `components/project-detail-content.tsx` - Migrated to Convex
- `components/create-project-dialog.tsx` - Migrated to Convex
- `components/add-source-dialog.tsx` - Migrated to Convex
- `components/recent-projects.tsx` - Migrated to Convex
- `components/dashboard-stats.tsx` - Migrated to Convex
- `components/upload-content.tsx` - Migrated to Convex
- `components/__tests__/*.tsx` - Updated to mock Convex instead of localStorage hooks
- `tsconfig.json` - Excluded convex/*.ts from strict checking

**Files Removed:**
- `app/api/projects/` - Old localStorage-based API routes
- `lib/hooks/use-projects.ts` - Old localStorage hook

**Key Features:**
- Real-time data sync via Convex subscriptions
- Type-safe queries and mutations
- Normalized data model (projects and contentSources as separate tables)
- Indexes for efficient queries (by_updated, by_project, by_key)
- Cascading deletes (sources deleted with projects)

**Setup Required:**
1. Run `bunx convex dev` to connect to Convex account
2. Add `NEXT_PUBLIC_CONVEX_URL` to `.env.local`

---

### Sprint 8 - PDF Processing & OCR Infrastructure (2026-01-23) - Completed

**Demo:** Large PDF files (up to 190MB) can be uploaded directly to Cloudflare R2 with progress tracking. OCR processing extracts text from handwritten PDFs using Gemini Flash 2.0 via OpenRouter.

**Files Created:**
- `lib/storage/r2-client.ts` - R2 storage client with S3-compatible API
- `lib/storage/signed-urls.ts` - Signed URL generation for uploads and reads
- `lib/storage/index.ts` - Storage module barrel export
- `lib/ai/client.ts` - OpenRouter AI client setup
- `lib/ai/ocr.ts` - OCR service using LLM vision
- `lib/ai/index.ts` - AI module barrel export
- `lib/pdf/stream.ts` - PDF streaming utility for R2
- `lib/pdf/renderer.ts` - PDF page analysis and rendering
- `lib/pdf/index.ts` - PDF module barrel export
- `lib/processing/job-manager.ts` - Processing job management with R2 persistence
- `lib/processing/index.ts` - Processing module barrel export
- `app/api/storage/upload-url/route.ts` - Get signed upload URL endpoint
- `app/api/storage/read-url/route.ts` - Get signed read URL endpoint
- `app/api/ocr/route.ts` - OCR job start and status endpoint
- `components/processing-status.tsx` - Job progress display component
- `components/ocr-viewer.tsx` - OCR results viewer with search
- `components/pdf-upload-ocr.tsx` - Integrated PDF upload with OCR flow
- `types/extraction.ts` - Content types, example categories, extraction parameters
- `types/processing.ts` - Processing job types

**Files Modified:**
- `lib/local-storage.ts` - Renamed from lib/storage.ts to avoid conflict
- `lib/__tests__/local-storage.test.ts` - Renamed test file
- `app/api/upload/route.ts` - Updated to use R2 storage
- `components/upload-zone.tsx` - Added direct R2 upload with progress
- `types/index.ts` - Added new type exports

**Dependencies Added:**
- `@aws-sdk/client-s3` - S3 client for R2
- `@aws-sdk/s3-request-presigner` - Signed URL generation
- `pdfjs-dist` - PDF parsing

**Key Features:**
- Direct browser-to-R2 uploads for files >10MB with progress tracking
- Signed URLs for secure file access (1 hour default expiry)
- PDF metadata extraction and page analysis
- Handwritten PDF detection (samples pages to determine OCR needs)
- OCR using Gemini Flash 2.0 optimized for UPSC essay content
- Processing job persistence in R2
- Progress tracking with polling
- OCR result viewer with search, copy, and download

**Architecture:**
- R2 storage replaces Vercel Blob for large file support
- XMLHttpRequest used for upload progress (fetch doesn't support it)
- Jobs cached in-memory and persisted to R2
- Page-by-page OCR with batch processing support

---

### Planning Session - Sprints 8-12 (2026-01-23) - Completed

**Context:** User provided comprehensive strategy document with UPSC essay extraction parameters.

**Key Decisions:**
- **Storage**: Migrate from Vercel Blob to Cloudflare R2 for large file support (190MB PDFs)
- **R2 Benefits**: Signed URLs, streaming, no egress costs, better for large files
- **Content Types**: Introductions, conclusions, examples (11 categories), quotes, thinkers, arguments, books/poems, keywords
- **Classification**: Content can appear in multiple themes (cross-theme handling)
- **Output**: Dual-section notes (Your Notes + Topper Insights), synced to Notion

**Sprint Breakdown:**
- Sprint 8: PDF Processing & OCR Infrastructure (R2, streaming, OCR)
- Sprint 9: Content Extraction Engine (essay detection, structured extraction)
- Sprint 10: Theme Classification (cross-theme, user content, review UI)
- Sprint 11: Comparison & Gap Analysis (user vs topper, suggestions)
- Sprint 12: Note Generation & Notion Sync (dual-section, conciseness, sync)

**Files Updated:**
- `docs/plan.md` - Added R2 storage, detailed extraction parameters, file structure
- `docs/sprints.md` - Added 50+ detailed tasks for Sprints 8-12
- `docs/progress.md` - Updated current sprint status

---

### Bug Fix - Settings Persistence (2026-01-23) - Completed

**Problem:** Settings on `/settings/parameters` page were not persisting after page refresh.

**Root Cause:** The `useLocalStorage` hook had a stale closure bug - the `setValue` function used `storedValue` from its closure which could be stale during rapid updates.

**Files Modified:**
- `lib/hooks/use-local-storage.ts` - Fixed stale closure with functional state update
- `lib/notion/config.ts` - Created helper to prioritize env API key
- `app/api/notion/connect/route.ts` - Added GET endpoint for env-based connection check
- `app/api/notion/search/route.ts` - Use `getNotionApiKey()` helper
- `app/api/themes/route.ts` - Use `getNotionApiKey()` helper
- `components/notion-connector.tsx` - Check env connection on mount, reordered hooks
- `components/notion-page-search.tsx` - Removed console.log statements
- `components/parameters-content.tsx` - Fixed unused param, extracted StrategyDocumentSection
- `components/themes-content.tsx` - Check connection via API

**Key Fix:**
```tsx
// BEFORE (buggy - stale closure):
const setValue = useCallback((value) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    window.localStorage.setItem(key, JSON.stringify(valueToStore));
}, [key, storedValue]);

// AFTER (fixed - functional update):
const setValue = useCallback((value) => {
    setStoredValue((prevStoredValue) => {
        const valueToStore = value instanceof Function ? value(prevStoredValue) : value;
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
    });
}, [key]);
```

---

### Sprint 7 - Dashboard & Overview (2026-01-23) - Completed

**Demo:** Dashboard shows comprehensive overview with stats (themes, questions, projects), connection status, setup wizard for new users, quick actions, and recent projects list.

**Files Created:**
- `components/dashboard-stats.tsx` - Stats cards with theme/project counts, connection status indicators
- `components/recent-projects.tsx` - Recent projects list with relative time, source counts, empty state
- `components/quick-actions.tsx` - Quick action cards linking to key pages
- `components/dashboard-content.tsx` - Main dashboard content with setup wizard
- `components/__tests__/dashboard-stats.test.tsx` - 6 tests
- `components/__tests__/recent-projects.test.tsx` - 11 tests
- `components/__tests__/quick-actions.test.tsx` - 5 tests
- `components/__tests__/dashboard-content.test.tsx` - 9 tests

**Files Modified:**
- `app/page.tsx` - Now uses DashboardContent component (Server Component pattern)

**Key Features:**
- Real-time stats: theme counts, question counts, project counts from Notion API
- Connection status: Notion API, Theme Page, LLM Models
- Setup wizard: Shows progress (0/3 to 3/3) with step-by-step links
- Setup wizard auto-hides when basic setup complete
- Recent projects: Sorted by update time, shows source counts, relative timestamps
- Quick actions: 5 action cards (New Project, Upload, Themes, Patterns, Settings)
- Loading states: Spinner during hydration and data fetching
- Empty states: Friendly prompts when no data exists

**Tests:** 138 total (31 new for dashboard components)

---

### Sprint 6 - LLM Infrastructure & Model Configuration (2026-01-23) - Completed

**Demo:** User can configure which LLM models to use for each task via settings dropdown, test individual model connections, and save configurations to localStorage.

**Files Created:**
- `lib/llm/provider.ts` - LLM provider setup with OpenRouter, model definitions, task definitions
- `lib/llm/test.ts` - LLM connection test utility with error handling
- `lib/llm/index.ts` - Barrel export for LLM module
- `app/api/models/route.ts` - API endpoint for model configuration validation
- `app/api/llm/test/route.ts` - API endpoint for testing LLM connections
- `components/model-selector.tsx` - Model selection component per task
- `components/models-config-content.tsx` - Client component for model configuration page
- `lib/llm/__tests__/provider.test.ts` - 35 tests for LLM provider utilities

**Files Modified:**
- `app/settings/models/page.tsx` - Now uses ModelsConfigContent component
- `lib/hooks/use-settings.ts` - Already had modelConfig support

**Key Features:**
- OpenRouter integration via Vercel AI SDK
- 7 available models (Claude, Gemini, GPT variants)
- 5 task types (OCR, pattern extraction, classification, comparison, generation)
- Vision capability filtering for OCR task
- Per-task model configuration with defaults
- Connection testing with response time measurement
- User-friendly error messages for common API errors
- Configuration persistence to localStorage
- Reset to defaults functionality

**Tests:** 107 total (35 new for LLM provider)

---

### Sprint 5 - File Upload Infrastructure (2026-01-22) - Completed

**Demo:** Users can upload PDFs and images via drag-and-drop or click-to-browse. Files are stored in Vercel Blob storage and can be added as project content sources. File deletion is supported for blob-stored files.

**Files Created:**
- `lib/constants/upload.ts` - Upload constants (allowed types, size limits, formatters)
- `lib/constants/index.ts` - Barrel export for constants
- `app/api/upload/route.ts` - File upload API endpoint
- `app/api/upload/delete/route.ts` - File deletion API endpoint
- `components/upload-zone.tsx` - Drag-and-drop upload component with preview
- `components/upload-content.tsx` - Upload page content with project selector
- `lib/constants/__tests__/upload.test.ts` - 29 tests for upload utilities

**Files Modified:**
- `components/add-source-dialog.tsx` - Added upload tab with UploadZone integration
- `components/project-detail-content.tsx` - Added blob storage deletion when removing file sources
- `app/upload/page.tsx` - Now uses UploadContent component

**Key Features:**
- File type validation (PDF, PNG, JPEG, WebP only)
- File size validation (max 10MB, client and server-side)
- Drag-and-drop file upload with visual feedback
- File preview for images before upload
- Upload progress tracking and status display
- Automatic blob storage cleanup when sources are deleted
- Upload files directly to projects as content sources
- Organized blob paths by project (`projects/{projectId}/{timestamp}-{filename}`)
- Human-readable file size formatting
- Proper error handling for missing BLOB_READ_WRITE_TOKEN

**Tests:** 72 total (29 for upload constants)

---

### Sprint 4 - Project Management (2026-01-22)

**Demo:** User can create projects, view project list, add Notion page URLs as content sources.

**Files Created:**
- `lib/storage.ts` - Type-safe localStorage persistence with LocalStorage and CollectionStorage classes
- `lib/hooks/use-projects.ts` - React hook for project CRUD operations with SSR safety
- `app/api/projects/route.ts` - API endpoint for listing and creating projects
- `app/api/projects/[id]/route.ts` - API endpoint for individual project CRUD
- `app/api/projects/[id]/sources/route.ts` - API endpoint for content source management
- `components/ui/dialog.tsx` - Radix UI Dialog component
- `components/create-project-dialog.tsx` - Project creation form dialog
- `components/project-card.tsx` - Project card with dropdown actions
- `components/projects-content.tsx` - Projects list page content
- `components/source-list.tsx` - Content source list with status badges
- `components/add-source-dialog.tsx` - Add Notion page URL dialog
- `components/project-detail-content.tsx` - Project detail page content
- `lib/notion/page-fetcher.ts` - Extract page IDs from Notion URLs

**Files Modified:**
- `app/projects/page.tsx` - Now uses ProjectsContent component
- `app/projects/[id]/page.tsx` - Now uses ProjectDetailContent component

**Tests Created:**
- `lib/__tests__/storage.test.ts` - 20 tests for storage layer
- `lib/notion/__tests__/page-fetcher.test.ts` - 17 tests for page ID extraction

**Key Features:**
- Projects stored in localStorage with typed CRUD operations
- Notion URL validation and page ID extraction (handles full URLs, UUIDs, raw IDs)
- Content source status tracking (pending, processing, completed, failed)
- File upload placeholder for future implementation

### Sprint 3 - Notion Integration - Page Content & Theme Parsing (2026-01-22)

**Demo:** User can select theme page from Notion and see parsed theme hierarchy with collapsible tree view.

**Files Created:**
- `lib/notion/block-parser.ts` - Parse Notion blocks to extract text content
- `lib/notion/theme-parser.ts` - Parse theme page structure into hierarchy (Main → Mini → Questions)
- `lib/hooks/use-settings.ts` - Application settings persistence hook
- `app/api/themes/route.ts` - API endpoint to fetch and parse themes
- `components/theme-tree.tsx` - Collapsible tree view with search/filter
- `components/themes-content.tsx` - Themes page content with data fetching

**Files Modified:**
- `components/notion-page-search.tsx` - Added apiKey and onError props
- `app/themes/page.tsx` - Now uses ThemesContent component

**Key Features:**
- Theme parsing supports toggle-based and heading-based structures
- Year extraction from "YYYY: Question text" format
- Search/filter capability in theme tree
- Refresh button to re-fetch themes from Notion
- Statistics display (main themes, mini themes, questions, year range)

### Sprint 2 - Notion Integration - Connection & Search (2026-01-22)

**Demo:** User can enter Notion API key in settings, test connection, and search for pages.

**Files Created:**
- `lib/hooks/use-local-storage.ts` - SSR-safe localStorage hook with hydration handling
- `lib/notion/client.ts` - Notion API client with testConnection, search, getPage, getPageContent
- `lib/notion/types.ts` - TypeScript types for Notion API responses
- `app/api/notion/connect/route.ts` - API endpoint to test Notion connection
- `app/api/notion/search/route.ts` - API endpoint to search Notion workspace
- `components/notion-connector.tsx` - Client component for Notion connection UI
- `components/notion-page-search.tsx` - Debounced search with dropdown results

**API Design:**
- All API routes accept API key in request body (not env var) for flexibility
- Client stores API key in localStorage, passes to API routes
- Search results are simplified to `SearchResultItem` for cleaner UI

### Sprint 1 - Project Foundation & UI Shell (2026-01-22)

**Demo:** App runs with full navigation between all pages, responsive sidebar, placeholder content on each page.

**Files Created:**
- `lib/env.ts` - Typed environment configuration
- `types/` - Core type definitions (theme, project, content, settings)
- `components/layout/` - App shell, sidebar, header
- `components/ui/loading-spinner.tsx` - Reusable loading spinner
- `components/ui/error-message.tsx` - Reusable error display
- `app/loading.tsx` - Global loading state
- `app/error.tsx` - Global error boundary
- 13 page routes with placeholder content

**Dependencies Added:**
- `ai` - Vercel AI SDK
- `@ai-sdk/openai` - OpenRouter-compatible provider
- `zod` - Schema validation
- `@vercel/blob` - File storage

---

## Architecture Decisions

### AD-001: Server Components for Pages

**Decision:** All page.tsx files are Server Components (no "use client")
**Rationale:** Better SSR, reduced client bundle, cleaner separation of concerns
**Pattern:** Pages render client components from /components for interactivity

### AD-002: Convex for Projects, localStorage for Settings

**Decision:** Projects stored in Convex database, user settings in localStorage
**Rationale:** Projects need server-side access for API routes; settings are client-only preferences
**Trade-off:** Settings don't persist across devices (acceptable for API keys)
**Migration:** Previously used localStorage for projects which broke API routes (server can't access localStorage)

### AD-003: Barrel Types Export

**Decision:** Use types/index.ts as barrel export despite linter warning
**Rationale:** Types are tree-shaken anyway, clean imports improve DX
**Note:** Linter warning is informational, not blocking

### AD-004: API Key in Request Body

**Decision:** Pass Notion API key via request body to API routes, not env var
**Rationale:** Allows user to configure their own key without server restart
**Trade-off:** Key transmitted on each request (HTTPS encrypted)

### AD-005: Convex Database for Project Data

**Decision:** Use Convex for project and content source storage
**Rationale:**
- Real-time subscriptions for automatic UI updates
- Works from both client (useQuery) and server contexts
- Type-safe with generated TypeScript types
- Handles complex queries with indexes
**Pattern:** Components use `useQuery` for reads, `useMutation` for writes
**Setup:** Requires `bunx convex dev` to connect and generate types

---

## Tech Debt

Track known issues that need addressing:

- Pre-existing lint issues in example files (component-example.tsx, some shadcn components)
- These are template files that should be reviewed/removed before production
- No Convex function tests — `convex-test` package not installed; server-side Convex functions have no automated test coverage
