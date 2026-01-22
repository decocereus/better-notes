# Progress

Track completed work, current status, and next steps.

## Current Sprint

**Sprint:** Sprint 10 - Theme Classification
**Goal:** Classify extracted content against theme hierarchy
**Status:** 🔜 Ready to Start

### Sprint 8-9 Committed (2026-01-23)

Commit `c141ecd` pushed to main with 84 files changed (10,578 insertions, 1,525 deletions).

**Lint fixes required before commit:**
- Disabled `noBarrelFile` rule globally in biome.jsonc (barrel files are standard pattern in this codebase)
- Moved regex patterns to top-level constants in quality.ts, essay-detector.ts, content-extractor.ts, ocr.ts
- Refactored `calculateQuality` to reduce cognitive complexity (extracted helper functions)
- Removed useless switch cases in extraction.ts prompt functions
- Fixed async functions without await in signed-urls.ts, job-manager.ts
- Converted namespace imports to named imports in pdf/stream.ts (pdfjs-dist)
- Removed accidentally generated job-manager.js file
- Added block statements where required by linter

### Completed in Sprint 9

- [x] Essay boundary detection (lib/extraction/essay-detector.ts)
- [x] Extraction prompts with category-specific guidance (lib/llm/prompts/extraction.ts)
- [x] Zod schemas for structured LLM output (lib/llm/schemas/extraction.ts)
- [x] Content extractor with batch processing (lib/extraction/content-extractor.ts)
- [x] Quality scoring and overused example detection (lib/extraction/quality.ts)
- [x] Extraction API route (app/api/extract/route.ts)
- [x] Extraction parameters UI (components/parameters-content.tsx)
- [x] Extracted content browser with filtering (components/extracted-content-browser.tsx)
- [x] Patterns page integration (components/patterns-content.tsx)
- [x] Settings hook updated for extraction parameters

### Pending for Sprint 10

- [ ] 10.1: Create Theme Classification Module
- [ ] 10.2: Cross-theme content handling
- [ ] 10.3: User content extraction (from notes)
- [ ] 10.4: Content review UI
- [ ] 10.5: Manual classification override

### Blocked

- Build error in OCR route due to DOMMatrix (pdf.js SSR issue) - pre-existing from Sprint 8

---

## Completed Work

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
