/**
 * PDF Conversion Service
 *
 * Converts PDF files to page images using external services.
 * Currently supports CloudConvert API for reliable PDF-to-image conversion.
 *
 * This service is designed to handle large PDFs (500MB+, 1300+ pages)
 * that cannot be processed directly by LLM APIs.
 */

import { env } from "@/lib/env";
import {
	storeAssetMetadata,
	storeConversionStatus,
	storePageImage,
} from "@/lib/storage/page-images";
import { getReadUrl } from "@/lib/storage/signed-urls";
import type { AssetMetadata, ConversionStatus } from "@/types/ocr";

/**
 * Regex for extracting page number from CloudConvert output filename.
 */
const PAGE_NUMBER_REGEX = /(\d+)\.(jpg|png)$/i;

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
	/** Specific pages to convert (default: all) */
	pages?: number[];
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
 * CloudConvert job status.
 */
interface CloudConvertJob {
	id: string;
	status: "waiting" | "processing" | "finished" | "error";
	tasks: CloudConvertTask[];
}

/**
 * CloudConvert task.
 */
interface CloudConvertTask {
	id: string;
	name: string;
	operation: string;
	status: "waiting" | "processing" | "finished" | "error";
	result?: {
		files?: Array<{
			filename: string;
			url: string;
		}>;
	};
	message?: string;
}

/**
 * Validates CloudConvert API configuration.
 */
export function validateCloudConvertConfig(): {
	valid: boolean;
	error?: string;
} {
	if (!env.CLOUDCONVERT_API_KEY) {
		return {
			valid: false,
			error: "CLOUDCONVERT_API_KEY is not configured",
		};
	}
	return { valid: true };
}

/**
 * Converts a PDF to images using CloudConvert API.
 *
 * @param assetId - The asset ID for storing results
 * @param sourceKey - R2 key of the source PDF
 * @param options - Conversion options
 * @param onProgress - Progress callback
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multi-step API workflow requires sequential logic
export async function convertPdfToImages(
	assetId: string,
	sourceKey: string,
	options: PdfConversionOptions = {},
	onProgress?: (converted: number, total: number) => void
): Promise<PdfConversionResult> {
	const config = validateCloudConvertConfig();
	if (!config.valid) {
		throw new Error(config.error);
	}

	const { quality = 85, dpi = 150, format = "jpg" } = options;

	// Initialize conversion status
	const conversionStatus: ConversionStatus = {
		status: "processing",
		pagesProcessed: 0,
		totalPages: 0,
		startedAt: new Date().toISOString(),
	};
	await storeConversionStatus(assetId, conversionStatus);

	try {
		// Get signed URL for the PDF
		const { readUrl: pdfUrl } = await getReadUrl({
			key: sourceKey,
			expiresIn: 7200, // 2 hours for large files
		});

		// Create CloudConvert job
		console.log("[PDF] Creating CloudConvert job...");
		const job = await createCloudConvertJob(pdfUrl, format, dpi, quality);
		console.log(`[PDF] Job created: ${job.id}`);

		// Wait for job to complete
		const completedJob = await waitForCloudConvertJob(job.id);
		console.log(`[PDF] Job completed: ${completedJob.status}`);

		if (completedJob.status === "error") {
			const errorTask = completedJob.tasks.find((t) => t.status === "error");
			throw new Error(errorTask?.message || "CloudConvert job failed");
		}

		// Find the export task with the result files
		const exportTask = completedJob.tasks.find(
			(t) => t.operation === "export/url" && t.status === "finished"
		);

		if (!exportTask?.result?.files) {
			throw new Error("No output files from CloudConvert");
		}

		const files = exportTask.result.files;
		conversionStatus.totalPages = files.length;

		console.log(`[PDF] Downloading ${files.length} page images...`);

		// Download and store each page image
		const errors: string[] = [];
		let convertedCount = 0;

		for (const file of files) {
			// Extract page number from filename (e.g., "page-0001.jpg" or "0001.jpg")
			const match = file.filename.match(PAGE_NUMBER_REGEX);
			const pageNumber = match
				? Number.parseInt(match[1], 10)
				: convertedCount + 1;

			try {
				// Download from CloudConvert
				const response = await fetch(file.url);
				if (!response.ok) {
					throw new Error(`Failed to download: ${response.status}`);
				}
				const imageBuffer = Buffer.from(await response.arrayBuffer());

				// Store in R2
				await storePageImage(assetId, pageNumber, imageBuffer);

				convertedCount++;
				conversionStatus.pagesProcessed = convertedCount;
				onProgress?.(convertedCount, files.length);

				// Update status periodically
				if (convertedCount % 10 === 0 || convertedCount === files.length) {
					await storeConversionStatus(assetId, conversionStatus);
				}
			} catch (error) {
				const errorMsg =
					error instanceof Error ? error.message : "Unknown error";
				errors.push(`Page ${pageNumber}: ${errorMsg}`);
			}
		}

		// Store metadata
		const metadata: AssetMetadata = {
			totalPages: files.length,
			originalFilename: sourceKey.split("/").pop() || "unknown.pdf",
			originalSize: 0, // Will be updated later
			convertedAt: new Date().toISOString(),
		};
		await storeAssetMetadata(assetId, metadata);

		// Update final status
		conversionStatus.status = errors.length > 0 ? "failed" : "completed";
		conversionStatus.completedAt = new Date().toISOString();
		if (errors.length > 0) {
			conversionStatus.error = errors.join("; ");
		}
		await storeConversionStatus(assetId, conversionStatus);

		return {
			success: errors.length === 0,
			totalPages: files.length,
			convertedPages: convertedCount,
			errors,
		};
	} catch (error) {
		// Update status to failed
		conversionStatus.status = "failed";
		conversionStatus.error =
			error instanceof Error ? error.message : "Unknown error";
		conversionStatus.completedAt = new Date().toISOString();
		await storeConversionStatus(assetId, conversionStatus);

		throw error;
	}
}

/**
 * Creates a CloudConvert job for PDF to image conversion.
 */
async function createCloudConvertJob(
	pdfUrl: string,
	format: "jpg" | "png",
	dpi: number,
	quality: number
): Promise<CloudConvertJob> {
	const apiKey = env.CLOUDCONVERT_API_KEY;

	const response = await fetch("https://api.cloudconvert.com/v2/jobs", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			tasks: {
				"import-pdf": {
					operation: "import/url",
					url: pdfUrl,
				},
				"convert-to-images": {
					operation: "convert",
					input: ["import-pdf"],
					input_format: "pdf",
					output_format: format,
					engine: "poppler",
					pages: "1-", // All pages
					density: dpi,
					quality,
					filename: "page-%04d.{format}",
				},
				"export-images": {
					operation: "export/url",
					input: ["convert-to-images"],
				},
			},
		}),
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(
			`CloudConvert API error: ${response.status} - ${JSON.stringify(errorData)}`
		);
	}

	const data = (await response.json()) as { data: CloudConvertJob };
	return data.data;
}

/**
 * Waits for a CloudConvert job to complete.
 */
async function waitForCloudConvertJob(
	jobId: string,
	maxWaitMs = 3_600_000 // 1 hour max
): Promise<CloudConvertJob> {
	const apiKey = env.CLOUDCONVERT_API_KEY;
	const startTime = Date.now();

	while (Date.now() - startTime < maxWaitMs) {
		const response = await fetch(
			`https://api.cloudconvert.com/v2/jobs/${jobId}`,
			{
				headers: {
					Authorization: `Bearer ${apiKey}`,
				},
			}
		);

		if (!response.ok) {
			throw new Error(`Failed to check job status: ${response.status}`);
		}

		const data = (await response.json()) as { data: CloudConvertJob };
		const job = data.data;

		if (job.status === "finished" || job.status === "error") {
			return job;
		}

		// Wait 5 seconds before polling again
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}

	throw new Error("CloudConvert job timed out");
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
