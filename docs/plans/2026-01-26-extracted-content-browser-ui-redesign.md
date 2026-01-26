# Extracted Content Browser UI Redesign

**Date:** 2026-01-26
**Status:** Approved
**File:** `components/extracted-content-browser.tsx`

## Problem

The current extracted content browser has several UX issues:
1. Markdown fields (`detailsMarkdown`) display as raw text instead of rendered
2. Layout is cramped with insufficient spacing between items
3. Metadata badges ("Med", "Multi-use") repeat without context, creating noise
4. No visual hierarchy - all content types have the same density
5. Sections are not collapsible, making it hard to navigate large result sets

## Solution

Redesign with a scholarly/editorial aesthetic featuring:
- Three-level collapsible hierarchy
- Proper markdown rendering via ai-elements
- Generous whitespace and clear typography
- Subtle metadata indicators

## Design

### Component Structure

```
ExtractedContentBrowser
├── Stats Bar (unchanged)
├── Filters (unchanged)
├── Results count
└── Essay Groups (collapsible)
    └── EssayGroup
        ├── Essay Header (title, page range, item count, chevron)
        └── Content Type Sections (collapsible)
            └── ContentTypeSection
                ├── Section Header (icon, label, count, chevron)
                └── Content Items
                    └── ContentItem (collapsible)
                        ├── Collapsed: summary + metadata dots
                        └── Expanded: verbatim, details (markdown), attribution, context
```

### Visual Styling

**Typography hierarchy:**
- Essay title: `text-lg font-medium`
- Section header: `text-sm font-medium uppercase tracking-wide text-muted-foreground`
- Item summary: `text-sm`
- Verbatim text: `text-sm italic` in blockquote container
- Details markdown: `text-sm text-muted-foreground` via ai-elements

**Spacing:**
- Essay groups: `space-y-6` (24px gap)
- Content sections: `space-y-4` (16px gap)
- Items within section: `divide-y` with `py-4` padding
- Expanded content: `mt-4 space-y-3`

**Containers:**
- Verbatim text: `border-l-2 border-primary/30 pl-4 bg-muted/10 rounded-r-lg py-3`
- Details markdown: `bg-muted/5 rounded-lg p-4`
- Attribution: inline with em-dash separator

**Metadata indicators:**
- Quality dot: `size-2 rounded-full` (emerald/amber/slate for high/medium/low)
- Multi-use: `Sparkles` icon, `size-3 text-blue-400`
- Overused: `AlertTriangle` icon, `size-3 text-amber-500`
- Page ref: `font-mono text-[10px] text-muted-foreground/60`

### Markdown Rendering

Use ai-elements `MessageResponse` for `detailsMarkdown`:

```tsx
import { MessageResponse } from "@/components/ai-elements/message-response";

{item.detailsMarkdown && (
  <div className="rounded-lg bg-muted/5 p-4">
    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Details
    </p>
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
      <MessageResponse content={item.detailsMarkdown} />
    </div>
  </div>
)}
```

Verbatim text (styled quote, not markdown):

```tsx
{item.verbatimText && (
  <blockquote className="border-l-2 border-primary/30 bg-muted/10 rounded-r-lg py-3 pl-4 pr-3">
    <p className="text-sm italic leading-relaxed">{item.verbatimText}</p>
  </blockquote>
)}
```

### Collapsible Behavior

Use shadcn `Collapsible` components:

```tsx
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger asChild>
    <Button
      variant="ghost"
      className="w-full justify-between px-4 py-3 h-auto"
    >
      <div className="flex items-center gap-3">
        {/* Title, metadata */}
      </div>
      <ChevronDown className={cn(
        "size-4 transition-transform duration-200",
        !isOpen && "-rotate-90"
      )} />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    {/* Content */}
  </CollapsibleContent>
</Collapsible>
```

**Default states:**
- Essay groups: expanded
- Content type sections: expanded
- Individual items: collapsed

## Implementation

### Files to Modify
- `components/extracted-content-browser.tsx` - main rewrite

### Dependencies
None new - uses existing:
- `@/components/ai-elements/message-response`
- `@/components/ui/collapsible`
- `@/components/ui/button`

### Checklist
- [ ] Add Collapsible to ContentTypeSection
- [ ] Rewrite ContentItem with collapsed/expanded states
- [ ] Integrate MessageResponse for detailsMarkdown
- [ ] Update spacing classes throughout
- [ ] Replace text badges with dot/icon indicators
- [ ] Test with real extraction data
- [ ] Run `bun run check` to verify no errors
