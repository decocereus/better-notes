# Progress

Track completed work, current status, and next steps.

## Current Sprint

**Sprint:** Sprint 7 - Dashboard & Overview (Foundation Complete)
**Goal:** Build functional dashboard showing overview of all data
**Status:** ✅ Completed

### Completed

- [x] Task 7.1: Create Dashboard Stats Component (components/dashboard-stats.tsx)
- [x] Task 7.2: Create Recent Projects Component (components/recent-projects.tsx)
- [x] Task 7.3: Create Quick Actions Component (components/quick-actions.tsx)
- [x] Task 7.4: Build Dashboard Page (app/page.tsx, components/dashboard-content.tsx)

### In Progress

- None

### Pending

- None (Foundation sprints complete!)

### Blocked

- Sprints 8-12 require strategy document from user

---

## Completed Work

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

### AD-002: localStorage for Settings

**Decision:** Store user settings (Notion API key, theme page ID) in localStorage
**Rationale:** No backend needed for MVP, user controls their own data
**Trade-off:** Settings don't persist across devices

### AD-003: Barrel Types Export

**Decision:** Use types/index.ts as barrel export despite linter warning
**Rationale:** Types are tree-shaken anyway, clean imports improve DX
**Note:** Linter warning is informational, not blocking

### AD-004: API Key in Request Body

**Decision:** Pass Notion API key via request body to API routes, not env var
**Rationale:** Allows user to configure their own key without server restart
**Trade-off:** Key transmitted on each request (HTTPS encrypted)

---

## Tech Debt

Track known issues that need addressing:

- Pre-existing lint issues in example files (component-example.tsx, some shadcn components)
- These are template files that should be reviewed/removed before production
