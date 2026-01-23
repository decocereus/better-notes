/**
 * Types for the OCR pipeline with PDF-to-Images conversion and multi-model fallback.
 */

/**
 * Result from OCR processing of a single page image.
 */
export interface PageOcrResult {
	pageNumber: number;
	text: string;
	wordCount: number;
	/** Confidence score from 0-1 */
	confidence: number;
	/** Count of [illegible] markers in the text */
	illegibleCount: number;
	/** Which model performed the OCR */
	model: "gemini-flash" | "claude-sonnet";
	/** Processing time in milliseconds */
	processingTimeMs: number;
	/** Whether this page was retried with a different model */
	retried: boolean;
	/** Reason for retry if applicable */
	retriedReason?:
		| "low_confidence"
		| "low_word_count"
		| "high_illegible"
		| "error";
	/** Error message if processing failed */
	error?: string;
}

/**
 * Status of PDF-to-images conversion.
 */
export interface ConversionStatus {
	status: "pending" | "processing" | "completed" | "failed";
	pagesProcessed: number;
	totalPages: number;
	startedAt?: string;
	completedAt?: string;
	error?: string;
}

/**
 * Status of OCR processing.
 */
export interface OcrStatus {
	status: "pending" | "processing" | "retrying" | "completed" | "failed";
	pagesProcessed: number;
	totalPages: number;
	retriedCount: number;
	startedAt?: string;
	completedAt?: string;
	error?: string;
}

/**
 * Metadata for an asset's converted pages.
 */
export interface AssetMetadata {
	totalPages: number;
	dimensions?: {
		width: number;
		height: number;
	};
	originalFilename: string;
	originalSize: number;
	convertedAt: string;
}

/**
 * Thresholds for determining when to retry OCR with a different model.
 */
export interface RetryThresholds {
	/** Retry if word count is below this value */
	minWordCount: number;
	/** Retry if illegible ratio is above this value (0-1) */
	maxIllegibleRatio: number;
	/** Retry if confidence is below this value (0-1) */
	minConfidence: number;
}

/**
 * Default retry thresholds.
 */
export const DEFAULT_RETRY_THRESHOLDS: RetryThresholds = {
	minWordCount: 30,
	maxIllegibleRatio: 0.15,
	minConfidence: 0.7,
};

/**
 * Combined OCR results for an asset.
 */
export interface AssetOcrResults {
	assetId: string;
	totalPages: number;
	pages: PageOcrResult[];
	combinedText: string;
	totalWordCount: number;
	averageConfidence: number;
	retriedCount: number;
	processedAt: string;
}

/**
 * Input for starting the OCR pipeline.
 */
export interface StartOcrPipelineInput {
	assetId: string;
	sourceKey: string;
	autoExtract?: boolean;
}

/**
 * Progress update for the OCR pipeline.
 */
export interface OcrPipelineProgress {
	phase: "conversion" | "ocr" | "retry" | "completed" | "failed";
	conversionProgress?: {
		pagesProcessed: number;
		totalPages: number;
	};
	ocrProgress?: {
		pagesProcessed: number;
		totalPages: number;
	};
	retryProgress?: {
		pagesRetried: number;
		totalToRetry: number;
	};
	error?: string;
}
