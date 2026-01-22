/**
 * OCR Service
 * Performs OCR on PDF pages using LLM vision capabilities.
 * Optimized for handwritten UPSC essay content.
 */

import { generateText } from "ai";
import type { OcrPageResult } from "@/types/processing";
import { getModel } from "./client";

/**
 * Regex for splitting text into words.
 */
const WORD_SPLIT_REGEX = /\s+/;

/**
 * Options for OCR processing.
 */
export interface OcrOptions {
	/** Language hint for OCR (default: English) */
	language?: string;
	/** Whether to preserve formatting (paragraphs, lists) */
	preserveFormatting?: boolean;
	/** Additional context about the content */
	contentHint?: string;
}

/**
 * OCR prompt optimized for handwritten UPSC essay content.
 */
const OCR_SYSTEM_PROMPT = `You are an expert OCR system specialized in reading handwritten text from UPSC essay answer sheets.

Your task is to accurately transcribe the handwritten content while:
1. Preserving the original paragraph structure
2. Maintaining any bullet points or numbered lists
3. Keeping quoted text and citations intact
4. Preserving emphasis (underlined text → **bold**)
5. Handling corrections and strikethroughs appropriately

Guidelines:
- If a word is unclear, make your best interpretation based on context
- Mark completely illegible sections with [illegible]
- Preserve the writer's intent even if grammar/spelling has errors
- Maintain the flow and structure of essay arguments

Output ONLY the transcribed text, nothing else.`;

/**
 * Performs OCR on a single page image.
 */
export async function performOcrOnPage(
	imageUrl: string,
	pageNumber: number,
	options: OcrOptions = {}
): Promise<OcrPageResult> {
	const { preserveFormatting = true, contentHint } = options;

	const model = getModel("OCR");

	let userPrompt =
		"Transcribe all the handwritten text from this page accurately.";
	if (preserveFormatting) {
		userPrompt += " Preserve paragraph breaks and formatting.";
	}
	if (contentHint) {
		userPrompt += ` Context: ${contentHint}`;
	}

	const startTime = Date.now();

	const result = await generateText({
		model,
		system: OCR_SYSTEM_PROMPT,
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: userPrompt },
					{ type: "image", image: imageUrl },
				],
			},
		],
	});

	const text = result.text.trim();
	const wordCount = text.split(WORD_SPLIT_REGEX).filter(Boolean).length;
	const processingTime = Date.now() - startTime;

	// Calculate confidence based on presence of [illegible] markers
	const illegibleCount = (text.match(/\[illegible\]/gi) || []).length;
	const confidence = Math.max(0.5, 1 - illegibleCount * 0.1);

	return {
		pageNumber,
		text,
		confidence,
		wordCount,
		hasHandwriting: true,
		processingTimeMs: processingTime,
	};
}

/**
 * Performs OCR on multiple pages in sequence.
 * Yields results as they complete for progress tracking.
 */
export async function* performOcrOnPages(
	pageUrls: { pageNumber: number; url: string }[],
	options: OcrOptions = {}
): AsyncGenerator<OcrPageResult> {
	for (const { pageNumber, url } of pageUrls) {
		const result = await performOcrOnPage(url, pageNumber, options);
		yield result;
	}
}

/**
 * Performs OCR on a batch of pages concurrently.
 * Limited concurrency to avoid rate limits.
 */
export async function performOcrBatch(
	pageUrls: { pageNumber: number; url: string }[],
	options: OcrOptions = {},
	concurrency = 3
): Promise<OcrPageResult[]> {
	const results: OcrPageResult[] = [];
	const queue = [...pageUrls];

	const workers = Array.from({ length: Math.min(concurrency, queue.length) });

	await Promise.all(
		workers.map(async () => {
			while (queue.length > 0) {
				const item = queue.shift();
				if (!item) {
					break;
				}

				const result = await performOcrOnPage(
					item.url,
					item.pageNumber,
					options
				);
				results.push(result);
			}
		})
	);

	// Sort by page number
	return results.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Combines OCR results into a single document.
 */
export function combineOcrResults(results: OcrPageResult[]): {
	fullText: string;
	totalWords: number;
	averageConfidence: number;
	pageCount: number;
} {
	const sortedResults = [...results].sort(
		(a, b) => a.pageNumber - b.pageNumber
	);

	const fullText = sortedResults.map((r) => r.text).join("\n\n---\n\n");
	const totalWords = sortedResults.reduce((sum, r) => sum + r.wordCount, 0);
	const averageConfidence =
		sortedResults.reduce((sum, r) => sum + r.confidence, 0) /
		sortedResults.length;

	return {
		fullText,
		totalWords,
		averageConfidence,
		pageCount: sortedResults.length,
	};
}
