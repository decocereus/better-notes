/**
 * Extraction API Route
 * Starts and manages content extraction jobs from OCR results.
 *
 * POST: Start a new extraction job
 *   - With assetId: Uses new per-page OCR format from R2
 *   - With ocrJobId: Uses legacy OCR job results format
 * GET: Get job status and results
 */

import { type NextRequest, NextResponse } from "next/server";
import { validateAIConfig } from "@/lib/ai";
import {
	detectEssayBoundaries,
	extractContentBatch,
	getEssayText,
	getExtractionStats,
	validateBoundaries,
} from "@/lib/extraction";
import {
	addJobError,
	addJobResult,
	completeJob,
	createJob,
	failJob,
	getJob,
	updateJobProgress,
} from "@/lib/processing";
import { downloadFromR2, uploadToR2, validateR2Config } from "@/lib/storage";
import type {
	EssayExtractionResult,
	ExtractedContent,
	ExtractionParameters,
} from "@/types/extraction";
import { DEFAULT_EXTRACTION_PARAMETERS } from "@/types/extraction";
import type { PageOcrResult } from "@/types/ocr";
import type {
	OcrJobResults,
	OcrPageResult,
	StartExtractionJobInput,
} from "@/types/processing";

/**
 * Results stored for an extraction job.
 */
interface ExtractionJobResults {
	jobId: string;
	ocrJobId?: string;
	assetId?: string;
	sourceKey: string;
	totalEssays: number;
	essays: EssayExtractionResult[];
	allItems: ExtractedContent[];
	stats: ReturnType<typeof getExtractionStats>;
	parameters: ExtractionParameters;
	processedAt: string;
}

/**
 * Converts new PageOcrResult format to legacy OcrPageResult format.
 * The formats are mostly compatible, just need to add hasHandwriting field.
 */
function convertToLegacyOcrFormat(pages: PageOcrResult[]): OcrPageResult[] {
	return pages.map((page) => ({
		pageNumber: page.pageNumber,
		text: page.text,
		confidence: page.confidence,
		wordCount: page.wordCount,
		hasHandwriting: true, // Assume handwritten for UPSC essays
		processingTimeMs: page.processingTimeMs,
	}));
}

/**
 * Validates that required services are configured.
 */
function validateRequiredConfigs():
	| { valid: true }
	| { valid: false; response: NextResponse } {
	const r2Config = validateR2Config();
	if (!r2Config.valid) {
		return {
			valid: false,
			response: NextResponse.json(
				{
					error: "R2 storage not configured",
					details: `Missing: ${r2Config.missing.join(", ")}`,
				},
				{ status: 503 }
			),
		};
	}

	const aiConfig = validateAIConfig();
	if (!aiConfig.valid) {
		return {
			valid: false,
			response: NextResponse.json(
				{ error: aiConfig.error || "AI not configured" },
				{ status: 503 }
			),
		};
	}

	return { valid: true };
}

/**
 * Updates asset status in Convex when starting extraction.
 */
async function updateAssetExtractionStatus(
	assetId: string,
	jobId: string
): Promise<void> {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return;
	}

	const { ConvexHttpClient } = await import("convex/browser");
	const { api } = await import("@/convex/_generated/api");
	const convex = new ConvexHttpClient(convexUrl);

	await convex.mutation(api.assets.updateStatus, {
		id: assetId as never,
		status: "extraction_processing",
		extractionJobId: jobId,
	});
}

/**
 * POST /api/extract
 * Starts a new extraction job from OCR results.
 *
 * Supports two modes:
 * - assetId only: Uses new per-page OCR format from R2
 * - ocrJobId: Uses legacy OCR job results format
 */
export async function POST(request: NextRequest) {
	try {
		// Validate configurations
		const configCheck = validateRequiredConfigs();
		if (!configCheck.valid) {
			return configCheck.response;
		}

		// Parse request
		const body = (await request.json()) as StartExtractionJobInput & {
			parameters?: ExtractionParameters;
			assetId?: string;
		};
		const { ocrJobId, parameters, assetId } = body;

		// Need either assetId or ocrJobId
		if (!(assetId || ocrJobId)) {
			return NextResponse.json(
				{ error: "Either assetId or ocrJobId is required" },
				{ status: 400 }
			);
		}

		// Merge with default parameters
		const extractionParams: ExtractionParameters = {
			...DEFAULT_EXTRACTION_PARAMETERS,
			...parameters,
		};

		// Load OCR results from appropriate source
		const ocrData = await loadOcrResults(assetId, ocrJobId);
		if (!ocrData.success) {
			return NextResponse.json(
				{ error: ocrData.error, status: ocrData.jobStatus },
				{ status: ocrData.status }
			);
		}

		const { results: ocrResults, sourceKey, projectId } = ocrData;

		// Create the extraction job
		const job = await createJob("extraction", sourceKey, projectId, 1);

		// Update asset status if provided
		if (assetId) {
			await updateAssetExtractionStatus(assetId, job.id);
		}

		// Start processing in the background
		processExtractionJob(
			job.id,
			ocrJobId,
			ocrResults,
			extractionParams,
			assetId
		).catch((error) => {
			console.error(`Extraction job ${job.id} failed:`, error);
			failJob(job.id, error instanceof Error ? error.message : "Unknown error");
		});

		return NextResponse.json(
			{
				jobId: job.id,
				status: job.status,
				ocrJobId: ocrJobId || undefined,
				assetId: assetId || undefined,
				sourceKey,
			},
			{ status: 202 }
		);
	} catch (error) {
		console.error("Failed to start extraction job:", error);
		return NextResponse.json(
			{
				error: "Failed to start extraction job",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

/**
 * Loads OCR results from either asset (new format) or job (legacy format).
 */
function loadOcrResults(
	assetId: string | undefined,
	ocrJobId: string | undefined
): Promise<
	| {
			success: true;
			results: OcrJobResults;
			sourceKey: string;
			projectId?: string;
	  }
	| { success: false; error: string; status: number; jobStatus?: string }
> {
	if (assetId && !ocrJobId) {
		return loadOcrResultsFromAsset(assetId);
	}
	if (ocrJobId) {
		return loadLegacyOcrResults(ocrJobId);
	}
	return Promise.resolve({
		success: false,
		error: "Invalid request",
		status: 400,
	});
}

/**
 * Loads OCR results from the new per-page format for an asset.
 */
async function loadOcrResultsFromAsset(assetId: string): Promise<
	| {
			success: true;
			results: OcrJobResults;
			sourceKey: string;
			projectId?: string;
	  }
	| { success: false; error: string; status: number }
> {
	// Import dynamically to avoid loading at module level
	const { getAllOcrResults } = await import("@/lib/storage/ocr-results");

	// Get asset info from Convex
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return { success: false, error: "Convex not configured", status: 503 };
	}

	const { ConvexHttpClient } = await import("convex/browser");
	const { api } = await import("@/convex/_generated/api");
	const convex = new ConvexHttpClient(convexUrl);

	const asset = await convex.query(api.assets.get, { id: assetId as never });
	if (!asset) {
		return { success: false, error: "Asset not found", status: 404 };
	}

	// Check if OCR is completed
	const ocrCompletedStatuses = [
		"ocr_completed",
		"extraction_queued",
		"extraction_processing",
		"extraction_completed",
		"extraction_failed",
	];
	if (!ocrCompletedStatuses.includes(asset.processingStatus)) {
		return {
			success: false,
			error: `OCR not completed. Current status: ${asset.processingStatus}`,
			status: 400,
		};
	}

	// Load per-page OCR results
	const pageResults = await getAllOcrResults(assetId);
	if (pageResults.length === 0) {
		return {
			success: false,
			error: "No OCR results found for asset",
			status: 404,
		};
	}

	// Convert to legacy format
	const legacyPages = convertToLegacyOcrFormat(pageResults);
	const totalWordCount = legacyPages.reduce((sum, p) => sum + p.wordCount, 0);
	const avgConfidence =
		legacyPages.reduce((sum, p) => sum + p.confidence, 0) / legacyPages.length;
	const combinedText = legacyPages
		.sort((a, b) => a.pageNumber - b.pageNumber)
		.map((p) => p.text)
		.join("\n\n---\n\n");

	const results: OcrJobResults = {
		jobId: assetId, // Use assetId as pseudo-jobId
		sourceKey: asset.key,
		totalPages: pageResults.length,
		pages: legacyPages,
		combinedText,
		totalWordCount,
		averageConfidence: avgConfidence,
		processedAt: new Date().toISOString(),
	};

	return {
		success: true,
		results,
		sourceKey: asset.key,
		projectId: asset.projectId as string | undefined,
	};
}

/**
 * Loads OCR results from the legacy job format.
 */
async function loadLegacyOcrResults(ocrJobId: string): Promise<
	| {
			success: true;
			results: OcrJobResults;
			sourceKey: string;
			projectId?: string;
	  }
	| { success: false; error: string; status: number; jobStatus?: string }
> {
	// Get the OCR job to verify it's completed
	const ocrJob = await getJob(ocrJobId);
	if (!ocrJob) {
		return { success: false, error: "OCR job not found", status: 404 };
	}

	if (ocrJob.status !== "completed") {
		return {
			success: false,
			error: "OCR job not completed",
			status: 400,
			jobStatus: ocrJob.status,
		};
	}

	// Load OCR results
	const ocrResultsKey = `processing/${ocrJobId}/ocr-results.json`;

	try {
		const { body: stream } = await downloadFromR2(ocrResultsKey);
		const text = await streamToString(stream);
		const results = JSON.parse(text) as OcrJobResults;

		return {
			success: true,
			results,
			sourceKey: ocrJob.sourceKey,
			projectId: ocrJob.projectId,
		};
	} catch {
		return { success: false, error: "Failed to load OCR results", status: 500 };
	}
}

/**
 * GET /api/extract?jobId=xxx
 * Gets the status and results of an extraction job.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const jobId = searchParams.get("jobId");

	if (!jobId) {
		return NextResponse.json({ error: "jobId is required" }, { status: 400 });
	}

	const job = await getJob(jobId);

	if (!job) {
		return NextResponse.json({ error: "Job not found" }, { status: 404 });
	}

	// If completed, load and return full results
	if (job.status === "completed") {
		const resultsKey = `processing/${jobId}/extraction-results.json`;

		try {
			const { body: stream } = await downloadFromR2(resultsKey);
			const text = await streamToString(stream);
			const results = JSON.parse(text) as ExtractionJobResults;

			return NextResponse.json({
				job: {
					id: job.id,
					status: job.status,
					progress: job.progress,
					totalItems: job.totalItems,
					processedItems: job.processedItems,
					errors: job.errors,
					createdAt: job.createdAt,
					completedAt: job.completedAt,
				},
				results,
			});
		} catch {
			// Results not available yet, return job status only
			return NextResponse.json({
				job: {
					id: job.id,
					status: job.status,
					progress: job.progress,
					totalItems: job.totalItems,
					processedItems: job.processedItems,
					errors: job.errors,
					createdAt: job.createdAt,
					completedAt: job.completedAt,
				},
			});
		}
	}

	// For pending/processing jobs, return status only
	return NextResponse.json({
		job: {
			id: job.id,
			status: job.status,
			progress: job.progress,
			totalItems: job.totalItems,
			processedItems: job.processedItems,
			errors: job.errors,
			createdAt: job.createdAt,
		},
	});
}

/**
 * Background function to process extraction job.
 */
async function processExtractionJob(
	jobId: string,
	ocrJobId: string,
	ocrResults: OcrJobResults,
	parameters: ExtractionParameters,
	assetId?: string
) {
	// Step 1: Detect essay boundaries
	const boundaries = await detectEssayBoundaries(ocrResults.pages);

	// Validate boundaries
	const validation = validateBoundaries(boundaries, ocrResults.totalPages);
	if (!validation.valid) {
		for (const issue of validation.issues) {
			await addJobError(jobId, issue);
		}
	}

	// Update total items to essay count
	await updateJobProgress(jobId, 0, boundaries.length);

	// Step 2: Prepare essays for extraction
	const essays = boundaries.map((boundary) => ({
		text: getEssayText(ocrResults.pages, boundary),
		startPage: boundary.startPage,
		endPage: boundary.endPage,
		title: boundary.title,
	}));

	// Step 3: Extract content from each essay
	const extractionResults = await extractContentBatch(
		essays,
		parameters,
		ocrResults.sourceKey,
		async (processed, total) => {
			await updateJobProgress(jobId, processed, total);
		}
	);

	// Collect all items
	const allItems = extractionResults.flatMap((r) => r.items);

	// Calculate stats
	const stats = getExtractionStats(extractionResults);

	// Save each essay result
	for (let i = 0; i < extractionResults.length; i++) {
		await addJobResult(jobId, extractionResults[i], i);
	}

	// Save complete results to R2
	const fullResults: ExtractionJobResults = {
		jobId,
		ocrJobId,
		sourceKey: ocrResults.sourceKey,
		totalEssays: extractionResults.length,
		essays: extractionResults,
		allItems,
		stats,
		parameters,
		processedAt: new Date().toISOString(),
	};

	const resultsKey = `processing/${jobId}/extraction-results.json`;
	await uploadToR2(
		resultsKey,
		Buffer.from(JSON.stringify(fullResults, null, 2)),
		"application/json"
	);

	await completeJob(jobId);

	// Update asset status and save extraction results if assetId provided
	if (assetId) {
		try {
			const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
			if (convexUrl) {
				const { ConvexHttpClient } = await import("convex/browser");
				const { api } = await import("@/convex/_generated/api");
				const convex = new ConvexHttpClient(convexUrl);

				// Update asset status (assetId is string from request, Convex validates at runtime)
				await convex.mutation(api.assets.updateStatus, {
					id: assetId as never,
					status: "extraction_completed",
					extractedItemCount: allItems.length,
				});

				// Create extraction results record
				await convex.mutation(api.extractionResults.create, {
					assetId: assetId as never,
					ocrJobId,
					extractionJobId: jobId,
					totalEssays: extractionResults.length,
					totalItems: allItems.length,
					stats,
					resultsKey,
				});

				console.log(
					`Asset ${assetId} extraction completed: ${allItems.length} items`
				);
			}
		} catch (err) {
			console.error(`Failed to update asset ${assetId}:`, err);
		}
	}
}

/**
 * Converts a ReadableStream to string.
 */
async function streamToString(stream: ReadableStream): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	let done = false;
	while (!done) {
		const result = await reader.read();
		done = result.done;
		if (result.value) {
			chunks.push(result.value);
		}
	}

	const combined = new Uint8Array(
		chunks.reduce((acc, chunk) => acc + chunk.length, 0)
	);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}

	return new TextDecoder().decode(combined);
}
