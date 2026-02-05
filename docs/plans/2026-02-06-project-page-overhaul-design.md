# Project Page Overhaul Design

**Date:** 2026-02-06
**Status:** Approved

## Problem

The project detail page (`/projects/[id]`) has several issues:
1. Pipeline results (classification, comparison, notes) are lost on page refresh — stored in-memory/localStorage only
2. No visual indicator of pipeline progress — long vertical scroll with no sense of position
3. Edit project is disabled, no search on projects list
4. No bulk processing, no export, no asset reuse across projects
5. No notifications when long-running jobs complete
6. Manual error recovery — individual retry clicks per failed source

## Design

### Part 1: Data Persistence Layer

Add 3 new Convex tables to persist pipeline results:

#### `classificationJobs` table
```typescript
classificationJobs: defineTable({
  projectId: v.id("projects"),
  themePageId: v.id("themePages"),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  progress: v.number(),
  totalItems: v.number(),
  classifiedItems: v.number(),
  resultsKey: v.string(), // R2 key for full classification JSON
  stats: v.object({
    classified: v.number(),
    unclassified: v.number(),
    multiTheme: v.number(),
    themesWithContent: v.number(),
  }),
  error: v.optional(v.string()),
  createdAt: v.string(),
  completedAt: v.optional(v.string()),
}).index("by_project", ["projectId"])
```

#### `comparisonResults` table
```typescript
comparisonResults: defineTable({
  projectId: v.id("projects"),
  themePageId: v.id("themePages"),
  miniThemeId: v.string(),
  score: v.number(),
  resultsKey: v.string(), // R2 key for full comparison JSON
  status: v.union(
    v.literal("pending"),
    v.literal("completed"),
    v.literal("failed")
  ),
  error: v.optional(v.string()),
  createdAt: v.string(),
}).index("by_project", ["projectId"])
  .index("by_mini_theme", ["projectId", "miniThemeId"])
```

#### `generatedNotes` table
```typescript
generatedNotes: defineTable({
  projectId: v.id("projects"),
  miniThemeId: v.string(),
  mainThemeTitle: v.string(),
  miniThemeTitle: v.string(),
  resultsKey: v.string(), // R2 key for note content JSON
  syncStatus: v.union(
    v.literal("not_synced"),
    v.literal("synced"),
    v.literal("failed")
  ),
  notionPageId: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
}).index("by_project", ["projectId"])
  .index("by_mini_theme", ["projectId", "miniThemeId"])
```

**API route changes:**
- `/api/classify` POST — on completion, write job metadata to `classificationJobs` via ConvexHttpClient
- `/api/compare` POST — on completion, write result to `comparisonResults`
- `/api/generate` POST — on completion, write result to `generatedNotes`

**Component changes:**
- `project-workflow.tsx` — load persisted state from Convex on mount instead of polling localStorage
- Remove localStorage job ID persistence, use Convex subscriptions for real-time updates

---

### Part 2: Project Page UX

#### 2a. Pipeline Stepper (`components/pipeline-stepper.tsx`)

Horizontal stepper at top of project detail page:

```
[1. Sources] → [2. Extraction] → [3. Classification] → [4. Comparison] → [5. Notes]
```

Step states:
- **Pending**: grey circle, muted text
- **Active/In Progress**: blue pulsing dot, bold text
- **Completed**: green checkmark + count badge
- **Failed**: red X icon

Behavior:
- Click step scrolls to that section (using `id` anchors + `scrollIntoView`)
- State derived from Convex queries:
  - Sources: `contentSources` status counts
  - Extraction: `extractionResults` existence for project assets
  - Classification: `classificationJobs` latest status
  - Comparison: `comparisonResults` count vs total mini-themes
  - Notes: `generatedNotes` count

#### 2b. Edit Project Dialog (`components/edit-project-dialog.tsx`)

- Reuses form layout from `CreateProjectDialog`
- Pre-filled with current project data
- Allows editing: name, description, theme page
- Uses `api.projects.update` mutation

#### 2c. Projects List Search

- Search input in `projects-content.tsx` above the grid
- Client-side filter on `project.name` and `project.description`
- Debounced 300ms

#### 2d. Toast Notifications

- Use `sonner` toast library (via shadcn `<Toaster>`)
- Convex subscription watchers in `project-detail-content.tsx`
- Fire toast on status transitions: processing → completed, processing → failed
- Toast actions: "View Results" button that scrolls to relevant section

---

### Part 3: Missing Features

#### 3a. Bulk Processing

- "Process All" button in sources section header
- Iterates pending/failed sources, fires processing for each
- Disabled while any source is already processing
- Shows count: "Process All (3 pending)"

#### 3b. Export/Download

Dropdown menu on comparison results and generated notes:
- **Copy as Markdown** — `navigator.clipboard.writeText(markdown)`
- **Download as Markdown** — blob download as `.md` file
- **Download as JSON** — raw structured data export

No PDF export (Notion sync covers formatted output needs).

#### 3c. Asset Reuse — "From Library" Tab

Third tab in `AddSourceDialog`:
- Lists completed assets from global library not in current project
- Filter by filename search
- Click to assign to project via `api.assets.assignToProject`
- Shows asset stats (pages, extracted items)

#### 3d. Bulk Retry Failed

- "Retry All Failed" button appears when failed sources/assets exist
- Retries all failed items in parallel
- Paired with toast notifications

---

### Dropped (YAGNI)

- **Project duplication** — low value
- **Source reordering** — sources processed in parallel, order irrelevant
- **Onboarding walkthrough** — stepper itself guides the user

---

## Implementation Order

### Sprint A: Persistence Layer (foundation)
1. Add 3 Convex tables + indexes
2. Create Convex functions (CRUD for each table)
3. Update `/api/classify` to persist to Convex on completion
4. Update `/api/compare` to persist to Convex on completion
5. Update `/api/generate` to persist to Convex on completion
6. Update `project-workflow.tsx` to load from Convex instead of localStorage

### Sprint B: Project Page UX
7. Create `pipeline-stepper.tsx` component
8. Integrate stepper into `project-detail-content.tsx`
9. Create `edit-project-dialog.tsx`
10. Enable edit button in project detail dropdown
11. Add search input to `projects-content.tsx`
12. Add `sonner` toaster + toast notifications for job completions

### Sprint C: Features
13. Add "Process All" button to sources section
14. Add export dropdown to comparison results
15. Add export dropdown to generated notes
16. Add "From Library" tab to add source dialog
17. Add "Retry All Failed" button

### Sprint D: Testing & Polish
18. Write tests for new Convex functions
19. Write tests for new components
20. Run `bun run check` and fix all issues
21. Update docs/progress.md and docs/learnings.md
