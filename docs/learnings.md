# Learnings

Document discoveries, gotchas, and solutions encountered during development.

## Format

```markdown
### [Date] - Brief Title

**Context:** What were you trying to do?
**Problem:** What went wrong or was unexpected?
**Solution:** How did you fix it?
**Lesson:** What should you remember for next time?
```

---

## Learnings Log

<!-- Add new learnings below this line -->

### 2026-01-25 - Self-Hosted PDF Converter with Poppler

**Context:** Replacing CloudConvert with a self-hosted solution for PDF-to-image conversion
**Problem:** CloudConvert is a paid third-party service with usage limits. For high-volume PDF processing, costs add up and you depend on external service availability.
**Solution:** Deploy a self-hosted converter on Railway using Poppler's `pdftoppm`. Poppler is the standard open-source PDF rendering library used by most Linux distributions.
**Lesson:** For PDF-to-image conversion, `pdftoppm` (Poppler) is reliable and fast. Command: `pdftoppm -jpeg -r 150 -jpegopt quality=85 input.pdf output-prefix`. The `-r` flag sets DPI. Railway's free tier can handle occasional conversions; scale up for production workloads.

### 2026-01-25 - Node.js HTTP Server Without Express

**Context:** Building a simple converter service for Railway deployment
**Problem:** Express adds overhead and dependencies for what is essentially two HTTP endpoints
**Solution:** Use Node.js native `http.createServer()` with manual routing. Parse URL with `new URL()`, parse body by collecting chunks, send JSON with `res.writeHead()` and `res.end()`.
**Lesson:** For simple microservices with few endpoints, native Node.js HTTP is sufficient. It reduces container size and cold start time. Pattern: async handler function that catches all errors and sends JSON responses.

### 2026-01-23 - CloudConvert API for PDF-to-Image Conversion

**Context:** Implementing PDF-to-image conversion for large PDFs (500MB+, 1300+ pages)
**Problem:** LLM APIs have file size limits (Gemini 50MB, OpenRouter 5MB), making direct PDF OCR impossible for large files
**Solution:** Use CloudConvert API to convert PDF pages to JPEG images, then OCR each image independently
**Lesson:** For large file processing, split the work into manageable chunks. CloudConvert handles PDFs up to 10GB and outputs individual page images that fit within LLM limits.

### 2026-01-23 - Multi-Model OCR Fallback Strategy

**Context:** OCR results from Gemini Flash sometimes have low quality (low confidence, missing text, high illegible markers)
**Problem:** Single-model OCR doesn't handle all handwriting styles equally well
**Solution:** Primary OCR with Gemini Flash (fast, cheap), then retry low-quality pages with Claude Sonnet (slower, more accurate). Quality thresholds: wordCount < 30, confidence < 0.7, illegible > 15%
**Lesson:** Use a cheaper model for bulk processing, then fall back to a more capable model for edge cases. This balances cost and quality.

### 2026-01-23 - Per-Page OCR Results Storage

**Context:** Storing OCR results for 1300+ page PDFs
**Problem:** Storing all results in a single JSON file is unwieldy and makes incremental processing difficult
**Solution:** Store each page's OCR result as a separate JSON file: `assets/{assetId}/ocr/page-0001.json`. Combine them on-demand for the extraction pipeline.
**Lesson:** For large-scale processing, store results incrementally. This enables progress tracking, resumption after failures, and selective retries.

### 2026-01-23 - Extraction Pipeline Integration with New OCR Format

**Context:** The extraction pipeline expected OCR results from the legacy job format (`processing/{jobId}/ocr-results.json`)
**Problem:** New OCR pipeline stores results per-page in a different format (`PageOcrResult` vs `OcrPageResult`)
**Solution:** Add format detection and conversion layer - when `assetId` is provided, load per-page results and convert to legacy format. Keep backward compatibility for `ocrJobId`.
**Lesson:** When redesigning a pipeline component, maintain backward compatibility by supporting both old and new formats. Use a conversion layer to bridge the gap.

### 2026-01-23 - Convex Id<> Type Casting in API Routes

**Context:** API routes receive string IDs from request params but Convex mutations expect `Id<"tableName">` types
**Problem:** TypeScript error when passing `assetId` (string) to Convex mutation expecting `Id<"assets">`
**Solution:** Use `as never` cast pattern: `id: assetId as never` - this satisfies TypeScript without creating runtime issues since Convex validates the ID format
**Lesson:** When passing string IDs to Convex from API routes, use `as never` cast. The Convex runtime will validate the ID is properly formatted.

### 2026-01-23 - Implicit Any with Mutable Variables in Convex Functions

**Context:** Convex function with `let assets;` followed by conditional query assignments
**Problem:** Biome flagged "Unexpected any" because TypeScript inferred `any` type for the variable
**Solution:** Refactor to use early returns instead of mutable variable - each branch returns directly from the query
**Lesson:** Avoid mutable variables in Convex query handlers. Use early returns for each conditional branch to maintain type safety.

### 2026-01-23 - Array.at() Method for Safe Index Access

**Context:** Migration script accessing last element of array with `parts[parts.length - 1]`
**Problem:** Biome flagged unsafe array access (could be undefined)
**Solution:** Use `parts.at(-1) ?? ""` - the `at()` method safely handles negative indices and returns undefined
**Lesson:** Use `array.at(-1)` instead of `array[array.length - 1]` for cleaner, safer access to last element

### 2026-01-23 - Top-Level Regex Constants in Scripts

**Context:** Migration script had regex pattern `/^\d+-/` inside the function
**Problem:** Biome's `useTopLevelRegex` rule flagged regex inside function
**Solution:** Move to module-level constant: `const TIMESTAMP_PREFIX_REGEX = /^\d+-/;`
**Lesson:** Even in one-off scripts, follow the same performance patterns as application code - top-level regex constants

### 2026-01-23 - Processing Status State Machine Design

**Context:** Designing asset processing status for OCR → extraction pipeline
**Problem:** Needed to track granular status for both OCR and extraction phases
**Solution:** Use explicit state machine with 9 states covering pending, queued, processing, completed, and failed for each phase
**Lesson:** For multi-step pipelines, design explicit status values for each phase transition. This makes debugging easier and allows UI to show precise progress.

### 2026-01-23 - File vs Directory Module Conflict

**Context:** Created lib/storage/ directory with index.ts for R2 module
**Problem:** TypeScript/Turbopack kept finding the wrong exports - turns out lib/storage.ts (file) and lib/storage/ (directory) both existed
**Solution:** Renamed lib/storage.ts to lib/local-storage.ts
**Lesson:** When creating a new module directory, check for existing files with the same name - the file takes precedence over the directory/index.ts

### 2026-01-23 - Upload Progress Tracking

**Context:** Implementing direct browser-to-R2 uploads for large files
**Problem:** fetch() API doesn't support upload progress events
**Solution:** Use XMLHttpRequest with xhr.upload.addEventListener('progress')
**Lesson:** For features requiring upload progress, XMLHttpRequest is still the way to go despite fetch being more modern

### 2026-01-23 - R2 Signed URLs with S3 SDK

**Context:** Setting up Cloudflare R2 storage
**Problem:** R2 uses S3-compatible API but with different endpoint format
**Solution:** Use @aws-sdk/client-s3 with region: "auto" and the R2 endpoint URL
**Lesson:** R2 works seamlessly with AWS S3 SDK - just configure endpoint to your R2 bucket URL

### 2026-01-23 - AI SDK Message Format

**Context:** Using AI SDK generateText for OCR with vision
**Problem:** Initial attempts with maxTokens caused TypeScript errors
**Solution:** The messages format with multimodal content works without explicit maxTokens
**Lesson:** AI SDK handles model-specific defaults - don't need to specify maxTokens unless required

### 2026-01-22 - Next.js 16 Dynamic Route Params

**Context:** Creating dynamic route pages like `/projects/[id]/page.tsx`
**Problem:** TypeScript expected `params` to be a Promise in Next.js 16
**Solution:** Use `params: Promise<{ id: string }>` and `await params` in the component
**Lesson:** Next.js 16 changed params to be async - always await them

### 2026-01-22 - Biome Import Sorting

**Context:** Writing new components with imports
**Problem:** Biome requires specific import order (external first, then internal)
**Solution:** Run `bun run fix` to auto-sort, or structure imports as: lucide-react → next/* → @/* → relative
**Lesson:** Let Biome auto-fix import order rather than fighting it manually

### 2026-01-22 - Block Statements Preference

**Context:** Writing conditional returns in getPageTitle function
**Problem:** Biome prefers block statements `if (x) { return y; }` over inline `if (x) return y;`
**Solution:** Wrap single-line if returns in braces
**Lesson:** Always use braces for consistency, even for single-line conditionals

### 2026-01-22 - Class Sorting in Tailwind

**Context:** Writing className with multiple Tailwind classes
**Problem:** Biome's useSortedClasses rule requires specific order (border-border before border-dashed)
**Solution:** Run `bun run fix` to auto-sort classes
**Lesson:** Let the linter sort classes - the order matters for specificity in some cases

### 2026-01-22 - Server vs Client Components

**Context:** Creating layout with interactive sidebar
**Problem:** Can't use hooks (useState, usePathname) in Server Components
**Solution:** Keep page.tsx as Server Components, extract interactive elements to separate client components
**Lesson:** Pages = Server, Interactivity = Client components in /components folder

### 2026-01-22 - useCallback Order with useEffect

**Context:** Creating NotionConnector with testConnection callback used in useEffect
**Problem:** Biome requires useCallback dependencies to be declared before useEffect that uses them
**Solution:** Define useCallback BEFORE the useEffect that references it, add to dependency array
**Lesson:** Hook order matters - define callbacks before effects that use them

### 2026-01-22 - Async Functions That Return Promises

**Context:** NotionClient methods like `search()` and `getPage()` that just return `this.request()`
**Problem:** Biome warns "async function lacks await expression"
**Solution:** Remove `async` keyword when just returning a Promise directly (no await needed)
**Lesson:** Only use `async` when you actually `await` something - returning a Promise doesn't need it

### 2026-01-22 - Class Properties in TypeScript

**Context:** NotionAPIError class with `status` property
**Problem:** Biome warns against parameter properties (`constructor(public status: number)`)
**Solution:** Use explicit property declaration: `readonly status: number;` then assign in constructor
**Lesson:** Prefer explicit class property declarations over TypeScript parameter properties

### 2026-01-22 - Switch Statement Default Clause

**Context:** Keyboard event handler in NotionPageSearch with switch on e.key
**Problem:** Biome requires default clause in switch statements
**Solution:** Add `default: break;` even when no action needed for other keys
**Lesson:** Always include default clause in switch statements for completeness

### 2026-01-22 - SSR-Safe localStorage Hook

**Context:** Storing Notion API key in localStorage for persistence
**Problem:** localStorage not available during SSR, causes hydration mismatch
**Solution:** Create useLocalStorage hook that returns initial value during SSR, hydrates after mount
**Lesson:** Always check `typeof window !== 'undefined'` or use effect for localStorage access

### 2026-01-22 - Cognitive Complexity in Biome

**Context:** Writing theme parser with nested conditionals for different block types
**Problem:** Biome flagged excessive cognitive complexity (25, max is 15)
**Solution:** Extract helper functions for block type checking, theme creation, and block handling
**Lesson:** Break down complex parsing logic into small, focused helper functions

### 2026-01-22 - Semantic HTML vs ARIA Roles

**Context:** Creating clickable tree nodes in theme-tree component
**Problem:** Biome warns against `div` with `role="button"` - suggests using actual `<button>`
**Solution:** Replace divs with `<button type="button">` elements, add `w-full text-left` for styling
**Lesson:** Prefer semantic HTML elements over ARIA roles when possible - better accessibility

### 2026-01-22 - Nested Ternary Expressions

**Context:** Mini theme chevron with multiple conditions (hasQuestions && isExpanded)
**Problem:** Biome warns against nested ternary expressions
**Solution:** Extract to a small dedicated component with if/else statements
**Lesson:** Use small components or helper functions instead of nested ternaries for readability

### 2026-01-22 - useCallback Dependencies with useEffect

**Context:** fetchThemes callback used in useEffect for data fetching
**Problem:** Need to include fetchThemes in useEffect dependencies, but it recreates on every render
**Solution:** Define fetchThemes with useCallback, include all its dependencies, then add to useEffect deps
**Lesson:** When callbacks are used in useEffect, wrap them in useCallback first

### 2026-01-22 - Radix UI Dialog Export Issues

**Context:** Creating dialog component using @radix-ui/react-dialog
**Problem:** Biome flagged `noExportedImports` when re-exporting DialogClose from radix-ui
**Solution:** Use `DialogPrimitive.Close` internally instead of re-exporting, only export what's actually used
**Lesson:** Avoid re-exporting imports directly - use internally and create proper exports

### 2026-01-22 - TypeScript Object Shape Consistency

**Context:** STATUS_CONFIG object with different shapes per key (only 'processing' had 'animate')
**Problem:** TypeScript error when accessing `statusConfig.animate` because not all variants had it
**Solution:** Add `animate: false` to all status config variants for consistent shape
**Lesson:** Keep object shapes consistent across all variants to avoid TypeScript errors

### 2026-01-22 - Regex Test Data Validation

**Context:** Writing tests for Notion page ID extraction
**Problem:** Tests failing because test IDs had 33 chars instead of valid 32-char Notion IDs
**Solution:** Counted characters carefully, fixed test data to use exactly 32 hex characters
**Lesson:** Verify test data matches actual constraints - off-by-one errors are common with fixed-length IDs

### 2026-01-22 - Bun Test vs Vitest

**Context:** Running tests with `bun test`
**Problem:** `bun test` uses Bun's native test runner, ignoring vitest.config.ts (environment: "jsdom")
**Solution:** Use `bun run test` which runs the npm script that calls `vitest run`
**Lesson:** `bun test` ≠ `bun run test` - use the npm script to respect vitest config

### 2026-01-22 - localStorage Mock in Tests

**Context:** Testing LocalStorage class that checks `typeof window === "undefined"`
**Problem:** Tests failed because window was undefined in Node/Bun environment
**Solution:** Mock both `global.window` and `global.localStorage` in test setup
**Lesson:** When testing browser APIs, mock the full environment including window object

### 2026-01-22 - Constants Organization Pattern

**Context:** Adding upload-related constants (allowed MIME types, file size limits)
**Problem:** CLAUDE.md requires all constants in `lib/constants/` but directory didn't exist
**Solution:** Created `lib/constants/` with domain-specific files (upload.ts) and barrel export (index.ts)
**Lesson:** Follow the established pattern: one file per domain, include type guards and utility functions with the constants they relate to

### 2026-01-22 - Vercel Blob File Uploads

**Context:** Implementing file upload to Vercel Blob storage
**Problem:** Need to handle multipart form data and validate files before upload
**Solution:** Use `request.formData()` in Next.js API route, validate MIME type with type guard, use `put()` from @vercel/blob
**Lesson:** Vercel Blob requires BLOB_READ_WRITE_TOKEN env var - add specific error handling for this common misconfiguration

### 2026-01-22 - Cognitive Complexity with Helper Functions

**Context:** UploadZone component with complex processFiles and handleDeleteSource functions
**Problem:** Biome flagged cognitive complexity over 15 (had 21-23)
**Solution:** Extract pure helper functions outside the component: `validateFile()`, `createFileWithPreview()`, `cleanupPreviews()`, `shouldDeleteFromBlobStorage()`
**Lesson:** Keep stateful logic in hooks/handlers, extract pure logic to helper functions - reduces complexity and improves testability

### 2026-01-22 - Drag-and-Drop File Upload Accessibility

**Context:** Creating drop zone for file uploads with both drag-drop and click-to-browse
**Problem:** Biome warns about non-interactive elements with event handlers (noStaticElementInteractions, noNoninteractiveElementInteractions)
**Solution:** Use biome-ignore comment explaining the pattern, or separate concerns (div for drop events, label/input for click)
**Lesson:** Drop zones are a legitimate pattern but need biome-ignore comments to suppress accessibility warnings - document why the pattern is acceptable

### 2026-01-22 - Next.js Image with Blob URLs

**Context:** Showing image preview from `URL.createObjectURL()` blob URLs
**Problem:** Using `<img>` triggers linter warnings about missing dimensions and preferring Next.js Image
**Solution:** Use `<Image>` component with `unoptimized` prop (required for blob URLs), explicit width/height
**Lesson:** Next.js Image works with blob URLs but needs `unoptimized` since it can't optimize local blob URLs

### 2026-01-22 - Async Functions Without Await

**Context:** Handler function marked `async` that calls synchronous functions
**Problem:** Biome warns "async function lacks an await expression"
**Solution:** Remove `async` keyword when all operations are synchronous
**Lesson:** Only mark functions `async` when they actually await something - not just because they handle async operations elsewhere

### 2026-01-23 - Vercel AI SDK 5.0+ maxOutputTokens

**Context:** Using generateText from Vercel AI SDK to test LLM connections
**Problem:** TypeScript error - `maxTokens` does not exist in type
**Solution:** Use `maxOutputTokens` instead of `maxTokens` (renamed in AI SDK 5.0)
**Lesson:** AI SDK 5.0 renamed maxTokens to maxOutputTokens for clarity - check migration guides when upgrading

### 2026-01-23 - Cognitive Complexity with Error Pattern Matching

**Context:** extractErrorMessage function with multiple if-statements for error patterns
**Problem:** Biome flagged cognitive complexity of 17 (max is 15)
**Solution:** Extract patterns to a const array, use helper function with for...of loop
**Lesson:** When matching many patterns, use a data-driven approach (array of patterns) instead of multiple if-statements

### 2026-01-23 - OpenRouter API Integration

**Context:** Setting up LLM provider with OpenRouter via Vercel AI SDK
**Problem:** Need to configure OpenRouter as the base URL while using OpenAI-compatible SDK
**Solution:** Use createOpenAI with baseURL set to openrouter.ai/api/v1, add HTTP-Referer and X-Title headers
**Lesson:** OpenRouter is OpenAI-compatible, so use @ai-sdk/openai with custom baseURL - no special provider needed

### 2026-01-23 - Boolean Coercion for Optional Values

**Context:** DashboardContent component checking if modelConfig exists and has keys
**Problem:** TypeScript error: Type 'boolean | undefined' is not assignable to type 'boolean'
**Solution:** Wrap expression in `Boolean()`: `Boolean(settings.modelConfig && Object.keys(settings.modelConfig).length > 0)`
**Lesson:** When passing conditional expressions as boolean props, use `Boolean()` to ensure type safety

### 2026-01-23 - Testing Loading Spinners Without role="status"

**Context:** Testing components that show LoadingSpinner during loading state
**Problem:** LoadingSpinner uses Lucide icon without `role="status"`, so `getByRole("status")` fails
**Solution:** Use CSS class selector: `document.querySelector(".animate-spin")`
**Lesson:** When testing for loading states, check the actual DOM structure first - icons may have `aria-hidden="true"`

### 2026-01-23 - Component Composition for Dashboard

**Context:** Building dashboard with multiple sections (stats, recent projects, quick actions)
**Problem:** Need to share state across sections while keeping page as Server Component
**Solution:** Create a DashboardContent client component that composes smaller components, each using hooks independently
**Lesson:** Compose client components that each manage their own state - no need to lift all state to parent

### 2026-01-23 - useLocalStorage Stale Closure Bug

**Context:** Settings not persisting after page refresh despite localStorage having correct data
**Problem:** `useLocalStorage` hook's `setValue` used `storedValue` from closure which could be stale
**Solution:** Use functional state update: `setStoredValue((prev) => ...)` to get latest state from React
**Lesson:** When a callback in useCallback needs current state, use functional updates instead of depending on state variables in closure - prevents stale closure bugs

### 2026-01-23 - Hook Declaration Order in Components

**Context:** `testConnection` useCallback used in useEffect dependency array
**Problem:** TypeScript error "used before declaration" when useEffect with testConnection dependency was defined before testConnection
**Solution:** Reorder hooks so useCallback is defined BEFORE the useEffect that uses it
**Lesson:** Hook declaration order matters - define callbacks before effects that depend on them

### 2026-01-23 - localStorage Cannot Be Accessed from API Routes

**Context:** Project creation showed "project not found" error after creating a project
**Problem:** API routes in Next.js run on the server - localStorage is only available in the browser
**Solution:** Migrated data layer from localStorage + API routes to Convex (real-time database)
**Lesson:** Server-side code cannot access browser APIs - use a proper database for data that needs to be accessed from both client and server

### 2026-01-23 - Convex Generated Types Setup

**Context:** Setting up Convex with existing codebase before running `bunx convex dev`
**Problem:** TypeScript errors for missing `@/convex/_generated/api` module
**Solution:** Create placeholder files in `convex/_generated/` with basic type exports, then run `bunx convex dev` to generate real types
**Lesson:** Convex generates types automatically but you need to run `bunx convex dev` first - can create placeholders for initial development

### 2026-01-23 - Convex useQuery Return Types

**Context:** Using `useQuery(api.projects.list)` to fetch projects
**Problem:** Return type is `unknown` because Convex types are generic
**Solution:** Cast result to expected type: `useQuery(api.projects.list) as Project[] | undefined`
**Lesson:** Convex queries return unknown by default - use type assertions matching your schema

### 2026-01-23 - Excluding Convex from TypeScript Strict Mode

**Context:** Convex functions in `convex/*.ts` causing implicit any errors
**Problem:** Convex's `ctx` and `args` parameters don't have explicit types in handler functions
**Solution:** Add `"convex/*.ts"` to `tsconfig.json` exclude array - Convex has its own `convex/tsconfig.json`
**Lesson:** Convex backend files should be excluded from main tsconfig - they use their own TypeScript configuration

### 2026-01-23 - Convex FunctionReference for Queries Without Arguments

**Context:** `useQuery(api.projects.list)` with no arguments
**Problem:** TypeScript error "Expected 2 arguments, but got 1"
**Solution:** Define query type with `Record<string, never>` for args: `FunctionReference<"query", "public", Record<string, never>, unknown>`
**Lesson:** Use `Record<string, never>` (not `object` or `{}`) for Convex queries that take no arguments

### 2026-01-23 - Vercel AI SDK generateObject for Structured Extraction

**Context:** Extracting structured content from essays using LLM
**Problem:** Need type-safe structured output from LLM (not just text)
**Solution:** Use `generateObject` from `ai` package with Zod schema - it validates and returns typed object
**Lesson:** `generateObject({ model, schema, system, prompt })` is the pattern for structured LLM output - define schema with Zod

### 2026-01-23 - Cognitive Complexity with Filter Functions

**Context:** Content browser with multiple filter conditions in useMemo
**Problem:** Biome flagged cognitive complexity of 35 (max 15) due to nested conditionals in filter function
**Solution:** Extract filter logic into separate pure functions - `matchesSearch()` for search matching, `matchesFilters()` for full filter check
**Lesson:** When filtering with many conditions, extract each condition check to a named function - reduces complexity and improves readability

### 2026-01-23 - confirm() Not Allowed by Linter

**Context:** Adding "Clear All" button with confirmation
**Problem:** Biome lint rule `noAlert` disallows `confirm()` (and `alert()`) calls
**Solution:** Use AlertDialog component from shadcn/ui with controlled state instead of native confirm
**Lesson:** Native browser dialogs (alert, confirm, prompt) are discouraged - use accessible dialog components instead

### 2026-01-23 - Unused Imports Removed by Linter

**Context:** Adding imports for AlertDialog but not using them in JSX yet
**Problem:** Biome auto-removes unused imports on save/fix
**Solution:** Add both the import AND the usage in the same edit, or disable auto-fix while working
**Lesson:** When refactoring to use new components, add both import and usage together to avoid linter removing the import

### 2026-01-23 - Disabling noBarrelFile Rule Globally

**Context:** Linting errors on barrel files (index.ts with re-exports) in lib/ai, lib/storage, lib/extraction, etc.
**Problem:** Biome's `noBarrelFile` rule flagged all barrel exports as performance issues
**Solution:** Added `"performance": { "noBarrelFile": "off" }` to biome.jsonc linter rules
**Lesson:** Barrel files are a legitimate pattern when tree-shaking is handled properly - disable the rule project-wide if barrel exports are standard in your codebase

### 2026-01-23 - Top-Level Regex for Performance

**Context:** Regex patterns defined inside functions for content matching
**Problem:** Biome's `useTopLevelRegex` rule flagged regex literals inside functions
**Solution:** Move regex patterns to module-level constants (e.g., `const WORD_SPLIT_REGEX = /\s+/;`)
**Lesson:** Regex patterns should be defined at module level to avoid re-compilation on each function call - improves performance

### 2026-01-23 - Reducing Cognitive Complexity by Extracting Helpers

**Context:** `calculateQuality` function had complexity of 24 (max 15) with loops and conditionals
**Problem:** Biome's `noExcessiveCognitiveComplexity` rule blocked commit
**Solution:** Extract pure helper functions: `matchesHighQuality()`, `matchesLowQuality()`, `scoreExampleLength()`, `scoreQuoteLength()`, `scoreToQuality()`
**Lesson:** Each loop, conditional, and nested block adds complexity - extract focused helper functions that each do one thing

### 2026-01-23 - Useless Switch Case Before Default

**Context:** Switch statement with `case "balanced":` immediately before `default:` with same body
**Problem:** Biome's `noUselessSwitchCase` flagged redundant case
**Solution:** Remove the explicit case when it has the same handling as default
**Lesson:** If a case falls through to default with identical logic, just use default alone

### 2026-01-23 - Namespace vs Named Imports for pdfjs-dist

**Context:** Using `import * as pdfjsLib from "pdfjs-dist"` for PDF.js library
**Problem:** Biome's `noNamespaceImport` rule flagged namespace import as harmful for tree-shaking
**Solution:** Use named imports: `import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"`
**Lesson:** Prefer named imports even for libraries that commonly use namespace pattern - update call sites from `pdfjsLib.getDocument()` to `getDocument()`

### 2026-01-23 - Async Functions Must Await

**Context:** Functions marked `async` that just return synchronous values or iterate without awaiting
**Problem:** Biome's `useAwait` rule requires async functions to have at least one await
**Solution:** Remove `async` keyword if no awaiting needed, or convert return type to plain `Promise<T>` instead of async function
**Lesson:** `async` is only needed when you actually `await` - returning a Promise from a sync function works the same

### 2026-01-23 - z.record() Requires Two Arguments in Zod

**Context:** Creating Zod schema for classification results with `byContentType: z.record(z.number())`
**Problem:** TypeScript error "Expected 2-3 arguments, but got 1"
**Solution:** Use `z.record(z.string(), z.number())` - first arg is key type, second is value type
**Lesson:** Unlike TypeScript `Record<string, T>`, Zod's `z.record()` requires explicit key and value schemas

### 2026-01-23 - Extracting Helper Functions for Cognitive Complexity

**Context:** Large component with multiple state checks, conditionals, and nested ternaries
**Problem:** Biome flagged cognitive complexity of 32 (max 15)
**Solution:** Extract helper functions like `getStatusBgColor()`, `getStatusTitle()`, `getRelevanceColor()` that encapsulate conditionals
**Lesson:** Each conditional adds complexity - extracting them to named functions both reduces measured complexity and improves readability

### 2026-01-23 - Helper Functions Instead of Nested Ternaries

**Context:** Status-based styling needed different colors for completed/failed/processing states
**Problem:** Nested ternary like `status === "completed" ? "bg-green" : status === "failed" ? "bg-red" : "bg-blue"`
**Solution:** Extract to a helper function with if statements that returns the appropriate class
**Lesson:** Replace nested ternaries with simple helper functions - more readable and satisfies linter

### 2026-01-23 - Type Aliases May Differ From Exports

**Context:** Using `PYQ` type imported from types/theme
**Problem:** TypeScript error "has no exported member 'PYQ'" - the type was actually named `EssayQuestion`
**Solution:** Check actual export name in types file, use correct name
**Lesson:** Always verify the actual export name rather than assuming based on comments or domain knowledge

### 2026-01-23 - Helper Functions for Coverage Calculations

**Context:** Calculating coverage percentages with multiple conditions (topperCount > 0, userCount > 0)
**Problem:** Nested ternary `topperCount > 0 ? ... : userCount > 0 ? 100 : 0` flagged by linter
**Solution:** Extract to `calculateCoveragePercent(userCount, topperCount)` helper function with if statements
**Lesson:** When the same calculation appears multiple times, extracting to a helper function both satisfies the linter and reduces duplication

### 2026-01-23 - export from vs Re-export Pattern

**Context:** Importing `DEFAULT_SCORING_CONFIG` from types and re-exporting from gap-analyzer
**Problem:** Biome's `noExportedImports` rule flagged importing then exporting as problematic
**Solution:** Use `export { DEFAULT_SCORING_CONFIG } from "@/types/comparison"` syntax instead of import + export
**Lesson:** When re-exporting, use the single-line `export from` syntax - it's cleaner and satisfies linters

### 2026-01-23 - While-Loop vs Recursive setTimeout for Polling

**Context:** Polling for job completion with recursive `setTimeout(poll, 1000)` inside async function
**Problem:** Cognitive complexity increased due to nested async callback and try/catch
**Solution:** Convert to `while (attempts < maxAttempts)` loop with `await new Promise(r => setTimeout(r, 1000))`
**Lesson:** While-loop polling is simpler than recursive setTimeout - easier to reason about, lower complexity, and easier to add timeout limits

### 2026-01-23 - useCallback Dependency Order Matters

**Context:** `startComparison` useCallback called `pollComparisonResults` but was defined before it
**Problem:** Biome's exhaustive-deps rule required `pollComparisonResults` in dependency array
**Solution:** Move `pollComparisonResults` definition BEFORE `startComparison`, then add to its dependency array
**Lesson:** When useCallback A calls useCallback B, define B first - dependency order follows call order

### 2026-01-23 - aria-hidden for Decorative Emojis

**Context:** Using emoji in Badge component for cross-theme references
**Problem:** `aria-label` is not valid on span elements without a role
**Solution:** Use `aria-hidden="true"` for decorative content like emojis that don't add meaningful information
**Lesson:** Decorative elements should be hidden from screen readers with aria-hidden, not labeled

### 2026-01-23 - Content-Based Keys Instead of Array Index

**Context:** Rendering list items with `.map()` and using index as key
**Problem:** Biome's `noArrayIndexKey` rule flags using array index as React key
**Solution:** Use content-based keys like `key={item-${item.slice(0, 30)}}` or unique IDs from the data
**Lesson:** Array indices can cause issues when items are reordered or filtered - use stable, unique keys from content

### 2026-01-23 - Render Functions for Nested Ternaries

**Context:** Button content with multiple states (syncing, synced, default)
**Problem:** Nested ternary `isSyncing ? ... : isSynced ? ... : ...` flagged by linter
**Solution:** Extract to a `renderButtonContent()` function with if statements and early returns
**Lesson:** Use render helper functions inside components to avoid nested ternaries - cleaner and linter-friendly

### 2026-01-23 - Top-Level Regex Constants for Performance

**Context:** Regex patterns for bullet points and headers in content renderer
**Problem:** Biome's `useTopLevelRegex` flagged regex literals inside functions
**Solution:** Move patterns to module-level constants: `const BULLET_REGEX = /^[-*•]\s+(.+)$/;`
**Lesson:** Regex compilation happens on each function call if defined inside - define at module level for efficiency

### 2026-01-23 - pdf.js DOMMatrix SSR Build Error

**Context:** Next.js build failing with "ReferenceError: DOMMatrix is not defined" in API routes using pdf.js
**Problem:** `pdfjs-dist` uses browser-only APIs (`DOMMatrix`) at module load time, before any code runs. Top-level imports like `import { getDocument } from "pdfjs-dist"` cause the error because the module is evaluated during build.
**Solution:** Use dynamic imports with the **legacy build** for server-side:
```typescript
async function getPdfjs() {
  if (typeof window === "undefined") {
    return await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return await import("pdfjs-dist");
}
```
**Lesson:** Libraries with browser-only APIs need dynamic imports in Next.js API routes. The pdf.js legacy build (`pdfjs-dist/legacy/build/pdf.mjs`) is designed for Node.js and avoids browser APIs. Cache the module to avoid repeated imports.

### 2026-01-23 - Extracting Components to Reduce Complexity

**Context:** SourceList component had nested conditionals for processing states and button icons
**Problem:** Biome flagged cognitive complexity (23) and nested ternary in button icon logic
**Solution:** Extract `SourceItem` and `ProcessButton` as separate components with their own render functions
**Lesson:** When a list item has complex logic, extract it to a dedicated component - this naturally reduces complexity by distributing logic across focused components

### 2026-01-23 - ConvexHttpClient for Server-Side Mutations

**Context:** API routes need to update Convex database (update source status during processing)
**Problem:** Can't use `useMutation` hook in server-side code (API routes)
**Solution:** Use `ConvexHttpClient` with direct mutation calls: `const convex = new ConvexHttpClient(url); await convex.mutation(api.projects.updateSource, { ... })`
**Lesson:** Convex provides `ConvexHttpClient` for server-side operations - same API surface as client hooks but works without React

### 2026-01-23 - Convex Filename Naming Requirements

**Context:** Created `convex/theme-pages.ts` for theme pages CRUD operations
**Problem:** Convex deployment failed with "theme-pages.js is not a valid path to a Convex module. Path component theme-pages.js can only contain alphanumeric characters, underscores, or periods."
**Solution:** Rename to `themePages.ts` (camelCase) instead of kebab-case
**Lesson:** Convex requires camelCase or snake_case filenames for module files - kebab-case is not allowed. Add biome.jsonc override for convex/ directory to use camelCase instead of project-wide kebab-case rule

### 2026-01-23 - Removing Global Settings Impacts Many Components

**Context:** Removing `themePageId`, `themePageTitle`, `isNotionConnected` from global AppSettings
**Problem:** Many components referenced these settings - had to update dashboard-stats, dashboard-content, themes-content, compare components, classification-workflow, etc.
**Solution:** Check Notion connection via API call (`/api/notion/connect`), fetch theme pages from Convex, pass themePageId as prop where needed
**Lesson:** When migrating from global state to per-entity state, trace all usages first. Components that aggregate global data (like DashboardStats) need to query all entities and aggregate themselves.

### 2026-01-23 - Testing React Components with Multiple useQuery Calls

**Context:** Testing DashboardContent which contains SetupWizard, DashboardStats, RecentProjects - all using `useQuery`
**Problem:** Using `mockReturnValueOnce` for multiple `useQuery` calls failed because React re-renders exhaust the mocks
**Solution:** Use `mockReturnValue` with data that satisfies all components (e.g., objects with both theme page and project properties)
**Lesson:** When testing components with multiple Convex queries, mock `useQuery` with a single return value that works for all calls, or use `mockImplementation` to inspect the query being called

### 2026-01-23 - waitFor with Negation Can Pass Too Early

**Context:** Test "hides setup wizard when basic setup is complete" using `waitFor(() => expect(element).not.toBeInTheDocument())`
**Problem:** Test passed immediately during loading state (when element wasn't rendered yet), before the async fetch completed
**Solution:** Wait for a positive condition first (e.g., "Overview" text appears), then check the negative condition
**Lesson:** `waitFor` with `.not.toBeInTheDocument()` can pass during loading states. Chain positive assertions before negative ones to ensure the component fully loaded

### 2026-01-23 - Required Props vs Optional Settings

**Context:** `ClassificationWorkflow` was getting `themePageId` from global settings (optional)
**Problem:** After removing from settings, component needed themePageId from somewhere else
**Solution:** Make `themePageId` a required prop, remove the `hasThemePage` check since it's always defined when the component is used
**Lesson:** When migrating from optional global state to explicit props, make the prop required - the caller is responsible for having the value. This simplifies the component's internal logic

### 2026-01-23 - Controlled vs Uncontrolled Dialog Pattern

**Context:** AddThemePageDialog needed to work both standalone (trigger-based) and inline (controlled from parent)
**Problem:** Using only DialogTrigger meant parent couldn't programmatically open the dialog
**Solution:** Support both modes: check if `open` prop is provided to use controlled mode, otherwise use internal state
```typescript
const [internalOpen, setInternalOpen] = useState(false);
const isControlled = open !== undefined;
const isOpen = isControlled ? open : internalOpen;
const setIsOpen = isControlled ? onOpenChange! : setInternalOpen;
```
**Lesson:** For reusable dialogs, support both trigger-based (uncontrolled) and `open`/`onOpenChange` (controlled) patterns - allows flexible usage in different contexts

### 2026-01-23 - Missing UI Component Dependencies

**Context:** Using `Alert` component from `@/components/ui/alert` that didn't exist yet
**Problem:** TypeScript error "Cannot find module '@/components/ui/alert'"
**Solution:** Created the alert component using the standard shadcn/ui pattern with cva for variants
**Lesson:** When shadcn/ui components aren't installed, check the shadcn website for the component source and create it manually - same pattern: cva for variants, forwardRef for ref forwarding

### 2026-01-23 - Type Interface Consistency Across Files

**Context:** Added `themePageId` to Convex schema and project mutations but not to TypeScript types
**Problem:** TypeScript error "'themePageId' does not exist on type 'Project'"
**Solution:** Updated `types/project.ts` to add `themePageId?: string` to the Project interface
**Lesson:** When adding fields to Convex schema, also update corresponding TypeScript type interfaces - the types file is the source of truth for component type checking

### 2026-01-23 - forwardRef with Named Imports

**Context:** Creating Alert component using forwardRef pattern
**Problem:** Lint error "noNamespaceImport" when using `import * as React from "react"`
**Solution:** Use named imports: `import { forwardRef, type HTMLAttributes } from "react"`
**Lesson:** Even for patterns that traditionally use namespace imports (like forwardRef components), use named imports to satisfy the linter and improve tree-shaking

### 2026-01-23 - OpenRouter 5MB File Size Limit

**Context:** Sending 190MB PDF directly to Gemini via OpenRouter for OCR
**Problem:** OpenRouter downloads files before forwarding to the underlying model, enforcing a 5MB file size limit: "File is too large: 199587559 bytes. Max size is 5242880 bytes"
**Solution:** Use `@ai-sdk/google` directly with `GOOGLE_GENERATIVE_AI_API_KEY` to bypass OpenRouter for large file operations. Gemini natively supports files up to 2GB via signed URLs.
**Lesson:** When working with large files (>5MB) that need to be sent to LLMs, use the provider's SDK directly instead of going through OpenRouter. Create a separate function that uses the direct provider for these specific use cases.

### 2026-01-23 - pdf.js Worker Configuration in Node.js

**Context:** Using pdf.js for PDF processing in Next.js API routes
**Problem:** Multiple errors when configuring pdf.js worker on server-side: "No GlobalWorkerOptions.workerSrc specified", "Cannot find module pdf.worker.mjs", "Cannot read properties of undefined (reading 'setup')"
**Solution:** For handwritten PDFs that need OCR anyway, skip pdf.js entirely and send the PDF directly to an LLM with vision capabilities. Gemini can process PDFs directly via URL without needing pdf.js rendering.
**Lesson:** When pdf.js is only being used as a preprocessing step for LLM OCR, consider whether the LLM can handle the PDF directly. Modern LLMs like Gemini support PDFs natively, avoiding complex pdf.js worker configuration issues.

### 2026-01-23 - @ai-sdk/google Requires Buffer for PDF Files

**Context:** Bypassing OpenRouter's 5MB limit by using `@ai-sdk/google` directly for large PDF OCR
**Problem:** Passing a URL string to Gemini via @ai-sdk/google resulted in "Request contains an invalid argument" (400) error. Tried `new URL(pdfUrl)` - also didn't work.
**Solution:** Download the PDF to a Buffer and pass it with `type: "file"`:
```typescript
const pdfResponse = await fetch(pdfUrl);
const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

const result = await generateText({
  model: google("gemini-2.5-flash"),
  messages: [{
    role: "user",
    content: [
      { type: "text", text: prompt },
      { type: "file", data: pdfBuffer, mediaType: "application/pdf" },
    ],
  }],
});
```
**Lesson:** For `@ai-sdk/google`, files must be passed as Buffer data with explicit mediaType, not as URLs. The AI SDK file content part supports `type: "file"` with `data` (Buffer) and `mediaType` fields.

### 2026-01-23 - Gemini Model Names

**Context:** Using @ai-sdk/google to access Gemini models directly
**Problem:** "models/gemini-1.5-flash is not found" (404) error when trying to use `gemini-1.5-flash` model name
**Solution:** Use `gemini-2.5-flash` - the latest model name that works with @ai-sdk/google
**Lesson:** Model names change frequently. When getting "model not found" errors, check the latest available model names for the provider. Gemini 2.5 Flash is the current recommended model for fast processing.

### 2026-01-23 - @ai-sdk/google vs @google/genai for File API URIs

**Context:** Using Google File API for large PDF OCR (190MB). Uploaded file successfully to File API, got a URI like `https://generativelanguage.googleapis.com/v1beta/files/xyz`
**Problem:** Passing the File API URI to `@ai-sdk/google` `generateText` with `type: "file"` and `data: new URL(fileUri)` resulted in "INVALID_ARGUMENT" (400) error
**Solution:** Use `@google/genai` directly with `createPartFromUri` instead of `@ai-sdk/google`:
```typescript
const { GoogleGenAI, createPartFromUri } = require("@google/genai");
const genai = new GoogleGenAI({ apiKey });

const response = await genai.models.generateContent({
  model: "gemini-2.5-flash",
  config: { systemInstruction: "..." },
  contents: [{
    role: "user",
    parts: [
      createPartFromUri(file.uri, "application/pdf"),
      { text: "Your prompt" },
    ],
  }],
});
```
**Lesson:** `@ai-sdk/google` only supports Buffer data for files - it cannot reference Google File API URIs. For large files uploaded via File API, use `@google/genai` directly with `createPartFromUri(uri, mimeType)` to reference the uploaded file.
