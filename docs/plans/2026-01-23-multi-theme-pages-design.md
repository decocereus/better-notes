# Multi-Theme Pages Design

**Date:** 2026-01-23
**Status:** Ready for implementation

## Overview

Transform the themes system from a single global theme page to supporting multiple theme pages stored in Convex, with per-project theme selection.

## Requirements

| Requirement | Decision |
|-------------|----------|
| Theme data storage | Full hierarchy in Convex |
| Theme naming | Use Notion page title |
| Theme required in projects | Yes, mandatory |
| Management UI | /themes page - list of saved theme pages |
| Theme page click | Navigate to `/themes/[id]` detail page |
| Add theme page | Dialog on /themes list page |
| No themes flow | Inline "Add one now" in project dropdown |
| Resync behavior | Updates structure only, classification separate |
| Delete behavior | Allow with warning, projects become invalid |
| Notion API key | Environment variable only (remove localStorage) |

## Schema Changes

### New `themePages` Table

```typescript
themePages: defineTable({
  notionPageId: v.string(),      // Notion page UUID
  title: v.string(),              // From Notion page title
  themes: v.array(v.any()),       // MainTheme[] - full parsed hierarchy
  stats: v.object({
    mainThemes: v.number(),
    miniThemes: v.number(),
    questions: v.number(),
    yearRange: v.optional(v.object({
      min: v.number(),
      max: v.number(),
    })),
  }),
  lastSyncedAt: v.string(),       // ISO timestamp of last Notion fetch
  createdAt: v.string(),
})
.index("by_notion_page", ["notionPageId"])  // Prevent duplicates
.index("by_created", ["createdAt"])          // Sort by date added
```

### Modified `projects` Table

```typescript
projects: defineTable({
  name: v.string(),
  description: v.optional(v.string()),
  themePageId: v.id("themePages"),  // Required reference
  createdAt: v.string(),
  updatedAt: v.string(),
})
.index("by_updated", ["updatedAt"])
.index("by_theme_page", ["themePageId"])  // Find projects using a theme
```

## Convex Functions

### New `convex/theme-pages.ts`

```typescript
// Queries
list           // Get all theme pages, sorted by createdAt desc
get            // Get single theme page by ID
getByNotionId  // Check if Notion page already added

// Mutations
create         // Add new theme page
sync           // Update themes/stats/lastSyncedAt
remove         // Delete theme page
```

### Modified `convex/projects.ts`

```typescript
// Modified
create         // Add required themePageId parameter

// New
listByThemePage  // Find projects using a theme page (for delete warning)
```

## API Routes

### Unchanged
- `POST /api/themes` - Fetches from Notion, parses hierarchy, returns ThemeData

### Modified
- `POST /api/classify` - Fetch themes from Convex instead of Notion
- All `/api/notion/*` routes - Remove apiKey from request body, use env only

## UI Flow

### /themes (List Page)

```
┌─────────────────────────────────────────────────────────┐
│ Theme Pages                        [+ Add Theme Page]   │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Ethics Themes                                       │ │
│ │ 12 main themes · 45 mini themes · 150 questions     │ │
│ │ Last synced: 2 hours ago                            │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ GS4 Themes                                          │ │
│ │ 8 main themes · 32 mini themes · 89 questions       │ │
│ │ Last synced: 1 day ago                              │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### /themes/[id] (Detail Page)

- Theme tree view (existing component)
- Stats display
- Resync button
- Delete button (with warning if projects use it)

### Add Theme Page Dialog

```
┌─────────────────────────────────────────┐
│ Add Theme Page                          │
├─────────────────────────────────────────┤
│ Search Notion pages...                  │
│ ┌─────────────────────────────────────┐ │
│ │ 🔍 Search...                        │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Search results:                         │
│ • Ethics Themes                         │
│ • GS4 Question Bank                     │
│ • Essay Topics 2024                     │
│                                         │
│              [Cancel]  [Add Theme Page] │
└─────────────────────────────────────────┘
```

### Project Creation Dialog

```
┌─────────────────────────────────────────┐
│ Create New Project                      │
├─────────────────────────────────────────┤
│ Project Name *                          │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Description                             │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Theme Page *                            │
│ ┌─────────────────────────────────────┐ │
│ │ Select a theme page...          ▼   │ │
│ └─────────────────────────────────────┘ │
│   • Ethics Themes (150 questions)       │
│   • GS4 Themes (89 questions)           │
│   ─────────────────────────────────     │
│   • + Add new theme page...             │
│                                         │
│              [Cancel]  [Create Project] │
└─────────────────────────────────────────┘
```

## Error States

### Project with Deleted Theme Page

```
┌─────────────────────────────────────────┐
│ ⚠️ Theme Page Unavailable               │
│                                         │
│ The theme page for this project was     │
│ deleted. Select a new one to continue.  │
│                                         │
│ [Select Theme Page ▼]                   │
└─────────────────────────────────────────┘
```

### Delete Confirmation

```
┌─────────────────────────────────────────┐
│ Delete "Ethics Themes"?                 │
├─────────────────────────────────────────┤
│ ⚠️ 3 projects are using this theme page │
│                                         │
│ These projects will need a new theme    │
│ page selected before classification.    │
│                                         │
│              [Cancel]  [Delete Anyway]  │
└─────────────────────────────────────────┘
```

### Duplicate Prevention

When adding a theme page that already exists:
"This Notion page is already added as [Title]" with link to existing.

## Settings Cleanup

| Setting | Action |
|---------|--------|
| `notionApiKey` | **Remove** - env var only |
| `themePageId` | **Remove** - now per-project in Convex |
| `themePageTitle` | **Remove** - now in Convex |
| `strategyPageId` | Keep |
| `outputPageId` | Keep |
| `modelConfig` | Keep |
| `extractionParameters` | Keep |

## Files Changed

### New Files
```
convex/theme-pages.ts              # Queries and mutations
components/theme-page-card.tsx     # Card for list view
components/theme-page-list.tsx     # List with empty state
components/add-theme-page-dialog.tsx # Dialog with Notion search
```

### Modified Files
```
convex/schema.ts                   # Add themePages, modify projects
convex/projects.ts                 # Add themePageId, listByThemePage
components/themes-content.tsx      # Rewrite as list view
components/theme-detail-content.tsx # Add resync/delete, load from Convex
components/create-project-dialog.tsx # Add theme page selector
components/project-detail-content.tsx # Handle missing theme state
components/notion-connector.tsx    # Simplify to env check only
lib/hooks/use-settings.ts          # Remove theme-related fields
app/api/notion/*.ts                # Remove apiKey from request body
app/api/themes/route.ts            # Use env for API key
app/api/classify/route.ts          # Fetch themes from Convex
```

---

## Implementation Sprints

### Sprint 13.1: Schema & Convex Functions

**Goal:** Set up database foundation

**Tasks:**
- [ ] 13.1.1: Update `convex/schema.ts` - add themePages table, add themePageId to projects
- [ ] 13.1.2: Create `convex/theme-pages.ts` - list, get, getByNotionId, create, sync, remove
- [ ] 13.1.3: Update `convex/projects.ts` - add themePageId to create, add listByThemePage query
- [ ] 13.1.4: Delete existing projects from Convex dashboard (clean slate)
- [ ] 13.1.5: Run `bunx convex dev` to deploy schema changes

### Sprint 13.2: API & Settings Cleanup

**Goal:** Remove localStorage dependencies, secure API key handling

**Tasks:**
- [ ] 13.2.1: Update `lib/hooks/use-settings.ts` - remove notionApiKey, themePageId, themePageTitle
- [ ] 13.2.2: Create `lib/notion/config.ts` - helper to get API key from env only
- [ ] 13.2.3: Update `app/api/notion/connect/route.ts` - use env, remove apiKey from body
- [ ] 13.2.4: Update `app/api/notion/search/route.ts` - use env, remove apiKey from body
- [ ] 13.2.5: Update `app/api/themes/route.ts` - use env, remove apiKey from body
- [ ] 13.2.6: Update `app/api/classify/route.ts` - fetch themes from Convex instead of Notion
- [ ] 13.2.7: Simplify `components/notion-connector.tsx` - env check only, no API key input

### Sprint 13.3: Theme Pages List UI

**Goal:** New /themes list page with add functionality

**Tasks:**
- [ ] 13.3.1: Create `components/theme-page-card.tsx` - card with title, stats, last synced
- [ ] 13.3.2: Create `components/add-theme-page-dialog.tsx` - Notion search, create in Convex
- [ ] 13.3.3: Create `components/theme-page-list.tsx` - list container with empty state
- [ ] 13.3.4: Rewrite `components/themes-content.tsx` - use ThemePageList, add button
- [ ] 13.3.5: Add duplicate prevention check in AddThemePageDialog

### Sprint 13.4: Theme Page Detail UI

**Goal:** Update detail page with resync/delete

**Tasks:**
- [ ] 13.4.1: Update `components/theme-detail-content.tsx` - load from Convex instead of API
- [ ] 13.4.2: Add resync button - fetches from Notion, updates Convex
- [ ] 13.4.3: Add delete button with confirmation dialog
- [ ] 13.4.4: Show affected projects count in delete confirmation
- [ ] 13.4.5: Update `app/themes/[id]/page.tsx` if needed

### Sprint 13.5: Project Creation Flow

**Goal:** Require theme page selection when creating projects

**Tasks:**
- [ ] 13.5.1: Update `components/create-project-dialog.tsx` - add theme page dropdown
- [ ] 13.5.2: Add "Add new theme page" option in dropdown (opens AddThemePageDialog)
- [ ] 13.5.3: Disable create button until theme page selected
- [ ] 13.5.4: Update `components/project-detail-content.tsx` - handle missing theme page state
- [ ] 13.5.5: Add theme page reassignment UI for projects with deleted themes

### Sprint 13.6: Testing & Cleanup

**Goal:** Verify everything works, clean up

**Tasks:**
- [ ] 13.6.1: Test full flow: add theme page → create project → view themes
- [ ] 13.6.2: Test resync functionality
- [ ] 13.6.3: Test delete with affected projects warning
- [ ] 13.6.4: Test classification workflow with new theme source
- [ ] 13.6.5: Run `bun run check` - fix any lint/type errors
- [ ] 13.6.6: Update `docs/progress.md` and `docs/learnings.md`
