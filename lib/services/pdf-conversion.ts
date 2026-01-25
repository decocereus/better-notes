/**
 * PDF Conversion Service
 *
 * Converts PDF files to page images using a self-hosted Railway converter.
 * The converter uses Poppler (pdftoppm) for reliable PDF-to-JPEG conversion.
 *
 * This service handles large PDFs (500MB+, 1300+ pages) that cannot be
 * processed directly by LLM APIs.
 */

import { env } from "@/lib/env";
import type { ConversionStatus } from "@/types/ocr";

/** Regex to strip trailing slash from URL */
const TRAILING_SLASH_REGEX = /\/$/;

/**
 * Options for PDF conversion.
 */
export interface PdfConversionOptions {
	/** Image quality (1-100, default: 85) */
	quality?: number;
	/** Target DPI (default: 150) */
	dpi?: number;
	/** Image format (default: jpg) */
	format?: "jpg" | "png";
}

/**
 * Result from PDF conversion.
 */
export interface PdfConversionResult {
	success: boolean;
	totalPages: number;
	convertedPages: number;
	errors: string[];
}

/**
 * Response from the converter service.
 */
interface ConverterResponse {
	success: boolean;
	totalPages: number;
	errors: string[];
}

/**
 * Validates converter service configuration.
 */
export function validateConverterConfig(): {
	valid: boolean;
	error?: string;
} {
	if (!env.CONVERTER_URL) {
		return {
			valid: false,
			error: "CONVERTER_URL is not configured",
		};
	}
	return { valid: true };
}

/**
 * Converts a PDF to images using the Railway converter service.
 *
 * @param assetId - The asset ID for storing results
 * @param sourceKey - R2 key of the source PDF
 * @param options - Conversion options
 * @param onProgress - Progress callback
 */
export async function convertPdfToImages(
	assetId: string,
	sourceKey: string,
	options: PdfConversionOptions = {},
	onProgress?: (converted: number, total: number) => void
): Promise<PdfConversionResult> {
	const config = validateConverterConfig();
	if (!config.valid) {
		throw new Error(config.error);
	}

	const { quality = 85, dpi = 150, format = "jpg" } = options;

	console.log(`[PDF] Calling converter service for asset ${assetId}`);

	// Build request headers
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};

	if (env.CONVERTER_TOKEN) {
		headers.Authorization = `Bearer ${env.CONVERTER_TOKEN}`;
	}

	// Call the converter service
	const converterUrl = env.CONVERTER_URL.replace(TRAILING_SLASH_REGEX, "");
	const response = await fetch(`${converterUrl}/convert`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			assetId,
			sourceKey,
			dpi,
			quality,
			format,
		}),
	});

	if (!response.ok) {
		const errorData = (await response.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new Error(
			`Converter service error: ${response.status} - ${errorData.error || "Unknown error"}`
		);
	}

	const result = (await response.json()) as ConverterResponse;
	console.log(
		`[PDF] Conversion complete: ${result.totalPages} pages, ${result.errors.length} errors`
	);

	// Call progress callback with final state
	if (onProgress && result.totalPages > 0) {
		onProgress(result.totalPages, result.totalPages);
	}

	return {
		success: result.success,
		totalPages: result.totalPages,
		convertedPages: result.totalPages - result.errors.length,
		errors: result.errors,
	};
}

/**
 * Gets the conversion progress for an asset.
 */
export async function getConversionProgress(assetId: string): Promise<{
	status: ConversionStatus["status"];
	progress: number;
	pagesProcessed: number;
	totalPages: number;
	error?: string;
}> {
	const { getConversionStatus } = await import("@/lib/storage/page-images");
	const status = await getConversionStatus(assetId);

	if (!status) {
		return {
			status: "pending",
			progress: 0,
			pagesProcessed: 0,
			totalPages: 0,
		};
	}

	const progress =
		status.totalPages > 0
			? Math.round((status.pagesProcessed / status.totalPages) * 100)
			: 0;

	return {
		status: status.status,
		progress,
		pagesProcessed: status.pagesProcessed,
		totalPages: status.totalPages,
		error: status.error,
	};
}
