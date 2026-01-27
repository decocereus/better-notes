# Chunked Essay Processing Implementation

**Date:** 2026-01-27  
**Status:** Implemented  
**Files:** `lib/extraction/chunked-processor.ts`, `lib/extraction/essay-detector.ts`, `app/api/extract/route.ts`

## Problem Statement

When processing large PDFs (1400+ pages), users experienced gaps in essay extraction - not all essays were being extracted despite the existing parallel processing infrastructure. The existing implementation had these issues:

1. **No retry logic for failed boundary detection batches** - If a 50-page batch failed during boundary detection, those pages were completely skipped
2. **No chunk-level error handling for extraction** - If an essay extraction failed, it was logged but not retried
3. **Limited visibility into processing gaps** - No reporting on which pages weren't covered by detected essays
4. **No validation for large PDFs** - No warnings when essay count seemed too low for the page count

## Solution: Chunked Essay Processor

A new `processEssaysInChunks` function that provides:

1. **Chunked processing**: Groups essays into chunks (default: 15 essays per chunk) instead of individual parallel processing
2. **Retry logic**: Each chunk is retried up to 2 times with exponential backoff
3. **Comprehensive logging**: Detailed logs at each stage for debugging
4. **Gap detection**: Identifies pages not covered by any detected essay
5. **Statistics tracking**: Detailed stats on success/failure rates, retries, and coverage

## Architecture

```
1400 pages
    ↓
Detect boundaries (chunked: 50 pages/batch, with retry)
    ↓
Split essays into chunks (15 essays/chunk)
    ↓
Process chunk 1 (essays 1-15) → retry if failed
Process chunk 2 (essays 16-30) → retry if failed
...
Process chunk N → retry if failed
    ↓
Validate page coverage
Report gaps
Return results + statistics
```

## Key Changes

### 1. New File: `lib/extraction/chunked-processor.ts`

Exports:
- `processEssaysInChunks()` - Main processing function
- `validateLargePdfBoundaries()` - Validation helper
- `DEFAULT_CONFIG` - Default configuration
- `ChunkedProcessingConfig` - Configuration type
- `ProcessingStats` - Statistics type

### 2. Enhanced: `lib/extraction/essay-detector.ts`

- Added `MAX_BATCH_RETRIES = 2` constant
- Modified `detectBoundariesChunked()` to retry failed batches with exponential backoff
- Added per-batch retry logic instead of failing silently
- Added logging for batch failures

### 3. Updated: `app/api/extract/route.ts`

- Added chunked processing for PDFs > 500 pages
- Standard processing for PDFs ≤ 500 pages
- Enhanced error tracking with job errors for:
  - Failed chunks
  - Page gaps
  - Validation warnings
- Stores processing statistics in results for debugging

## Configuration

```typescript
interface ChunkedProcessingConfig {
  essaysPerChunk: number;      // Default: 15
  maxRetries: number;          // Default: 2
  continueOnFailure: boolean;  // Default: true
  enableLogging: boolean;      // Default: true
}
```

## Usage

### Automatic (via API)

For PDFs > 500 pages, chunked processing is used automatically:

```typescript
// POST /api/extract
// With assetId or ocrJobId for a large PDF
// Automatically uses chunked processing with:
// - 15 essays per chunk
// - 2 retries per chunk
// - Detailed logging
```

### Manual (for testing/debugging)

```typescript
import { processEssaysInChunks } from "@/lib/extraction";

const { results, stats } = await processEssaysInChunks(
  ocrResults,
  parameters,
  sourceRef,
  {
    essaysPerChunk: 15,
    maxRetries: 2,
    continueOnFailure: true,
    enableLogging: true,
  },
  (chunkIndex, totalChunks, currentEssay, totalEssays) => {
    console.log(`Progress: ${currentEssay}/${totalEssays}`);
  }
);

console.log("Processing stats:", stats);
```

## Processing Statistics

The `ProcessingStats` object returned includes:

```typescript
{
  totalEssays: number;        // Total essays detected
  successful: number;         // Essays with extracted items
  failed: number;             // Essays that failed extraction
  retried: number;            // Number of retry attempts
  chunksProcessed: number;    // Successfully processed chunks
  chunksFailed: number;       // Chunks that failed after all retries
  totalPages: number;         // Total pages in PDF
  pagesCovered: number;       // Pages covered by detected essays
  gaps: Array<{start, end}>;  // Page ranges not covered
  errors: Array<{             // Detailed error information
    chunkIndex: number;
    essayIndices: number[];
    error: string;
  }>;
}
```

## Example Output for 1400-Page PDF

```
[ChunkedProcessor] Starting chunked processing {
  totalPages: 1400,
  essaysPerChunk: 15,
  maxRetries: 2
}
[ChunkedProcessor] Step 1: Detecting essay boundaries...
[EssayDetector] Split into 28 batches of ~50 pages each
[EssayDetector] Detected 350 essays across 28 batches (0 failed)
[ChunkedProcessor] Split into 24 chunks of max 15 essays each
[ChunkedProcessor] Processing chunk 1/24 (essays 1-15)
[ChunkedProcessor] Chunk 1 completed successfully (15 essays)
...
[ChunkedProcessor] Processing complete: {
  totalEssays: 350,
  successful: 348,
  failed: 2,
  retried: 1,
  chunksProcessed: 24,
  chunksFailed: 0,
  pageCoverage: "99.8%",
  gapsFound: 1
}
WARNING: Page gaps detected: [ { start: 523, end: 523 } ]
```

## Comparison: Old vs New

| Aspect | Old Implementation | New Implementation |
|--------|-------------------|-------------------|
| Boundary detection | 50-page batches, no retry | 50-page batches, 2 retries |
| Extraction | 3 essays parallel, no retry | 15-essay chunks, 2 retries/chunk |
| Error handling | Log and continue | Retry, then log detailed errors |
| Gap detection | None | Page-level gap detection |
| Statistics | Basic counts | Detailed per-chunk stats |
| Large PDF validation | None | Warnings for suspicious patterns |

## Testing Checklist

- [ ] Test with small PDF (5-10 essays) - should use standard processing
- [ ] Test with medium PDF (100 pages) - standard processing with validation
- [ ] Test with large PDF (600+ pages) - should use chunked processing
- [ ] Test with 1400-page PDF - verify all essays extracted
- [ ] Verify retry logic works (simulate failures)
- [ ] Check gap detection accuracy
- [ ] Verify processing statistics are accurate
- [ ] Test API response includes processing stats for large PDFs

## Future Improvements

1. **Adaptive chunk sizing**: Adjust `essaysPerChunk` based on average essay length
2. **Smart retry**: Only retry failed essays within a chunk, not the whole chunk
3. **Gap filling**: Add a second pass to detect essays in gap regions
4. **Progress persistence**: Save intermediate results to resume after crashes
5. **UI integration**: Show chunk-level progress in the extraction UI
