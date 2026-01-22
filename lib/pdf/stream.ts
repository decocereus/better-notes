/**
 * PDF Streaming Utility
 * Handles streaming PDFs from R2 for page-by-page processing.
 * Optimized for large files (190MB+) to avoid memory issues.
 */

import type { PDFDocumentProxy } from "pdfjs-dist";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import { getReadUrl } from "@/lib/storage";

// Set up the worker for pdf.js (required for parsing)
// In Next.js, we use the legacy build which doesn't require a separate worker
if (typeof window === "undefined") {
	// Server-side: use the legacy build
	GlobalWorkerOptions.workerSrc = "";
}

/**
 * PDF metadata extracted from the document.
 */
export interface PdfMetadata {
	/** Total number of pages */
	pageCount: number;
	/** PDF title from metadata */
	title?: string;
	/** PDF author from metadata */
	author?: string;
	/** PDF creation date */
	creationDate?: Date;
	/** File size in bytes */
	fileSize?: number;
	/** Whether the PDF is encrypted */
	isEncrypted: boolean;
}

/**
 * Options for loading a PDF.
 */
export interface PdfLoadOptions {
	/** R2 key of the PDF file */
	key: string;
	/** Password for encrypted PDFs */
	password?: string;
	/** Whether to use range requests for streaming (default: true for large files) */
	useRangeRequests?: boolean;
}

/**
 * Result of loading a PDF.
 */
export interface PdfLoadResult {
	/** The loaded PDF document */
	document: PDFDocumentProxy;
	/** PDF metadata */
	metadata: PdfMetadata;
	/** Signed URL used to access the PDF */
	url: string;
	/** When the URL expires */
	expiresAt: Date;
}

/**
 * Page range for batch processing.
 */
export interface PageRange {
	/** Start page (1-indexed) */
	start: number;
	/** End page (1-indexed, inclusive) */
	end: number;
}

/**
 * Creates page ranges for batch processing.
 * Useful for processing large PDFs in chunks to manage memory.
 */
export function createPageRanges(
	totalPages: number,
	pagesPerBatch: number
): PageRange[] {
	const ranges: PageRange[] = [];

	for (let start = 1; start <= totalPages; start += pagesPerBatch) {
		const end = Math.min(start + pagesPerBatch - 1, totalPages);
		ranges.push({ start, end });
	}

	return ranges;
}

/**
 * Loads a PDF from R2 storage.
 * Uses signed URLs for secure access.
 */
export async function loadPdfFromR2(
	options: PdfLoadOptions
): Promise<PdfLoadResult> {
	const { key, password } = options;

	// Get a signed URL for the PDF (valid for 1 hour)
	const urlResult = await getReadUrl({
		key,
		expiresIn: 3600,
	});

	// Load the PDF using pdf.js
	const loadingTask = getDocument({
		url: urlResult.readUrl,
		password,
		// Disable streaming for server-side processing
		disableAutoFetch: typeof window === "undefined",
		disableStream: typeof window === "undefined",
	});

	const document = await loadingTask.promise;

	// Extract metadata
	const metadataObj = await document.getMetadata();
	const info = metadataObj.info as Record<string, unknown> | undefined;

	const metadata: PdfMetadata = {
		pageCount: document.numPages,
		title: info?.Title as string | undefined,
		author: info?.Author as string | undefined,
		creationDate: info?.CreationDate
			? parseDate(info.CreationDate as string)
			: undefined,
		isEncrypted: false, // pdf.js would throw if encrypted without password
	};

	return {
		document,
		metadata,
		url: urlResult.readUrl,
		expiresAt: urlResult.expiresAt,
	};
}

/**
 * Gets PDF metadata without loading the full document.
 * Useful for quick checks before processing.
 */
export async function getPdfMetadata(key: string): Promise<PdfMetadata> {
	const result = await loadPdfFromR2({ key });

	// Get metadata and close the document to free memory
	const { metadata, document } = result;
	await document.destroy();

	return metadata;
}

/**
 * Calculates estimated processing time based on page count.
 * Based on empirical data: ~2-3 seconds per page for OCR.
 */
export function estimateProcessingTime(pageCount: number): {
	minSeconds: number;
	maxSeconds: number;
	formatted: string;
} {
	const minSeconds = pageCount * 2;
	const maxSeconds = pageCount * 3;

	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		if (remainingSeconds === 0) {
			return `${minutes}m`;
		}
		return `${minutes}m ${remainingSeconds}s`;
	};

	return {
		minSeconds,
		maxSeconds,
		formatted: `${formatTime(minSeconds)} - ${formatTime(maxSeconds)}`,
	};
}

/**
 * Calculates optimal batch size based on available memory.
 * Larger PDFs need smaller batches to avoid memory issues.
 */
export function calculateOptimalBatchSize(
	totalPages: number,
	_fileSizeBytes?: number
): number {
	// Default batch sizes based on page count
	if (totalPages <= 10) {
		return totalPages; // Process all at once for small PDFs
	}
	if (totalPages <= 50) {
		return 10;
	}
	if (totalPages <= 200) {
		return 20;
	}
	// For very large PDFs (like 190MB topper essays), use smaller batches
	return 15;
}

/**
 * Parses a PDF date string to a Date object.
 * PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm'
 */
function parseDate(pdfDate: string): Date | undefined {
	if (!pdfDate || typeof pdfDate !== "string") {
		return undefined;
	}

	// Remove the D: prefix if present
	const dateStr = pdfDate.startsWith("D:") ? pdfDate.slice(2) : pdfDate;

	// Extract components (at minimum YYYY)
	const year = Number.parseInt(dateStr.slice(0, 4), 10);
	const month = Number.parseInt(dateStr.slice(4, 6) || "1", 10) - 1;
	const day = Number.parseInt(dateStr.slice(6, 8) || "1", 10);
	const hour = Number.parseInt(dateStr.slice(8, 10) || "0", 10);
	const minute = Number.parseInt(dateStr.slice(10, 12) || "0", 10);
	const second = Number.parseInt(dateStr.slice(12, 14) || "0", 10);

	if (Number.isNaN(year)) {
		return undefined;
	}

	return new Date(year, month, day, hour, minute, second);
}
