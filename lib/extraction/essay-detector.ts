/**
 * Essay Boundary Detector
 * Detects where individual essays start and end within OCR'd PDF text.
 * Uses LLM to identify essay boundaries based on content patterns.
 *
 * For large PDFs (1000+ pages), uses chunked processing:
 * - Splits pages into batches of ~50 pages
 * - Processes batches in parallel
 * - Merges results, handling essays that span batch boundaries
 */

import { generateText, Output } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/client";
import type { EssayBoundary } from "@/types/extraction";
import type { OcrPageResult } from "@/types/processing";

/**
 * Regex for splitting text into words.
 */
const WORD_SPLIT_REGEX = /\s+/;

/** Pages per batch for boundary detection (keep small for LLM context) */
const PAGES_PER_BATCH = 50;

/** Maximum concurrent batch processing (reserved for future parallel processing) */
const _MAX_BOUNDARY_CONCURRENCY = 3;

/** Overlap pages between batches to detect cross-boundary essays */
const BATCH_OVERLAP_PAGES = 5;

/**
 * Schema for essay boundary detection response.
 */
const EssayBoundarySchema = z.object({
	essays: z.array(
		z.object({
			startPage: z
				.number()
				.describe("Page number where essay starts (1-indexed)"),
			endPage: z.number().describe("Page number where essay ends (1-indexed)"),
			title: z
				.string()
				.optional()
				.describe("Essay title if visible, or inferred topic"),
			estimatedWordCount: z
				.number()
				.describe("Estimated word count of the essay"),
			confidence: z
				.number()
				.min(0)
				.max(1)
				.describe("Confidence in boundary detection (0-1)"),
		})
	),
	totalEssays: z.number().describe("Total number of essays detected"),
	notes: z
		.string()
		.optional()
		.describe("Any notes about boundary detection challenges"),
});

type EssayBoundaryResponse = z.infer<typeof EssayBoundarySchema>;

/**
 * System prompt for essay boundary detection.
 */
const ESSAY_BOUNDARY_SYSTEM_PROMPT = `You are an expert at analyzing UPSC essay answer sheets.
Your task is to identify where individual essays begin and end in a multi-page document.

UPSC essays typically:
- Are 1000-1200 words (about 3-5 handwritten pages)
- Start with a clear topic or question
- Have distinct introduction, body, and conclusion
- May have a visible question/topic at the start

Indicators of essay boundaries:
1. New essay starts:
   - Question number or topic statement at page start
   - Clear break in writing flow
   - Different handwriting style or ink
   - Page starts with introduction-style content

2. Essay ends:
   - Conclusion-style content (summary, final thoughts)
   - Significant white space before next content
   - Word count around 1000-1200 words

When pages are connected (same essay spans multiple pages):
- Look for continuity in argument flow
- Similar handwriting and formatting
- Incomplete sentences at page boundaries

Output accurate page boundaries for each distinct essay.`;

/**
 * JSON-only instruction for fallback parsing.
 */
const ESSAY_BOUNDARY_JSON_INSTRUCTIONS = `Return ONLY valid JSON that matches this shape:
{
  "essays": [
    {
      "startPage": 1,
      "endPage": 3,
      "title": "optional title",
      "estimatedWordCount": 1200,
      "confidence": 0.0
    }
  ],
  "totalEssays": 1,
  "notes": "optional"
}
No markdown, no extra text, no code fences.`;

function extractJsonObject(text: string): unknown {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error("No JSON object found in model response");
	}
	const jsonText = text.slice(start, end + 1);
	return JSON.parse(jsonText);
}

const PAGE_RANGE_REGEX = /Pages?:\s*(\d+)\s*-\s*(\d+)/gi;
const TITLE_REGEX = /Essay\s+\d+:\s*[""]([^""]+)[""]/i;
const SMART_QUOTES_TITLE_REGEX = /[""]([^""]+)[""]/;
const WORD_COUNT_REGEX = /Word\s*count[^0-9]*([\d,]+)/i;

function parseEssayBoundariesFromText(
	text: string,
	ocrResults: OcrPageResult[]
): EssayBoundaryResponse | null {
	const matches = Array.from(text.matchAll(PAGE_RANGE_REGEX));
	if (matches.length === 0) {
		return null;
	}

	const pageWordCounts = new Map<number, number>();
	for (const result of ocrResults) {
		pageWordCounts.set(result.pageNumber, result.wordCount);
	}

	const essays = matches
		.map((match) => {
			const startPage = Number.parseInt(match[1], 10);
			const endPage = Number.parseInt(match[2], 10);

			if (Number.isNaN(startPage) || Number.isNaN(endPage)) {
				return null;
			}

			const snippetStart = Math.max(0, (match.index ?? 0) - 200);
			const snippetEnd = Math.min(text.length, (match.index ?? 0) + 200);
			const snippet = text.slice(snippetStart, snippetEnd);

			const titleMatch =
				snippet.match(TITLE_REGEX) ?? snippet.match(SMART_QUOTES_TITLE_REGEX);
			const wordCountMatch = snippet.match(WORD_COUNT_REGEX);

			let estimatedWordCount = 0;
			for (let page = startPage; page <= endPage; page++) {
				estimatedWordCount += pageWordCounts.get(page) ?? 0;
			}

			if (wordCountMatch) {
				const parsed = Number.parseInt(wordCountMatch[1].replace(/,/g, ""), 10);
				if (!Number.isNaN(parsed)) {
					estimatedWordCount = parsed;
				}
			}

			return {
				startPage,
				endPage,
				title: titleMatch?.[1]?.trim(),
				estimatedWordCount,
				confidence: 0.5,
			};
		})
		.filter((essay) => essay !== null)
		.filter((essay) => essay.endPage >= essay.startPage);

	if (essays.length === 0) {
		return null;
	}

	return {
		essays,
		totalEssays: essays.length,
		notes: "Parsed from non-JSON model response",
	};
}

/**
 * Creates the user prompt with OCR text for boundary detection.
 */
function createBoundaryDetectionPrompt(ocrResults: OcrPageResult[]): string {
	const sortedResults = [...ocrResults].sort(
		(a, b) => a.pageNumber - b.pageNumber
	);

	const pageTexts = sortedResults.map((result) => {
		const wordCount = result.text
			.split(WORD_SPLIT_REGEX)
			.filter(Boolean).length;
		return `=== PAGE ${result.pageNumber} (${wordCount} words) ===
${result.text}`;
	});

	return `Analyze the following OCR'd pages from a UPSC essay answer sheet and identify essay boundaries.

Total pages: ${sortedResults.length}
Total words: ${sortedResults.reduce((sum, r) => sum + r.wordCount, 0)}

${pageTexts.join("\n\n")}

Identify where each individual essay starts and ends. Consider word count, content flow, and typical essay structure.`;
}

/**
 * Detects essay boundaries in OCR'd text.
 * For large PDFs, uses chunked parallel processing.
 *
 * @param ocrResults - Array of OCR results for each page
 * @param onProgress - Optional callback for progress updates
 * @returns Array of essay boundaries with start/end pages
 */
export async function detectEssayBoundaries(
	ocrResults: OcrPageResult[],
	onProgress?: (processed: number, total: number) => void
): Promise<EssayBoundary[]> {
	if (ocrResults.length === 0) {
		return [];
	}

	// Sort by page number
	const sorted = [...ocrResults].sort((a, b) => a.pageNumber - b.pageNumber);

	// For very short documents (1-2 pages), assume single essay
	if (sorted.length <= 2) {
		const totalWords = sorted.reduce((sum, r) => sum + r.wordCount, 0);
		return [
			{
				startPage: Math.min(...sorted.map((r) => r.pageNumber)),
				endPage: Math.max(...sorted.map((r) => r.pageNumber)),
				wordCount: totalWords,
			},
		];
	}

	// For small documents, use single-batch processing
	if (sorted.length <= PAGES_PER_BATCH) {
		return await detectBoundariesInBatch(sorted);
	}

	// For large documents, use chunked parallel processing
	console.log(
		`[EssayDetector] Large PDF detected (${sorted.length} pages), using chunked processing`
	);
	return await detectBoundariesChunked(sorted, onProgress);
}

/**
 * Detects boundaries in a single batch of pages.
 */
async function detectBoundariesInBatch(
	ocrResults: OcrPageResult[]
): Promise<EssayBoundary[]> {
	const model = getModel("EXTRACTION");
	const prompt = createBoundaryDetectionPrompt(ocrResults);

	try {
		const { output: result } = await generateText({
			model,
			output: Output.object({
				schema: EssayBoundarySchema,
			}),
			system: ESSAY_BOUNDARY_SYSTEM_PROMPT,
			prompt,
		});

		if (!result) {
			throw new Error("Structured output returned null");
		}

		return convertToBoundaries(result, ocrResults);
	} catch (error) {
		console.warn(
			"[EssayDetector] Structured output failed, attempting JSON fallback",
			error
		);

		const fallback = await generateText({
			model,
			system: `${ESSAY_BOUNDARY_SYSTEM_PROMPT}\n\n${ESSAY_BOUNDARY_JSON_INSTRUCTIONS}`,
			prompt,
		});

		try {
			const parsedJson = extractJsonObject(fallback.text);
			const parsed = EssayBoundarySchema.safeParse(parsedJson);
			if (!parsed.success) {
				throw new Error(parsed.error.message);
			}
			return convertToBoundaries(parsed.data, ocrResults);
		} catch (parseError) {
			const parsedFreeform = parseEssayBoundariesFromText(
				fallback.text,
				ocrResults
			);
			if (!parsedFreeform) {
				throw new Error(
					`Failed to parse essay boundaries JSON: ${
						parseError instanceof Error ? parseError.message : "Unknown error"
					}`
				);
			}

			return convertToBoundaries(parsedFreeform, ocrResults);
		}
	}
}

/** Maximum retries for failed boundary detection batches */
const MAX_BATCH_RETRIES = 2;

interface PageBatch {
	pages: OcrPageResult[];
	startIndex: number;
	endIndex: number;
}

async function delayBatchRetry(attempt: number): Promise<void> {
	if (attempt <= 0) {
		return;
	}

	await new Promise((resolve) =>
		setTimeout(resolve, 1000 * 2 ** (attempt - 1))
	);
}

async function detectBatchWithRetries({
	batch,
	batchIndex,
	totalBatches,
}: {
	batch: PageBatch;
	batchIndex: number;
	totalBatches: number;
}): Promise<{ boundaries: EssayBoundary[]; failed: boolean }> {
	for (let attempt = 0; attempt <= MAX_BATCH_RETRIES; attempt++) {
		if (attempt > 0) {
			console.log(
				`[EssayDetector] Retrying batch ${batchIndex + 1}/${totalBatches}, attempt ${attempt + 1}/${MAX_BATCH_RETRIES + 1}`
			);
			await delayBatchRetry(attempt);
		}

		try {
			const boundaries = await detectBoundariesInBatch(batch.pages);
			return { boundaries, failed: false };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(
				`[EssayDetector] Batch ${batchIndex + 1} failed (attempt ${attempt + 1}/${MAX_BATCH_RETRIES + 1}):`,
				errorMessage
			);

			if (attempt === MAX_BATCH_RETRIES) {
				console.error(
					`[EssayDetector] Batch ${batchIndex + 1} failed permanently after ${MAX_BATCH_RETRIES + 1} attempts. Pages ${batch.startIndex + 1}-${batch.endIndex + 1} may have undetected essays.`
				);
				return { boundaries: [], failed: true };
			}
		}
	}

	return { boundaries: [], failed: true };
}

async function delayBetweenBatches(
	batchIndex: number,
	totalBatches: number
): Promise<void> {
	if (batchIndex >= totalBatches - 1) {
		return;
	}

	await new Promise((resolve) => setTimeout(resolve, 100));
}

/**
 * Processes large PDFs by splitting into batches and processing in parallel.
 * Includes retry logic for failed batches to ensure no pages are missed.
 */
async function detectBoundariesChunked(
	ocrResults: OcrPageResult[],
	onProgress?: (processed: number, total: number) => void
): Promise<EssayBoundary[]> {
	// Create batches with overlap to detect cross-boundary essays
	const batches = createPageBatches(
		ocrResults,
		PAGES_PER_BATCH,
		BATCH_OVERLAP_PAGES
	);
	const totalBatches = batches.length;

	console.log(
		`[EssayDetector] Split into ${totalBatches} batches of ~${PAGES_PER_BATCH} pages each`
	);

	// Process batches with controlled concurrency and retry logic
	const allBoundaries: EssayBoundary[][] = new Array(totalBatches);
	let failedBatches = 0;

	for (const [batchIndex, batch] of batches.entries()) {
		const { boundaries, failed } = await detectBatchWithRetries({
			batch,
			batchIndex,
			totalBatches,
		});

		allBoundaries[batchIndex] = boundaries;
		if (failed) {
			failedBatches++;
		}

		onProgress?.(batchIndex + 1, totalBatches);
		await delayBetweenBatches(batchIndex, totalBatches);
	}

	// Log summary
	if (failedBatches > 0) {
		console.warn(
			`[EssayDetector] WARNING: ${failedBatches}/${totalBatches} batches failed permanently. Some essays may have been missed.`
		);
	}

	// Merge boundaries from all batches
	const merged = mergeBatchBoundaries(allBoundaries, ocrResults);

	console.log(
		`[EssayDetector] Detected ${merged.length} essays across ${totalBatches} batches (${failedBatches} failed)`
	);

	return merged;
}

/**
 * Creates page batches with overlap for boundary detection.
 */
function createPageBatches(
	ocrResults: OcrPageResult[],
	batchSize: number,
	overlapPages: number
): PageBatch[] {
	const batches: PageBatch[] = [];

	const step = batchSize - overlapPages;

	for (let i = 0; i < ocrResults.length; i += step) {
		const endIndex = Math.min(i + batchSize, ocrResults.length);
		const pages = ocrResults.slice(i, endIndex);

		batches.push({
			pages,
			startIndex: i,
			endIndex: endIndex - 1,
		});

		// Stop if we've reached the end
		if (endIndex >= ocrResults.length) {
			break;
		}
	}

	return batches;
}

/**
 * Merges boundaries from multiple batches, handling essays that span batches.
 */
function mergeBatchBoundaries(
	batchBoundaries: EssayBoundary[][],
	allOcrResults: OcrPageResult[]
): EssayBoundary[] {
	const pageWordCounts = buildPageWordCountMap(allOcrResults);
	const flattened = flattenBoundaries(batchBoundaries);
	const merged = mergeOverlappingBoundaries(flattened, pageWordCounts);
	return deduplicateBoundaries(merged, pageWordCounts);
}

/**
 * Builds a map of page numbers to word counts.
 */
function buildPageWordCountMap(
	ocrResults: OcrPageResult[]
): Map<number, number> {
	const pageWordCounts = new Map<number, number>();
	for (const result of ocrResults) {
		pageWordCounts.set(result.pageNumber, result.wordCount);
	}
	return pageWordCounts;
}

/**
 * Flattens all boundaries from batches into a sorted array.
 */
function flattenBoundaries(
	batchBoundaries: EssayBoundary[][]
): EssayBoundary[] {
	const allBoundaries: EssayBoundary[] = [];

	for (const boundaries of batchBoundaries) {
		if (!boundaries) {
			continue;
		}
		for (const boundary of boundaries) {
			allBoundaries.push(boundary);
		}
	}

	// Sort by start page
	allBoundaries.sort((a, b) => a.startPage - b.startPage);
	return allBoundaries;
}

/**
 * Calculates word count for a page range.
 */
function calculateWordCount(
	startPage: number,
	endPage: number,
	pageWordCounts: Map<number, number>
): number {
	let wordCount = 0;
	for (let page = startPage; page <= endPage; page++) {
		wordCount += pageWordCounts.get(page) ?? 0;
	}
	return wordCount;
}

/**
 * Checks if two boundaries have matching titles.
 */
function hasSameTitle(a: EssayBoundary, b: EssayBoundary): boolean {
	if (!(a.title && b.title)) {
		return false;
	}
	return (
		a.title === b.title ||
		a.title.includes(b.title) ||
		b.title.includes(a.title)
	);
}

/**
 * Merges overlapping or adjacent boundaries from batch overlaps.
 */
function mergeOverlappingBoundaries(
	boundaries: EssayBoundary[],
	pageWordCounts: Map<number, number>
): EssayBoundary[] {
	const merged: EssayBoundary[] = [];

	for (const boundary of boundaries) {
		const last = merged.at(-1);

		if (!last || boundary.startPage > last.endPage + 1) {
			// No overlap, add as new boundary
			merged.push({ ...boundary });
			continue;
		}

		// Check if should merge
		const overlapAmount = last.endPage - boundary.startPage + 1;
		const shouldMerge =
			overlapAmount >= BATCH_OVERLAP_PAGES - 1 || hasSameTitle(last, boundary);

		if (shouldMerge) {
			// Extend the last boundary
			last.endPage = Math.max(last.endPage, boundary.endPage);
			// Keep the more descriptive title
			if (
				boundary.title &&
				(!last.title || boundary.title.length > last.title.length)
			) {
				last.title = boundary.title;
			}
			// Recalculate word count
			last.wordCount = calculateWordCount(
				last.startPage,
				last.endPage,
				pageWordCounts
			);
		} else {
			// Different essay, add as new
			merged.push({ ...boundary });
		}
	}

	return merged;
}

/**
 * Removes duplicates and fixes any remaining overlaps.
 */
function deduplicateBoundaries(
	boundaries: EssayBoundary[],
	pageWordCounts: Map<number, number>
): EssayBoundary[] {
	const deduped: EssayBoundary[] = [];

	for (const boundary of boundaries) {
		const last = deduped.at(-1);

		if (!last || boundary.startPage > last.endPage) {
			deduped.push(boundary);
			continue;
		}

		// Overlapping - prefer the one with more content
		const boundarySize = boundary.endPage - boundary.startPage;
		const lastSize = last.endPage - last.startPage;

		if (boundarySize > lastSize) {
			// Adjust start to avoid overlap
			const adjusted = { ...boundary };
			adjusted.startPage = last.endPage + 1;
			if (adjusted.startPage <= adjusted.endPage) {
				adjusted.wordCount = calculateWordCount(
					adjusted.startPage,
					adjusted.endPage,
					pageWordCounts
				);
				deduped.push(adjusted);
			}
		}
		// Otherwise skip this boundary (it's a duplicate or smaller)
	}

	return deduped;
}

/**
 * Converts LLM response to EssayBoundary array.
 */
function convertToBoundaries(
	response: EssayBoundaryResponse,
	ocrResults: OcrPageResult[]
): EssayBoundary[] {
	const pageWordCounts = new Map<number, number>();
	for (const result of ocrResults) {
		pageWordCounts.set(result.pageNumber, result.wordCount);
	}

	return response.essays.map((essay) => {
		// Calculate actual word count from page data
		let wordCount = 0;
		for (let page = essay.startPage; page <= essay.endPage; page++) {
			wordCount += pageWordCounts.get(page) ?? 0;
		}

		return {
			startPage: essay.startPage,
			endPage: essay.endPage,
			title: essay.title,
			wordCount: wordCount || essay.estimatedWordCount,
		};
	});
}

/**
 * Gets the combined text for a specific essay boundary.
 */
export function getEssayText(
	ocrResults: OcrPageResult[],
	boundary: EssayBoundary
): string {
	const relevantPages = ocrResults
		.filter(
			(r) =>
				r.pageNumber >= boundary.startPage && r.pageNumber <= boundary.endPage
		)
		.sort((a, b) => a.pageNumber - b.pageNumber);

	return relevantPages.map((p) => p.text).join("\n\n");
}

/**
 * Validates that detected boundaries don't overlap and cover all pages.
 */
export function validateBoundaries(
	boundaries: EssayBoundary[],
	totalPages: number
): { valid: boolean; issues: string[] } {
	const issues: string[] = [];

	// Sort by start page
	const sorted = [...boundaries].sort((a, b) => a.startPage - b.startPage);

	// Check for overlaps
	for (let i = 0; i < sorted.length - 1; i++) {
		if (sorted[i].endPage >= sorted[i + 1].startPage) {
			issues.push(
				`Overlap detected between essay ending at page ${sorted[i].endPage} and essay starting at page ${sorted[i + 1].startPage}`
			);
		}
	}

	// Check for gaps (acceptable, just note them)
	for (let i = 0; i < sorted.length - 1; i++) {
		if (sorted[i].endPage + 1 < sorted[i + 1].startPage) {
			issues.push(
				`Gap detected: pages ${sorted[i].endPage + 1} to ${sorted[i + 1].startPage - 1} not covered`
			);
		}
	}

	// Check bounds
	if (sorted.length > 0) {
		if (sorted[0].startPage < 1) {
			issues.push(`Invalid start page: ${sorted[0].startPage}`);
		}
		const lastEssay = sorted.at(-1);
		if (lastEssay && lastEssay.endPage > totalPages) {
			issues.push(
				`End page ${lastEssay.endPage} exceeds total pages ${totalPages}`
			);
		}
	}

	return {
		valid:
			issues.filter((i) => i.includes("Overlap") || i.includes("Invalid"))
				.length === 0,
		issues,
	};
}
