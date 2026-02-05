# Project Page Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all project page issues — persist pipeline results in Convex, add visual pipeline stepper, enable edit/search, add bulk processing/export/asset reuse, and toast notifications.

**Architecture:** Add 3 new Convex tables (`classificationJobs`, `comparisonResults`, `generatedNotes`) for pipeline result persistence. API routes write to Convex on job completion. Components use `useQuery` subscriptions for real-time state. Horizontal stepper derives state from Convex data. Sonner provides toast notifications.

**Tech Stack:** Convex (database + real-time subscriptions), Sonner (toasts), ConvexHttpClient (server-side writes), existing shadcn/ui components.

---

## Sprint A: Persistence Layer

### Task 1: Add Convex Schema Tables

**Files:**
- Modify: `convex/schema.ts`

**Step 1: Add three new table definitions after the `extractionResults` table (after line 109)**

Add these tables to `convex/schema.ts` inside the `defineSchema({})` call:

```typescript
classificationJobs: defineTable({
  projectId: v.id("projects"),
  themePageId: v.id("themePages"),
  jobId: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("processing"),
    v.literal("completed"),
    v.literal("failed")
  ),
  progress: v.number(),
  totalItems: v.number(),
  classifiedItems: v.number(),
  resultsKey: v.string(),
  stats: v.optional(
    v.object({
      classified: v.number(),
      unclassified: v.number(),
      multiTheme: v.number(),
      themesWithContent: v.number(),
    })
  ),
  error: v.optional(v.string()),
  createdAt: v.string(),
  completedAt: v.optional(v.string()),
})
  .index("by_project", ["projectId"])
  .index("by_job_id", ["jobId"]),

comparisonResults: defineTable({
  projectId: v.id("projects"),
  themePageId: v.id("themePages"),
  miniThemeId: v.string(),
  mainThemeId: v.string(),
  score: v.number(),
  jobId: v.string(),
  resultsKey: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("completed"),
    v.literal("failed")
  ),
  error: v.optional(v.string()),
  createdAt: v.string(),
})
  .index("by_project", ["projectId"])
  .index("by_mini_theme", ["projectId", "miniThemeId"]),

generatedNotes: defineTable({
  projectId: v.id("projects"),
  miniThemeId: v.string(),
  mainThemeId: v.string(),
  mainThemeTitle: v.string(),
  miniThemeTitle: v.string(),
  resultsKey: v.string(),
  syncStatus: v.union(
    v.literal("not_synced"),
    v.literal("synced"),
    v.literal("failed")
  ),
  notionPageId: v.optional(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
})
  .index("by_project", ["projectId"])
  .index("by_mini_theme", ["projectId", "miniThemeId"]),
```

**Step 2: Deploy schema**

Run: `bunx convex dev`
Expected: Schema deployed successfully, types regenerated.

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add classificationJobs, comparisonResults, generatedNotes tables"
```

---

### Task 2: Create Convex Functions — classificationJobs

**Files:**
- Create: `convex/classificationJobs.ts`

**Step 1: Create the file with CRUD functions**

Follow the patterns from `convex/extractionResults.ts` (upsert by project, validate foreign keys):

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const jobs = await ctx.db
      .query("classificationJobs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .collect();
    return jobs.map((job) => ({ ...job, id: job._id }));
  },
});

export const getLatestByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const job = await ctx.db
      .query("classificationJobs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();
    if (!job) {
      return null;
    }
    return { ...job, id: job._id };
  },
});

export const upsert = mutation({
  args: {
    projectId: v.id("projects"),
    themePageId: v.id("themePages"),
    jobId: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.number(),
    totalItems: v.number(),
    classifiedItems: v.number(),
    resultsKey: v.string(),
    stats: v.optional(
      v.object({
        classified: v.number(),
        unclassified: v.number(),
        multiTheme: v.number(),
        themesWithContent: v.number(),
      })
    ),
    error: v.optional(v.string()),
    completedAt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    const existing = await ctx.db
      .query("classificationJobs")
      .withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
      .first();

    const now = new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        progress: args.progress,
        totalItems: args.totalItems,
        classifiedItems: args.classifiedItems,
        resultsKey: args.resultsKey,
        stats: args.stats,
        error: args.error,
        completedAt: args.completedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("classificationJobs", {
      ...args,
      createdAt: now,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("classificationJobs") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const removeByProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const jobs = await ctx.db
      .query("classificationJobs")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const job of jobs) {
      await ctx.db.delete(job._id);
    }
    return jobs.length;
  },
});
```

**Step 2: Verify types compile**

Run: `bunx convex dev`
Expected: No errors.

**Step 3: Commit**

```bash
git add convex/classificationJobs.ts
git commit -m "feat: add classificationJobs Convex functions"
```

---

### Task 3: Create Convex Functions — comparisonResults

**Files:**
- Create: `convex/comparisonResults.ts`

**Step 1: Create the file**

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const results = await ctx.db
      .query("comparisonResults")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return results.map((r) => ({ ...r, id: r._id }));
  },
});

export const getByMiniTheme = query({
  args: { projectId: v.id("projects"), miniThemeId: v.string() },
  handler: async (ctx, { projectId, miniThemeId }) => {
    const result = await ctx.db
      .query("comparisonResults")
      .withIndex("by_mini_theme", (q) =>
        q.eq("projectId", projectId).eq("miniThemeId", miniThemeId)
      )
      .first();
    if (!result) {
      return null;
    }
    return { ...result, id: result._id };
  },
});

export const upsert = mutation({
  args: {
    projectId: v.id("projects"),
    themePageId: v.id("themePages"),
    miniThemeId: v.string(),
    mainThemeId: v.string(),
    score: v.number(),
    jobId: v.string(),
    resultsKey: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("comparisonResults")
      .withIndex("by_mini_theme", (q) =>
        q.eq("projectId", args.projectId).eq("miniThemeId", args.miniThemeId)
      )
      .first();

    const now = new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        score: args.score,
        jobId: args.jobId,
        resultsKey: args.resultsKey,
        status: args.status,
        error: args.error,
        createdAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("comparisonResults", {
      ...args,
      createdAt: now,
    });
  },
});

export const removeByProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const results = await ctx.db
      .query("comparisonResults")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const r of results) {
      await ctx.db.delete(r._id);
    }
    return results.length;
  },
});
```

**Step 2: Verify types compile**

Run: `bunx convex dev`
Expected: No errors.

**Step 3: Commit**

```bash
git add convex/comparisonResults.ts
git commit -m "feat: add comparisonResults Convex functions"
```

---

### Task 4: Create Convex Functions — generatedNotes

**Files:**
- Create: `convex/generatedNotes.ts`

**Step 1: Create the file**

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const notes = await ctx.db
      .query("generatedNotes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return notes.map((n) => ({ ...n, id: n._id }));
  },
});

export const getByMiniTheme = query({
  args: { projectId: v.id("projects"), miniThemeId: v.string() },
  handler: async (ctx, { projectId, miniThemeId }) => {
    const note = await ctx.db
      .query("generatedNotes")
      .withIndex("by_mini_theme", (q) =>
        q.eq("projectId", projectId).eq("miniThemeId", miniThemeId)
      )
      .first();
    if (!note) {
      return null;
    }
    return { ...note, id: note._id };
  },
});

export const upsert = mutation({
  args: {
    projectId: v.id("projects"),
    miniThemeId: v.string(),
    mainThemeId: v.string(),
    mainThemeTitle: v.string(),
    miniThemeTitle: v.string(),
    resultsKey: v.string(),
    syncStatus: v.union(
      v.literal("not_synced"),
      v.literal("synced"),
      v.literal("failed")
    ),
    notionPageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("generatedNotes")
      .withIndex("by_mini_theme", (q) =>
        q.eq("projectId", args.projectId).eq("miniThemeId", args.miniThemeId)
      )
      .first();

    const now = new Date().toISOString();

    if (existing) {
      await ctx.db.patch(existing._id, {
        mainThemeTitle: args.mainThemeTitle,
        miniThemeTitle: args.miniThemeTitle,
        resultsKey: args.resultsKey,
        syncStatus: args.syncStatus,
        notionPageId: args.notionPageId,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("generatedNotes", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateSyncStatus = mutation({
  args: {
    id: v.id("generatedNotes"),
    syncStatus: v.union(
      v.literal("not_synced"),
      v.literal("synced"),
      v.literal("failed")
    ),
    notionPageId: v.optional(v.string()),
  },
  handler: async (ctx, { id, syncStatus, notionPageId }) => {
    const note = await ctx.db.get(id);
    if (!note) {
      throw new Error("Note not found");
    }
    await ctx.db.patch(id, {
      syncStatus,
      notionPageId,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const removeByProject = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const notes = await ctx.db
      .query("generatedNotes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const n of notes) {
      await ctx.db.delete(n._id);
    }
    return notes.length;
  },
});
```

**Step 2: Verify types compile**

Run: `bunx convex dev`
Expected: No errors.

**Step 3: Commit**

```bash
git add convex/generatedNotes.ts
git commit -m "feat: add generatedNotes Convex functions"
```

---

### Task 5: Update `/api/classify` to Persist to Convex

**Files:**
- Modify: `app/api/classify/route.ts`

**Step 1: Add Convex persistence after classification completes**

In the POST handler, after the classification results are saved to R2 (around line 830 where `processing/${jobId}/classification-results.json` is written), add a Convex write. The `getConvexClient()` helper already exists (line 74-79).

Find the section where classification completes successfully (after `completeJob(jobId)` is called) and add:

```typescript
// After completeJob(jobId) and the R2 results save:
try {
  const convex = getConvexClient();
  await convex.mutation(api.classificationJobs.upsert, {
    projectId: resolvedProjectId as never,
    themePageId: themePageId as never,
    jobId,
    status: "completed" as const,
    progress: 100,
    totalItems: classifiedContent.length,
    classifiedItems: classificationStats.classification.totalClassified,
    resultsKey: `processing/${jobId}/classification-results.json`,
    stats: {
      classified: classificationStats.classification.totalClassified,
      unclassified: classificationStats.classification.totalUnclassified,
      multiTheme: classificationStats.crossTheme?.multiThemeCount ?? 0,
      themesWithContent: classificationStats.aggregation?.themesWithContent ?? 0,
    },
    completedAt: new Date().toISOString(),
  });
} catch (convexError) {
  console.warn("[Classify] Failed to persist to Convex:", convexError);
}
```

Also add the import at the top: `import { api } from "@/convex/_generated/api";`

Similarly, in the failure path, persist the failed status:

```typescript
// In the catch/error handler:
try {
  const convex = getConvexClient();
  await convex.mutation(api.classificationJobs.upsert, {
    projectId: resolvedProjectId as never,
    themePageId: themePageId as never,
    jobId,
    status: "failed" as const,
    progress: 0,
    totalItems: 0,
    classifiedItems: 0,
    resultsKey: "",
    error: errorMessage,
  });
} catch (convexError) {
  console.warn("[Classify] Failed to persist failure to Convex:", convexError);
}
```

**Step 2: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 3: Commit**

```bash
git add app/api/classify/route.ts
git commit -m "feat: persist classification results to Convex"
```

---

### Task 6: Update `/api/compare` to Persist to Convex

**Files:**
- Modify: `app/api/compare/route.ts`

**Step 1: Add ConvexHttpClient setup and persistence**

Add at the top of the file:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
```

Add a helper (matching the pattern from classify/route.ts):

```typescript
function getConvexClient(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
  }
  return new ConvexHttpClient(url);
}
```

After comparison results are saved to R2 (around line 537) and `completeJob(jobId)` is called, add:

```typescript
try {
  const convex = getConvexClient();
  await convex.mutation(api.comparisonResults.upsert, {
    projectId: projectId as never,
    themePageId: themePageId as never,
    miniThemeId,
    mainThemeId,
    score: comparisonResult.overallScore,
    jobId,
    resultsKey: `processing/${jobId}/comparison-results.json`,
    status: "completed" as const,
  });
} catch (convexError) {
  console.warn("[Compare] Failed to persist to Convex:", convexError);
}
```

Add a similar block in the error handler for failed comparisons.

**Step 2: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 3: Commit**

```bash
git add app/api/compare/route.ts
git commit -m "feat: persist comparison results to Convex"
```

---

### Task 7: Update `/api/generate` to Persist to Convex

**Files:**
- Modify: `app/api/generate/route.ts`

**Step 1: Add Convex persistence after note generation**

Add imports:

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
```

After the note is generated and returned successfully (around line 127), add Convex write:

```typescript
// After generating the note, before returning response:
if (projectId) {
  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      const resultsKey = `projects/${projectId}/notes/${miniTheme.id}.json`;
      // Store the note content in R2 too
      const { uploadToR2 } = await import("@/lib/storage");
      await uploadToR2(
        resultsKey,
        Buffer.from(JSON.stringify(note)),
        "application/json"
      );
      await convex.mutation(api.generatedNotes.upsert, {
        projectId: projectId as never,
        miniThemeId: miniTheme.id,
        mainThemeId: mainTheme.id,
        mainThemeTitle: mainTheme.title,
        miniThemeTitle: miniTheme.title,
        resultsKey,
        syncStatus: "not_synced" as const,
      });
    }
  } catch (convexError) {
    console.warn("[Generate] Failed to persist to Convex:", convexError);
  }
}
```

**Step 2: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 3: Commit**

```bash
git add app/api/generate/route.ts
git commit -m "feat: persist generated notes to Convex and R2"
```

---

### Task 8: Update Project Workflow to Load from Convex

**Files:**
- Modify: `components/project-workflow.tsx`

This is the largest change. The current component (1316 lines) stores classification/comparison state in `useState` and persists job IDs to `localStorage`. We need to:

1. Replace localStorage job ID persistence with Convex queries
2. Load classification state from `classificationJobs` on mount
3. Load comparison results from `comparisonResults` on mount
4. Load generated notes from `generatedNotes` on mount

**Step 1: Add Convex imports and queries**

At the top of the component, add:

```typescript
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
```

Inside the component, add queries:

```typescript
// Replace localStorage-based state recovery with Convex queries
const latestClassification = useQuery(
  api.classificationJobs.getLatestByProject,
  projectId ? { projectId: projectId as never } : "skip"
);
const persistedComparisons = useQuery(
  api.comparisonResults.listByProject,
  projectId ? { projectId: projectId as never } : "skip"
);
const persistedNotes = useQuery(
  api.generatedNotes.listByProject,
  projectId ? { projectId: projectId as never } : "skip"
);
```

**Step 2: Initialize state from Convex data**

Add a `useEffect` that populates the existing state variables from Convex on mount:

```typescript
// Initialize classification state from Convex
useEffect(() => {
  if (latestClassification && latestClassification.status === "completed") {
    setClassification((prev) => ({
      ...prev,
      jobId: latestClassification.jobId,
      status: "completed",
      progress: 100,
      totalItems: latestClassification.totalItems,
      processedItems: latestClassification.classifiedItems,
    }));
  }
}, [latestClassification]);

// Initialize comparison scores from Convex
useEffect(() => {
  if (persistedComparisons && persistedComparisons.length > 0) {
    setComparisons((prev) => {
      const next = { ...prev };
      for (const comp of persistedComparisons) {
        if (comp.status === "completed") {
          next[comp.miniThemeId] = {
            ...next[comp.miniThemeId],
            status: "completed",
            score: comp.score,
            jobId: comp.jobId,
          };
        }
      }
      return next;
    });
  }
}, [persistedComparisons]);
```

**Step 3: Remove localStorage job ID persistence**

Find and remove all `localStorage.setItem` / `localStorage.getItem` calls for classification job IDs. These will be lines using patterns like:
- `localStorage.setItem("classificationJobId_...", jobId)`
- `const savedJobId = localStorage.getItem("classificationJobId_...")`

Replace the recovery logic with the Convex-based state initialization above.

**Step 4: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 5: Commit**

```bash
git add components/project-workflow.tsx
git commit -m "feat: load pipeline state from Convex instead of localStorage"
```

---

## Sprint B: Project Page UX

### Task 9: Install Sonner + Add Toaster to Layout

**Files:**
- Modify: `package.json` (via bun add)
- Modify: `app/layout.tsx`

**Step 1: Install sonner**

Run: `bun add sonner`

**Step 2: Add Toaster to root layout**

In `app/layout.tsx`, add the Toaster inside the body, after AppShell:

```tsx
import { Toaster } from "sonner";

// In the JSX, after </ConvexClientProvider>:
<ConvexClientProvider>
  <AppShell>{children}</AppShell>
  <Toaster richColors position="bottom-right" />
</ConvexClientProvider>
```

**Step 3: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 4: Commit**

```bash
git add package.json bun.lock app/layout.tsx
git commit -m "feat: install sonner and add Toaster to root layout"
```

---

### Task 10: Create Pipeline Stepper Component

**Files:**
- Create: `components/pipeline-stepper.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { Check, Circle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "active" | "completed" | "failed";

export interface PipelineStep {
  id: string;
  label: string;
  status: StepStatus;
  count?: number;
}

interface PipelineStepperProps {
  steps: PipelineStep[];
  onStepClick?: (stepId: string) => void;
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
        <Check className="h-4 w-4" />
      </div>
    );
  }
  if (status === "active") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400">
        <X className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Circle className="h-3 w-3" />
    </div>
  );
}

function StepConnector({ completed }: { completed: boolean }) {
  return (
    <div
      className={cn(
        "hidden h-0.5 flex-1 sm:block",
        completed ? "bg-emerald-500/40" : "bg-muted"
      )}
    />
  );
}

export function PipelineStepper({ steps, onStepClick }: PipelineStepperProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, index) => (
        <div key={step.id} className="contents">
          {index > 0 && (
            <StepConnector
              completed={
                step.status === "completed" || step.status === "active"
              }
            />
          )}
          <button
            type="button"
            onClick={() => onStepClick?.(step.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50",
              step.status === "active" && "bg-blue-500/5"
            )}
          >
            <StepIcon status={step.status} />
            <span
              className={cn(
                "text-xs whitespace-nowrap",
                step.status === "active" && "font-semibold text-blue-400",
                step.status === "completed" && "text-emerald-400",
                step.status === "failed" && "text-red-400",
                step.status === "pending" && "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
            {step.count !== undefined && step.count > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {step.count}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
```

**Step 2: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 3: Commit**

```bash
git add components/pipeline-stepper.tsx
git commit -m "feat: create PipelineStepper component"
```

---

### Task 11: Integrate Stepper into Project Detail Page

**Files:**
- Modify: `components/project-detail-content.tsx`

**Step 1: Add imports and Convex queries**

Add at the top:

```typescript
import { PipelineStepper, type PipelineStep } from "@/components/pipeline-stepper";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
```

**Step 2: Add queries and derive stepper state**

Inside the component, add:

```typescript
const latestClassification = useQuery(
  api.classificationJobs.getLatestByProject,
  project ? { projectId: project.id as never } : "skip"
);
const comparisonResults = useQuery(
  api.comparisonResults.listByProject,
  project ? { projectId: project.id as never } : "skip"
);
const generatedNotes = useQuery(
  api.generatedNotes.listByProject,
  project ? { projectId: project.id as never } : "skip"
);
const projectAssets = useQuery(
  api.assets.listByProject,
  project ? { projectId: project.id as never } : "skip"
);
```

Add a `useMemo` to derive pipeline steps:

```typescript
const pipelineSteps = useMemo((): PipelineStep[] => {
  const sources = project?.sources ?? [];
  const completedSources = sources.filter((s) => s.status === "completed").length;
  const processingSources = sources.filter((s) => s.status === "processing").length;
  const totalSources = sources.length;

  const extractionComplete = (projectAssets ?? []).some(
    (a) => a.processingStatus === "extraction_completed"
  );
  const extractionProcessing = (projectAssets ?? []).some(
    (a) =>
      a.processingStatus === "extraction_processing" ||
      a.processingStatus === "ocr_processing"
  );

  const classStatus = latestClassification?.status;
  const compCount = (comparisonResults ?? []).filter(
    (c) => c.status === "completed"
  ).length;
  const noteCount = (generatedNotes ?? []).length;

  function deriveSourceStatus(): "pending" | "active" | "completed" | "failed" {
    if (totalSources === 0) { return "pending"; }
    if (processingSources > 0) { return "active"; }
    if (completedSources === totalSources) { return "completed"; }
    return "pending";
  }

  function deriveExtractionStatus(): "pending" | "active" | "completed" | "failed" {
    if (extractionComplete) { return "completed"; }
    if (extractionProcessing) { return "active"; }
    return "pending";
  }

  function deriveClassificationStatus(): "pending" | "active" | "completed" | "failed" {
    if (classStatus === "completed") { return "completed"; }
    if (classStatus === "processing") { return "active"; }
    if (classStatus === "failed") { return "failed"; }
    return "pending";
  }

  return [
    { id: "sources", label: "Sources", status: deriveSourceStatus(), count: totalSources },
    { id: "extraction", label: "Extraction", status: deriveExtractionStatus() },
    { id: "classification", label: "Classification", status: deriveClassificationStatus() },
    { id: "comparison", label: "Comparison", status: compCount > 0 ? "completed" : "pending", count: compCount },
    { id: "notes", label: "Notes", status: noteCount > 0 ? "completed" : "pending", count: noteCount },
  ];
}, [project, projectAssets, latestClassification, comparisonResults, generatedNotes]);

function handleStepClick(stepId: string) {
  const element = document.getElementById(`section-${stepId}`);
  if (element) {
    element.scrollIntoView({ behavior: "smooth" });
  }
}
```

**Step 3: Add stepper to JSX and section IDs**

Place the stepper after the header, before the theme page card:

```tsx
{project && project.themePageId && (
  <PipelineStepper steps={pipelineSteps} onStepClick={handleStepClick} />
)}
```

Add `id="section-sources"`, `id="section-extraction"`, `id="section-classification"`, `id="section-comparison"`, `id="section-notes"` to the corresponding Card/section wrappers already in the JSX.

**Step 4: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 5: Commit**

```bash
git add components/project-detail-content.tsx
git commit -m "feat: integrate pipeline stepper into project detail page"
```

---

### Task 12: Create Edit Project Dialog

**Files:**
- Create: `components/edit-project-dialog.tsx`

**Step 1: Create the component**

Based on `create-project-dialog.tsx` (229 lines), create an edit variant:

```tsx
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    name: string;
    description?: string;
    themePageId?: string;
  };
}

export function EditProjectDialog({
  open,
  onOpenChange,
  project,
}: EditProjectDialogProps) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [themePageId, setThemePageId] = useState(project.themePageId ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const updateProject = useMutation(api.projects.update);
  const themePages = useQuery(api.themePages.list);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await updateProject({
        id: project.id as never,
        name: name.trim(),
        description: description.trim() || undefined,
        themePageId: themePageId ? (themePageId as never) : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-theme">Theme Page</Label>
            <Select value={themePageId} onValueChange={setThemePageId}>
              <SelectTrigger id="edit-theme">
                <SelectValue placeholder="Select theme page" />
              </SelectTrigger>
              <SelectContent>
                {(themePages ?? []).map((tp) => (
                  <SelectItem key={tp._id} value={tp._id}>
                    {tp.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 3: Commit**

```bash
git add components/edit-project-dialog.tsx
git commit -m "feat: create EditProjectDialog component"
```

---

### Task 13: Enable Edit Button + Wire Up Dialog

**Files:**
- Modify: `components/project-detail-content.tsx`

**Step 1: Add state and import**

Add import:
```typescript
import { EditProjectDialog } from "@/components/edit-project-dialog";
```

Add state:
```typescript
const [showEditProject, setShowEditProject] = useState(false);
```

**Step 2: Enable the disabled edit button**

Find the DropdownMenuItem for "Edit Project" (it has `disabled` prop). Remove `disabled` and add an `onClick`:

```tsx
<DropdownMenuItem onClick={() => setShowEditProject(true)}>
  <Pencil className="mr-2 h-4 w-4" />
  Edit Project
</DropdownMenuItem>
```

**Step 3: Add the dialog to JSX**

Before the closing `</>` of the component, add:

```tsx
{project && (
  <EditProjectDialog
    open={showEditProject}
    onOpenChange={setShowEditProject}
    project={{
      id: project.id,
      name: project.name,
      description: project.description,
      themePageId: project.themePageId,
    }}
  />
)}
```

**Step 4: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 5: Commit**

```bash
git add components/project-detail-content.tsx
git commit -m "feat: enable Edit Project button with dialog"
```

---

### Task 14: Add Search to Projects List

**Files:**
- Modify: `components/projects-content.tsx`

**Step 1: Add search state and filter logic**

Add state:
```typescript
const [searchQuery, setSearchQuery] = useState("");
```

Add filtering with `useMemo`:
```typescript
const filteredProjects = useMemo(() => {
  if (!projects || !searchQuery.trim()) {
    return projects;
  }
  const query = searchQuery.toLowerCase();
  return projects.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
  );
}, [projects, searchQuery]);
```

**Step 2: Add search input above the grid**

After the Patterns Summary Card and before the projects grid, add:

```tsx
{projects && projects.length > 0 && (
  <div className="relative">
    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      placeholder="Search projects..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="pl-9"
    />
  </div>
)}
```

Add `Search` to the Lucide imports. Use `filteredProjects` instead of `projects` in the grid render.

**Step 3: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 4: Commit**

```bash
git add components/projects-content.tsx
git commit -m "feat: add search input to projects list"
```

---

### Task 15: Add Toast Notifications for Job Completions

**Files:**
- Modify: `components/project-detail-content.tsx`

**Step 1: Add toast imports and status watchers**

Add import:
```typescript
import { toast } from "sonner";
```

Add `useEffect` watchers that fire toasts when Convex data changes:

```typescript
// Track previous classification status for transition detection
const prevClassStatusRef = useRef(latestClassification?.status);

useEffect(() => {
  const prevStatus = prevClassStatusRef.current;
  const newStatus = latestClassification?.status;
  prevClassStatusRef.current = newStatus;

  if (!prevStatus || !newStatus || prevStatus === newStatus) {
    return;
  }

  if (newStatus === "completed") {
    toast.success("Classification complete", {
      description: `${latestClassification?.classifiedItems ?? 0} items classified`,
      action: {
        label: "View",
        onClick: () => document.getElementById("section-classification")?.scrollIntoView({ behavior: "smooth" }),
      },
    });
  } else if (newStatus === "failed") {
    toast.error("Classification failed", {
      description: latestClassification?.error ?? "Unknown error",
    });
  }
}, [latestClassification]);
```

Add a similar watcher for comparison results (track length changes):

```typescript
const prevCompCountRef = useRef(0);

useEffect(() => {
  const newCount = (comparisonResults ?? []).filter((c) => c.status === "completed").length;
  if (newCount > prevCompCountRef.current && prevCompCountRef.current > 0) {
    toast.success("Comparison complete", {
      description: `${newCount} themes compared`,
    });
  }
  prevCompCountRef.current = newCount;
}, [comparisonResults]);
```

Add `useRef` to React imports.

**Step 2: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 3: Commit**

```bash
git add components/project-detail-content.tsx
git commit -m "feat: add toast notifications for pipeline job completions"
```

---

## Sprint C: Features

### Task 16: Add Bulk Processing Button

**Files:**
- Modify: `components/project-detail-content.tsx`

**Step 1: Add bulk processing handler**

```typescript
const [isBulkProcessing, setIsBulkProcessing] = useState(false);

async function handleProcessAll() {
  if (!project) { return; }
  const pendingSources = project.sources.filter(
    (s) => s.status === "pending" || s.status === "failed"
  );
  if (pendingSources.length === 0) { return; }

  setIsBulkProcessing(true);
  let successCount = 0;

  try {
    const results = await Promise.allSettled(
      pendingSources.map(async (source) => {
        const res = await fetch("/api/sources/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: source.id,
            projectId: project.id,
            reference: source.reference,
            type: source.type,
          }),
        });
        if (!res.ok) {
          throw new Error(`Failed to process ${source.name}`);
        }
        return source.name;
      })
    );

    successCount = results.filter((r) => r.status === "fulfilled").length;
    const failCount = results.filter((r) => r.status === "rejected").length;

    if (failCount > 0) {
      toast.warning(`Processed ${successCount}/${pendingSources.length} sources`, {
        description: `${failCount} failed to start`,
      });
    } else {
      toast.success(`Processing ${successCount} sources`);
    }
  } catch (err) {
    toast.error("Bulk processing failed");
  } finally {
    setIsBulkProcessing(false);
  }
}
```

**Step 2: Add the button to the sources section header**

Next to "Add Source" button, add:

```tsx
{project && project.sources.some((s) => s.status === "pending" || s.status === "failed") && (
  <Button
    variant="outline"
    size="sm"
    onClick={handleProcessAll}
    disabled={isBulkProcessing}
  >
    {isBulkProcessing ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <Play className="mr-2 h-4 w-4" />
    )}
    Process All ({project.sources.filter((s) => s.status === "pending" || s.status === "failed").length})
  </Button>
)}
```

**Step 3: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 4: Commit**

```bash
git add components/project-detail-content.tsx
git commit -m "feat: add bulk Process All button for sources"
```

---

### Task 17: Add Export Utilities

**Files:**
- Create: `lib/utils/export.ts`

**Step 1: Create export utility functions**

```typescript
/**
 * Utility functions for exporting content as Markdown or JSON files.
 */

export function downloadAsFile(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadAsMarkdown(content: string, filename: string): void {
  downloadAsFile(content, `${filename}.md`, "text/markdown");
}

export function downloadAsJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  downloadAsFile(json, `${filename}.json`, "application/json");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
```

**Step 2: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 3: Commit**

```bash
git add lib/utils/export.ts
git commit -m "feat: add export utility functions (markdown, JSON, clipboard)"
```

---

### Task 18: Add Export Dropdown to Comparison Results & Notes

**Files:**
- Create: `components/export-menu.tsx`

**Step 1: Create a reusable export dropdown**

```tsx
"use client";

import { Clipboard, Download, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  copyToClipboard,
  downloadAsJson,
  downloadAsMarkdown,
} from "@/lib/utils/export";

interface ExportMenuProps {
  markdown: string;
  jsonData: unknown;
  filename: string;
}

export function ExportMenu({ markdown, jsonData, filename }: ExportMenuProps) {
  async function handleCopy() {
    const success = await copyToClipboard(markdown);
    if (success) {
      toast.success("Copied to clipboard");
    } else {
      toast.error("Failed to copy");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCopy}>
          <Clipboard className="mr-2 h-4 w-4" />
          Copy as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadAsMarkdown(markdown, filename)}>
          <FileText className="mr-2 h-4 w-4" />
          Download Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadAsJson(jsonData, filename)}>
          <FileJson className="mr-2 h-4 w-4" />
          Download JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Integrate into `project-workflow.tsx`**

In the ComparisonSection where comparison results are displayed (ThemeActions area), add the ExportMenu next to existing action buttons:

```tsx
import { ExportMenu } from "@/components/export-menu";

// In the ThemeActions render, after the comparison score badge:
{comparison?.results && (
  <ExportMenu
    markdown={formatComparisonAsMarkdown(comparison.results)}
    jsonData={comparison.results}
    filename={`comparison-${miniTheme.title.replace(/\s+/g, "-").toLowerCase()}`}
  />
)}
```

Add a simple markdown formatter function at the top of the file:

```typescript
function formatComparisonAsMarkdown(results: unknown): string {
  return `# Comparison Results\n\n${JSON.stringify(results, null, 2)}`;
}
```

Note: This is a minimal formatter. It can be improved later to produce rich markdown with headings, tables, etc.

**Step 3: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 4: Commit**

```bash
git add components/export-menu.tsx lib/utils/export.ts components/project-workflow.tsx
git commit -m "feat: add export dropdown to comparison results"
```

---

### Task 19: Add "From Library" Tab to Add Source Dialog

**Files:**
- Modify: `components/add-source-dialog.tsx`

**Step 1: Add the Library tab button**

Add a third tab button alongside the existing "notion" and "upload" tabs:

```tsx
<button
  type="button"
  onClick={() => setActiveTab("library")}
  className={cn(
    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    activeTab === "library"
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-muted"
  )}
>
  From Library
</button>
```

Update the `activeTab` state type to include `"library"`.

**Step 2: Add Convex query for available assets**

```typescript
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// Inside the component:
const allAssets = useQuery(api.assets.list, {});
const projectAssets = useQuery(
  api.assets.listByProject,
  projectId ? { projectId: projectId as never } : "skip"
);

const availableAssets = useMemo(() => {
  if (!allAssets || !projectAssets) { return []; }
  const assignedKeys = new Set(projectAssets.map((a) => a.key));
  return allAssets.filter(
    (a) =>
      a.processingStatus === "extraction_completed" &&
      !assignedKeys.has(a.key)
  );
}, [allAssets, projectAssets]);
```

**Step 3: Add the Library tab content**

```tsx
{activeTab === "library" && (
  <div className="space-y-3">
    <Input
      placeholder="Search assets..."
      value={librarySearch}
      onChange={(e) => setLibrarySearch(e.target.value)}
    />
    <div className="max-h-60 space-y-2 overflow-y-auto">
      {availableAssets
        .filter((a) =>
          a.filename.toLowerCase().includes(librarySearch.toLowerCase())
        )
        .map((asset) => (
          <button
            key={asset._id}
            type="button"
            className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted"
            onClick={() => handleAssignAsset(asset)}
          >
            <div>
              <p className="text-sm font-medium">{asset.filename}</p>
              <p className="text-xs text-muted-foreground">
                {asset.extractedItemCount ?? 0} items extracted
              </p>
            </div>
          </button>
        ))}
      {availableAssets.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No completed assets available
        </p>
      )}
    </div>
  </div>
)}
```

**Step 4: Add the assign handler**

```typescript
const [librarySearch, setLibrarySearch] = useState("");
const assignAsset = useMutation(api.assets.assignToProject);

async function handleAssignAsset(asset: { _id: string; filename: string }) {
  if (!projectId) { return; }
  setIsLoading(true);
  setError("");
  try {
    await assignAsset({
      id: asset._id as never,
      projectId: projectId as never,
    });
    toast.success(`Added "${asset.filename}" to project`);
    onOpenChange(false);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to assign asset");
  } finally {
    setIsLoading(false);
  }
}
```

Add `import { toast } from "sonner";` and `import { useMutation } from "convex/react";`.

**Step 5: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 6: Commit**

```bash
git add components/add-source-dialog.tsx
git commit -m "feat: add From Library tab to add source dialog"
```

---

### Task 20: Add Bulk Retry Failed Button

**Files:**
- Modify: `components/project-workflow.tsx`

**Step 1: Improve the existing retry logic**

The file already has a `retryFailedItems()` function and a FailedItemsCard. Enhance it to use toast notifications:

Add `import { toast } from "sonner";` at the top.

In the existing `retryFailedItems()` function, wrap the completion with toast:

```typescript
// After the existing retry logic completes:
toast.success(`Retrying ${failedCount} failed items`);
```

And on error:
```typescript
toast.error("Retry failed", { description: errorMessage });
```

The existing FailedItemsCard already has a "Retry failed items" button. Just ensure it's visible and uses the enhanced handler.

**Step 2: Verify build**

Run: `bun run check`
Expected: No errors.

**Step 3: Commit**

```bash
git add components/project-workflow.tsx
git commit -m "feat: add toast notifications to retry failed items"
```

---

## Sprint D: Testing & Polish

### Task 21: Run Full Check and Fix Lint Issues

**Step 1: Run typecheck + lint**

Run: `bun run check`

Fix any errors that come up. Common issues to watch for:
- Missing imports (Lucide icons, React hooks)
- Unused variables from refactoring
- Biome formatting (run `bun run fix`)
- Cognitive complexity (extract helpers if needed)
- `as never` casts for Convex IDs

**Step 2: Run auto-fix**

Run: `bun run fix`

**Step 3: Verify build**

Run: `bun run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: resolve lint and typecheck issues from project page overhaul"
```

---

### Task 22: Write Tests for Convex Functions

**Files:**
- Create: `convex/__tests__/classificationJobs.test.ts`
- Create: `convex/__tests__/comparisonResults.test.ts`
- Create: `convex/__tests__/generatedNotes.test.ts`

Note: Convex functions typically require integration tests with `convex-test`. Check if a testing setup exists. If not, write unit tests for the helper/utility logic and manual test the Convex functions via the app.

**Step 1: Check existing test patterns**

Run: `ls convex/__tests__/ 2>/dev/null || echo "No convex tests directory"`

If no test infrastructure exists for Convex, skip this task and document it as tech debt.

**Step 2: Commit if tests written**

```bash
git add convex/__tests__/
git commit -m "test: add tests for new Convex functions"
```

---

### Task 23: Write Tests for New Components

**Files:**
- Create: `components/__tests__/pipeline-stepper.test.tsx`
- Create: `components/__tests__/edit-project-dialog.test.tsx`
- Create: `components/__tests__/export-menu.test.tsx`

**Step 1: Write PipelineStepper tests**

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PipelineStepper } from "../pipeline-stepper";

const mockSteps = [
  { id: "sources", label: "Sources", status: "completed" as const, count: 3 },
  { id: "extraction", label: "Extraction", status: "active" as const },
  { id: "classification", label: "Classification", status: "pending" as const },
];

describe("PipelineStepper", () => {
  it("renders all steps", () => {
    render(<PipelineStepper steps={mockSteps} />);
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("Extraction")).toBeInTheDocument();
    expect(screen.getByText("Classification")).toBeInTheDocument();
  });

  it("shows count badge for steps with count", () => {
    render(<PipelineStepper steps={mockSteps} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onStepClick when step is clicked", () => {
    const onClick = vi.fn();
    render(<PipelineStepper steps={mockSteps} onStepClick={onClick} />);
    fireEvent.click(screen.getByText("Sources"));
    expect(onClick).toHaveBeenCalledWith("sources");
  });
});
```

**Step 2: Write ExportMenu tests**

```typescript
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportMenu } from "../export-menu";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ExportMenu", () => {
  it("renders the export button", () => {
    render(
      <ExportMenu markdown="# Test" jsonData={{ test: true }} filename="test" />
    );
    expect(screen.getByText("Export")).toBeInTheDocument();
  });
});
```

**Step 3: Run tests**

Run: `bun run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add components/__tests__/
git commit -m "test: add tests for PipelineStepper, ExportMenu"
```

---

### Task 24: Update Documentation

**Files:**
- Modify: `docs/progress.md`
- Modify: `docs/learnings.md`

**Step 1: Add progress entry**

Add to the top of `docs/progress.md` (after the Current Status section):

```markdown
## Project Page Overhaul (2026-02-06) - Complete

**Problem:** Project page had 14 issues: lost state on refresh, no visual pipeline progress, disabled edit, no search, no bulk processing, no export, no asset reuse, no notifications.

**Solution:**
1. Added 3 Convex tables (classificationJobs, comparisonResults, generatedNotes) for persistent pipeline state
2. API routes persist results to Convex on completion
3. Horizontal pipeline stepper shows progress across 5 stages
4. Edit project dialog, projects search, toast notifications via sonner
5. Bulk "Process All" button, export dropdown (Markdown/JSON/clipboard)
6. "From Library" tab for asset reuse across projects

### Files Created
- `convex/classificationJobs.ts` - Classification job persistence
- `convex/comparisonResults.ts` - Comparison result persistence
- `convex/generatedNotes.ts` - Generated note persistence
- `components/pipeline-stepper.tsx` - Horizontal pipeline progress stepper
- `components/edit-project-dialog.tsx` - Edit project form dialog
- `components/export-menu.tsx` - Reusable export dropdown (Markdown/JSON/clipboard)
- `lib/utils/export.ts` - Export utility functions

### Files Modified
- `convex/schema.ts` - Added 3 new tables
- `app/api/classify/route.ts` - Persist to Convex on completion
- `app/api/compare/route.ts` - Persist to Convex on completion
- `app/api/generate/route.ts` - Persist to Convex and R2 on completion
- `components/project-detail-content.tsx` - Stepper, edit, bulk process, toasts
- `components/project-workflow.tsx` - Load from Convex, export, toasts
- `components/projects-content.tsx` - Search input
- `components/add-source-dialog.tsx` - From Library tab
- `app/layout.tsx` - Sonner Toaster
```

**Step 2: Add learnings entry**

Add to `docs/learnings.md`:

```markdown
### 2026-02-06 - Convex Subscriptions Replace localStorage for Job State

**Context:** Pipeline results (classification, comparison, notes) were stored in localStorage job IDs and polled via API
**Problem:** Refreshing the page lost all pipeline progress; state was fragile and non-recoverable
**Solution:** Added Convex tables for each pipeline stage. API routes write to Convex on completion. Components use `useQuery` for real-time subscriptions — state survives refresh automatically.
**Lesson:** For any state that needs to survive page refresh, persist to Convex. useQuery subscriptions provide real-time updates without polling. Use `as never` for Convex ID casts in API routes.

### 2026-02-06 - useRef for Toast Transition Detection

**Context:** Needed to fire toast notifications when Convex data transitions (e.g., processing → completed)
**Problem:** useEffect fires on mount and every update — can't distinguish "initial load" from "real status change"
**Solution:** Use useRef to track previous status value. Only fire toast when previous !== current AND previous is defined (skips initial load).
**Lesson:** For detecting transitions in reactive data, use useRef to track previous values alongside useEffect.
```

**Step 3: Commit**

```bash
git add docs/progress.md docs/learnings.md
git commit -m "docs: update progress and learnings for project page overhaul"
```

---

## Summary

| Sprint | Tasks | New Files | Modified Files |
|--------|-------|-----------|----------------|
| A: Persistence | 1-8 | 3 Convex files | schema.ts, 3 API routes, project-workflow.tsx |
| B: UX | 9-15 | pipeline-stepper.tsx, edit-project-dialog.tsx | layout.tsx, project-detail-content.tsx, projects-content.tsx |
| C: Features | 16-20 | export-menu.tsx, lib/utils/export.ts | project-detail-content.tsx, project-workflow.tsx, add-source-dialog.tsx |
| D: Polish | 21-24 | 3 test files | docs/progress.md, docs/learnings.md |

**Total: 24 tasks across 4 sprints.**
