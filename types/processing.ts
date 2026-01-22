/**
 * Types for processing jobs (OCR, extraction, classification).
 * Used to track long-running background tasks.
 */

/**
 * Types of processing jobs.
 */
export type ProcessingJobType = "ocr" | "extraction" | "classification";

/**
 * Status of a processing job.
 */
export type ProcessingJobStatus =
	| "pending"
	| "processing"
	| "completed"
	| "failed";

/**
 * A processing job for tracking long-running operations.
 */
export interface ProcessingJob {
	id: string;
	type: ProcessingJobType;
	status: ProcessingJobStatus;

	/** Progress percentage (0-100) */
	progress: number;

	/** Total items to process (e.g., pages for OCR) */
	totalItems: number;

	/** Number of items processed so far */
	processedItems: number;

	/** R2 key of the source file */
	sourceKey: string;

	/** Project ID this job belongs to */
	projectId?: string;

	/** Results of the processing (type depends on job type) */
	results: ProcessingJobResult[];

	/** Any errors encountered during processing */
	errors: ProcessingError[];

	createdAt: string;
	updatedAt: string;
	completedAt?: string;
}

/**
 * A single result from processing (e.g., one page's OCR result).
 */
export interface ProcessingJobResult {
	itemIndex: number;
	data: unknown; // Type depends on job type
	processedAt: string;
}

/**
 * An error encountered during processing.
 */
export interface ProcessingError {
	itemIndex?: number;
	message: string;
	code?: string;
	timestamp: string;
}

/**
 * Result of OCR processing for a single page.
 */
export interface OcrPageResult {
	pageNumber: number;
	text: string;
	confidence: number;
	wordCount: number;
	hasHandwriting: boolean;
	/** Processing time in milliseconds */
	processingTimeMs?: number;
}

/**
 * Complete OCR results for a PDF.
 */
export interface OcrJobResults {
	jobId: string;
	sourceKey: string;
	totalPages: number;
	pages: OcrPageResult[];
	combinedText: string;
	totalWordCount: number;
	averageConfidence: number;
	processedAt: string;
}

/**
 * Input for starting an OCR job.
 */
export interface StartOcrJobInput {
	sourceKey: string;
	projectId?: string;
	/** Optional: specific page range to process */
	startPage?: number;
	endPage?: number;
}

/**
 * Input for starting an extraction job.
 */
export interface StartExtractionJobInput {
	ocrJobId: string;
	parametersId?: string; // ID of saved parameters, or use defaults
}

/**
 * Input for starting a classification job.
 */
export interface StartClassificationJobInput {
	extractionJobId: string;
	themePageId: string;
}

/**
 * Summary of a processing job for display.
 */
export interface ProcessingJobSummary {
	id: string;
	type: ProcessingJobType;
	status: ProcessingJobStatus;
	progress: number;
	sourceKey: string;
	createdAt: string;
	completedAt?: string;
	errorCount: number;
}

/**
 * Storage info for uploaded files.
 */
export interface UploadedFile {
	id: string;
	key: string; // R2 key
	filename: string;
	contentType: string;
	size: number;
	projectId?: string;
	uploadedAt: string;
	processingJobId?: string;
}
