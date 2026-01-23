/**
 * OCR Service
 * Performs OCR on PDF pages using LLM vision capabilities.
 * Optimized for handwritten UPSC essay content.
 *
 * Supports two modes:
 * 1. Direct PDF OCR - Pass entire PDF to Gemini via @ai-sdk/google (for large files)
 * 2. Page-by-page OCR - Render pages as images (fallback for problematic PDFs)
 *
 * Uses Google AI directly for large PDF OCR to bypass OpenRouter's 5MB limit.
 * Gemini supports files up to 2GB via URL.
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

/**
 * OCR prompt for direct PDF processing.
 */
const PDF_OCR_SYSTEM_PROMPT = `You are an expert OCR system specialized in reading handwritten text from UPSC essay answer sheets.

Your task is to accurately transcribe ALL handwritten content from this PDF while:
1. Processing each page in order
2. Preserving the original paragraph structure
3. Maintaining any bullet points or numbered lists
4. Keeping quoted text and citations intact
5. Preserving emphasis (underlined text → **bold**)
6. Handling corrections and strikethroughs appropriately

Guidelines:
- Process every page of the PDF
- If a word is unclear, make your best interpretation based on context
- Mark completely illegible sections with [illegible]
- Preserve the writer's intent even if grammar/spelling has errors
- Maintain the flow and structure of essay arguments
- Separate different essays or sections clearly with "---"

Output ONLY the transcribed text, nothing else.`;

/**
 * Result from direct PDF OCR.
 */
export interface DirectPdfOcrResult {
	/** Full transcribed text */
	text: string;
	/** Word count */
	wordCount: number;
	/** Confidence estimate (0-1) */
	confidence: number;
	/** Processing time in milliseconds */
	processingTimeMs: number;
}

/**
 * Performs OCR on an entire PDF file directly using Google AI.
 *
 * For large files (>20MB), uploads to Google's File API first, then processes
 * using @google/genai directly with createPartFromUri.
 *
 * Requires GOOGLE_GENERATIVE_AI_API_KEY environment variable.
 *
 * @param pdfUrl - URL to the PDF file (can be a signed R2 URL)
 * @param options - OCR options
 * @returns OCR result with full text
 */
export async function performDirectPdfOcr(
	pdfUrl: string,
	options: OcrOptions = {}
): Promise<DirectPdfOcrResult> {
	const { contentHint } = options;

	// Dynamic imports to avoid loading at module level
	const { GoogleGenAI, createPartFromUri } =
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		require("@google/genai") as typeof import("@google/genai");

	const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) {
		throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
	}

	const genai = new GoogleGenAI({ apiKey });

	let userPrompt =
		"Transcribe all the handwritten text from this PDF accurately. Process every page.";
	if (contentHint) {
		userPrompt += ` Context: ${contentHint}`;
	}

	const startTime = Date.now();

	// Download PDF from R2
	console.log("[OCR] Downloading PDF from R2...");
	const pdfResponse = await fetch(pdfUrl);
	if (!pdfResponse.ok) {
		throw new Error(`Failed to download PDF: ${pdfResponse.status}`);
	}
	const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
	const fileSizeMB = pdfBuffer.length / 1024 / 1024;
	console.log(`[OCR] Downloaded ${fileSizeMB.toFixed(1)}MB`);

	// Upload to Google's File API (required for files >20MB)
	console.log("[OCR] Uploading to Google File API...");
	const uploadedFile = await genai.files.upload({
		file: new Blob([pdfBuffer], { type: "application/pdf" }),
		config: {
			mimeType: "application/pdf",
		},
	});
	console.log(`[OCR] Uploaded as ${uploadedFile.name}`);

	// Wait for file to be processed by Google
	let file = uploadedFile;
	while (file.state === "PROCESSING") {
		console.log("[OCR] Waiting for file processing...");
		await new Promise((resolve) => setTimeout(resolve, 2000));
		const fileStatus = await genai.files.get({ name: file.name as string });
		file = fileStatus;
	}

	if (file.state === "FAILED") {
		throw new Error("Google File API processing failed");
	}

	console.log(`[OCR] File ready: ${file.uri}`);

	// Use @google/genai directly with createPartFromUri for File API URIs
	// @ai-sdk/google doesn't support File API URIs - only Buffer data
	console.log("[OCR] Sending to Gemini via @google/genai...");
	console.log("[OCR] Request details:", {
		model: "gemini-2.5-flash",
		fileUri: file.uri,
		promptLength: userPrompt.length,
		systemPromptLength: PDF_OCR_SYSTEM_PROMPT.length,
	});

	let responseText: string;
	try {
		const response = await genai.models.generateContent({
			model: "gemini-2.5-flash",
			config: {
				systemInstruction: PDF_OCR_SYSTEM_PROMPT,
			},
			contents: [
				{
					role: "user",
					parts: [
						createPartFromUri(file.uri as string, "application/pdf"),
						{ text: userPrompt },
					],
				},
			],
		});
		responseText = response.text ?? "";
	} catch (error: unknown) {
		console.error("[OCR] Full error object:", JSON.stringify(error, null, 2));
		console.error("[OCR] Error details:", {
			name: (error as Error).name,
			message: (error as Error).message,
			cause: (error as { cause?: unknown }).cause,
		});
		throw error;
	}

	// Clean up uploaded file from Google
	try {
		await genai.files.delete({ name: file.name as string });
		console.log("[OCR] Cleaned up uploaded file");
	} catch {
		console.log("[OCR] Failed to clean up file (non-critical)");
	}

	const text = responseText.trim();
	const wordCount = text.split(WORD_SPLIT_REGEX).filter(Boolean).length;
	const processingTime = Date.now() - startTime;

	// Calculate confidence based on presence of [illegible] markers
	const illegibleCount = (text.match(/\[illegible\]/gi) || []).length;
	const confidence = Math.max(0.5, 1 - illegibleCount * 0.05);

	console.log(`[OCR] Completed - ${wordCount} words in ${processingTime}ms`);

	return {
		text,
		wordCount,
		confidence,
		processingTimeMs: processingTime,
	};
}
