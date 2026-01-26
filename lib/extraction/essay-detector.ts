/**
 * Essay Boundary Detector
 * Detects where individual essays start and end within OCR'd PDF text.
 * Uses LLM to identify essay boundaries based on content patterns.
 */

import { generateObject, generateText } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai/client";
import type { EssayBoundary } from "@/types/extraction";
import type { OcrPageResult } from "@/types/processing";

/**
 * Regex for splitting text into words.
 */
const WORD_SPLIT_REGEX = /\s+/;

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
 *
 * @param ocrResults - Array of OCR results for each page
 * @returns Array of essay boundaries with start/end pages
 */
export async function detectEssayBoundaries(
	ocrResults: OcrPageResult[]
): Promise<EssayBoundary[]> {
	if (ocrResults.length === 0) {
		return [];
	}

	// For very short documents (1-2 pages), assume single essay
	if (ocrResults.length <= 2) {
		const totalWords = ocrResults.reduce((sum, r) => sum + r.wordCount, 0);
		return [
			{
				startPage: Math.min(...ocrResults.map((r) => r.pageNumber)),
				endPage: Math.max(...ocrResults.map((r) => r.pageNumber)),
				wordCount: totalWords,
			},
		];
	}

	const model = getModel("EXTRACTION");
	const prompt = createBoundaryDetectionPrompt(ocrResults);

	try {
		const result = await generateObject({
			model,
			schema: EssayBoundarySchema,
			system: ESSAY_BOUNDARY_SYSTEM_PROMPT,
			prompt,
		});

		return convertToBoundaries(result.object, ocrResults);
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
