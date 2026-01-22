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
