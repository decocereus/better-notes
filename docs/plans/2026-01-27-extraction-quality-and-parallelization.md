# Extraction Quality & Parallelization Design

**Date:** 2026-01-27
**Status:** Implemented
**Files:** `lib/llm/prompts/extraction.ts`, `lib/extraction/content-extractor.ts`

## Problem

1. **Poor extraction quality**: LLM outputting field names as content, usage guidance in wrong fields
2. **Sequential processing**: 200-500+ essays processed one-by-one, slow for large PDFs
3. **Context degradation**: Quality degrades toward end of large extraction jobs

## Solution

### Phase 1: Fix Extraction Quality

Added few-shot examples to system prompt showing:

**CORRECT output:**
```json
{
  "content": "Climate change framed as contemporary moral imperative",
  "verbatimText": "Climate change is a reality of contemporary times...",
  "detailsMarkdown": "**Why it works:** Direct problem statement...\\n**Use for:** Climate essays..."
}
```

**WRONG output (to avoid):**
```json
{ "content": "detailsMarkdown", ... }
{ "content": "Works for any current global challenge essay", ... }
```

Key clarifications:
- `content` = WHAT the item IS (headline, 5-15 words)
- `verbatimText` = EXACT quote from OCR (copy-paste)
- `detailsMarkdown` = HOW to USE it (why it works, when to use, what it pairs with)

### Phase 2: Parallel Extraction Pipeline

```
Essays (e.g., 500)
      ↓
Split into batches (concurrency = 3)
      ↓
Batch 1: essays 0-2    → Promise.allSettled
Batch 2: essays 3-5    → Promise.allSettled
...
Batch N: essays 498-500 → Promise.allSettled
      ↓
Combine results (preserve order)
```

**Parameters:**
- `concurrency`: 3 (default), max 5 (to avoid rate limits)
- Falls back to sequential for small batches (≤ concurrency)

**Error handling:**
- `Promise.allSettled` allows partial success
- Failed essays get placeholder results with `overallQuality: "low"`
- Errors logged but don't stop other extractions

## Implementation

### Files Modified

1. `lib/llm/prompts/extraction.ts`
   - Added few-shot examples to `EXTRACTION_SYSTEM_PROMPT`
   - Updated extraction checklist with field clarifications

2. `lib/extraction/content-extractor.ts`
   - Added `DEFAULT_CONCURRENCY` (3) and `MAX_CONCURRENCY` (5)
   - Rewrote `extractContentBatch()` for parallel processing
   - Added helper functions:
     - `extractContentSequential()` - fallback for small batches
     - `extractSingleEssay()` - process one essay with metadata
     - `createFailedResult()` - placeholder for failed extractions
     - `splitIntoBatches()` - divide essays by concurrency

### API Compatibility

The `extractContentBatch()` signature is backward compatible:
```typescript
// Old call (still works)
await extractContentBatch(essays, parameters, sourceRef, onProgress);

// New call (with concurrency)
await extractContentBatch(essays, parameters, sourceRef, onProgress, 5);
```

## Testing Checklist

- [ ] Test extraction on small PDF (5-10 essays) - verify field quality
- [ ] Test extraction on medium PDF (50-100 essays) - verify parallelization
- [ ] Test extraction on large PDF (200+ essays) - verify no quality degradation
- [ ] Verify progress callback works correctly with parallel batches
- [ ] Test failure handling - one essay fails, others continue
