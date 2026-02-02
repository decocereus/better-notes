/**
 * OCR Service - Page-Image Based Processing
 *
 * Performs OCR on individual page images using multi-model fallback:
 * 1. Primary: Kimi K2.5 via OpenRouter
 * 2. Fallback: Kimi K2.5 via OpenRouter for retries
 *
 * This approach handles large PDFs by processing each page independently
 * after converting PDF to images.
 */

import { generateText } from "ai";
import {
	getAllOcrResults,
	getOcrStatus,
	storeOcrStatus,
	storePageOcrResult,
} from "@/lib/storage/ocr-results";
import { getAllPageImageUrls } from "@/lib/storage/page-images";
import type { OcrStatus, PageOcrResult, RetryThresholds } from "@/types/ocr";
import { DEFAULT_RETRY_THRESHOLDS } from "@/types/ocr";
import {
	getOcrModel,
	type OcrModelType,
	validateOcrModelConfig,
} from "./models";
import { findPagesNeedingRetry, shouldRetryPage } from "./retry-logic";

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
	/** Retry thresholds for quality control */
	retryThresholds?: RetryThresholds;
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
export async function performOcrOnPageImage(
	imageUrl: string,
	pageNumber: number,
	options: OcrOptions = {},
	modelType: OcrModelType = "gemini-flash"
): Promise<PageOcrResult> {
	const { preserveFormatting = true, contentHint } = options;

	const model = getOcrModel(modelType);

	let userPrompt =
		"Transcribe all the handwritten text from this page accurately.";
	if (preserveFormatting) {
		userPrompt += " Preserve paragraph breaks and formatting.";
	}
	if (contentHint) {
		userPrompt += ` Context: ${contentHint}`;
	}

	const startTime = Date.now();

	try {
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
			wordCount,
			confidence,
			illegibleCount,
			model: modelType,
			processingTimeMs: processingTime,
			retried: false,
		};
	} catch (error) {
		const processingTime = Date.now() - startTime;
		return {
			pageNumber,
			text: "",
			wordCount: 0,
			confidence: 0,
			illegibleCount: 0,
			model: modelType,
			processingTimeMs: processingTime,
			retried: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Processes OCR for all pages of an asset.
 * Uses parallel batching for efficiency.
 */
export async function processOcrJob(
	assetId: string,
	options: OcrOptions = {},
	concurrency = 10,
	onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; pagesProcessed: number; errors: string[] }> {
	const config = validateOcrModelConfig();
	if (!(config.geminiAvailable || config.claudeAvailable)) {
		throw new Error(config.error || "No OCR model available");
	}

	// Get all page image URLs
	const pageUrls = await getAllPageImageUrls(assetId);
	if (pageUrls.length === 0) {
		throw new Error("No page images found for asset");
	}

	const totalPages = pageUrls.length;
	const errors: string[] = [];
	let processedCount = 0;

	// Initialize OCR status
	const ocrStatus: OcrStatus = {
		status: "processing",
		pagesProcessed: 0,
		totalPages,
		retriedCount: 0,
		startedAt: new Date().toISOString(),
	};
	await storeOcrStatus(assetId, ocrStatus);

	// Process in batches
	const queue = [...pageUrls];

	const processBatch = async () => {
		const workers = Array.from({
			length: Math.min(concurrency, queue.length),
		});

		await Promise.all(
			// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Worker pool requires nested async logic
			workers.map(async () => {
				while (queue.length > 0) {
					const page = queue.shift();
					if (!page) {
						break;
					}

					try {
						const result = await performOcrOnPageImage(
							page.url,
							page.pageNumber,
							options,
							"gemini-flash"
						);

						// Store result immediately
						await storePageOcrResult(assetId, result);

						if (result.error) {
							errors.push(`Page ${page.pageNumber}: ${result.error}`);
						}
					} catch (error) {
						const errorMsg =
							error instanceof Error ? error.message : "Unknown error";
						errors.push(`Page ${page.pageNumber}: ${errorMsg}`);
					}

					processedCount++;
					onProgress?.(processedCount, totalPages);

					// Update status periodically
					if (processedCount % 10 === 0 || processedCount === totalPages) {
						ocrStatus.pagesProcessed = processedCount;
						await storeOcrStatus(assetId, ocrStatus);
					}
				}
			})
		);
	};

	await processBatch();

	// Final status update
	ocrStatus.pagesProcessed = processedCount;
	ocrStatus.status = errors.length > 0 ? "processing" : "completed";
	await storeOcrStatus(assetId, ocrStatus);

	return {
		success: errors.length === 0,
		pagesProcessed: processedCount,
		errors,
	};
}

/**
 * Finds pages with low confidence that need retry.
 */
export async function findLowConfidencePages(
	assetId: string,
	thresholds: RetryThresholds = DEFAULT_RETRY_THRESHOLDS
): Promise<{ pageNumber: number; reason: string }[]> {
	const results = await getAllOcrResults(assetId);
	return findPagesNeedingRetry(results, thresholds).map((p) => ({
		pageNumber: p.pageNumber,
		reason: p.reason || "unknown",
	}));
}

/**
 * Retries OCR on specific pages using the fallback model.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Retry loop with error handling and status tracking
export async function retryPagesWithClaude(
	assetId: string,
	pageNumbers: number[],
	options: OcrOptions = {},
	onProgress?: (processed: number, total: number) => void
): Promise<{ success: boolean; pagesRetried: number; errors: string[] }> {
	const config = validateOcrModelConfig();
	if (!config.claudeAvailable) {
		throw new Error(
			"No fallback model configured for retry (OPENROUTER_API_KEY is required)"
		);
	}

	const pageUrls = await getAllPageImageUrls(assetId);
	const pagesToRetry = pageUrls.filter((p) =>
		pageNumbers.includes(p.pageNumber)
	);

	if (pagesToRetry.length === 0) {
		return { success: true, pagesRetried: 0, errors: [] };
	}

	// Update status to retrying
	const ocrStatus = await getOcrStatus(assetId);
	if (ocrStatus) {
		ocrStatus.status = "retrying";
		await storeOcrStatus(assetId, ocrStatus);
	}

	const errors: string[] = [];
	let retriedCount = 0;

	// Process retries sequentially to avoid rate limits
	for (const page of pagesToRetry) {
		try {
			const result = await performOcrOnPageImage(
				page.url,
				page.pageNumber,
				options,
				"claude-sonnet"
			);

			// Mark as retried
			result.retried = true;

			// Get the original result to determine retry reason
			const originalResults = await getAllOcrResults(assetId);
			const originalResult = originalResults.find(
				(r) => r.pageNumber === page.pageNumber
			);
			if (originalResult) {
				const check = shouldRetryPage(originalResult);
				if (check.needsRetry) {
					result.retriedReason = check.reason;
				}
			}

			// Store updated result
			await storePageOcrResult(assetId, result);

			if (result.error) {
				errors.push(`Page ${page.pageNumber}: ${result.error}`);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			errors.push(`Page ${page.pageNumber}: ${errorMsg}`);
		}

		retriedCount++;
		onProgress?.(retriedCount, pagesToRetry.length);
	}

	// Update final status
	if (ocrStatus) {
		ocrStatus.status = "completed";
		ocrStatus.retriedCount = retriedCount;
		ocrStatus.completedAt = new Date().toISOString();
		await storeOcrStatus(assetId, ocrStatus);
	}

	return {
		success: errors.length === 0,
		pagesRetried: retriedCount,
		errors,
	};
}

/**
 * Runs the full OCR pipeline with automatic retries.
 */
export async function runOcrPipeline(
	assetId: string,
	options: OcrOptions = {},
	onProgress?: (phase: string, processed: number, total: number) => void
): Promise<{
	success: boolean;
	totalPages: number;
	retriedPages: number;
	errors: string[];
}> {
	// Phase 1: Initial OCR
	onProgress?.("ocr", 0, 0);
	const initialResult = await processOcrJob(
		assetId,
		options,
		10,
		(processed, total) => onProgress?.("ocr", processed, total)
	);

	if (!initialResult.success) {
		console.log(
			`[OCR] Initial pass completed with ${initialResult.errors.length} errors`
		);
	}

	// Phase 2: Find pages needing retry
	const pagesToRetry = await findLowConfidencePages(
		assetId,
		options.retryThresholds
	);

	if (pagesToRetry.length === 0) {
		return {
			success: initialResult.errors.length === 0,
			totalPages: initialResult.pagesProcessed,
			retriedPages: 0,
			errors: initialResult.errors,
		};
	}

	console.log(`[OCR] Found ${pagesToRetry.length} pages needing retry`);

	// Phase 3: Retry with fallback model
	const retryResult = await retryPagesWithClaude(
		assetId,
		pagesToRetry.map((p) => p.pageNumber),
		options,
		(processed, total) => onProgress?.("retry", processed, total)
	);

	return {
		success:
			initialResult.errors.length === 0 && retryResult.errors.length === 0,
		totalPages: initialResult.pagesProcessed,
		retriedPages: retryResult.pagesRetried,
		errors: [...initialResult.errors, ...retryResult.errors],
	};
}

/**
 * Legacy: Result from direct PDF OCR (kept for backward compatibility).
 */
export interface DirectPdfOcrResult {
	text: string;
	wordCount: number;
	confidence: number;
	processingTimeMs: number;
}

/**
 * Legacy: Performs OCR on an entire PDF file directly using Google AI.
 * @deprecated Use runOcrPipeline with page images instead for large files.
 */
export async function performDirectPdfOcr(
	pdfUrl: string,
	options: OcrOptions = {}
): Promise<DirectPdfOcrResult> {
	const { contentHint } = options;

	// Dynamic imports to avoid loading at module level
	const googleGenAiModule = await import("@google/genai");
	const { GoogleGenAI } = googleGenAiModule;
	const aiSdkGoogleModule = await import("@ai-sdk/google");
	const { google } = aiSdkGoogleModule;

	const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) {
		throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
	}

	const genai = new GoogleGenAI({ apiKey });

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

	// Use @ai-sdk/google for generation
	console.log("[OCR] Sending to Gemini via @ai-sdk/google...");

	let responseText: string;
	try {
		const result = await generateText({
			model: google("gemini-2.5-flash"),
			system: PDF_OCR_SYSTEM_PROMPT,
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: userPrompt },
						{
							type: "file",
							data: file.uri as string,
							mediaType: "application/pdf",
						},
					],
				},
			],
		});
		responseText = result.text;
	} catch (error: unknown) {
		console.error("[OCR] Full error object:", JSON.stringify(error, null, 2));
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
