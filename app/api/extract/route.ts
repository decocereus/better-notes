/**
 * Extraction API Route
 * Starts and manages content extraction jobs from OCR results.
 *
 * POST: Start a new extraction job
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
import type {
	OcrJobResults,
	StartExtractionJobInput,
} from "@/types/processing";

/**
 * Results stored for an extraction job.
 */
interface ExtractionJobResults {
	jobId: string;
	ocrJobId: string;
	sourceKey: string;
	totalEssays: number;
	essays: EssayExtractionResult[];
	allItems: ExtractedContent[];
	stats: ReturnType<typeof getExtractionStats>;
	parameters: ExtractionParameters;
	processedAt: string;
}

/**
 * POST /api/extract
 * Starts a new extraction job from OCR results.
 */
export async function POST(request: NextRequest) {
	try {
		// Validate configurations
		const r2Config = validateR2Config();
		if (!r2Config.valid) {
			return NextResponse.json(
				{
					error: "R2 storage not configured",
					details: `Missing: ${r2Config.missing.join(", ")}`,
				},
				{ status: 503 }
			);
		}

		const aiConfig = validateAIConfig();
		if (!aiConfig.valid) {
			return NextResponse.json(
				{ error: aiConfig.error || "AI not configured" },
				{ status: 503 }
			);
		}

		// Parse request
		const body = (await request.json()) as StartExtractionJobInput & {
			parameters?: ExtractionParameters;
			assetId?: string;
		};
		const { ocrJobId, parameters, assetId } = body;

		if (!ocrJobId) {
			return NextResponse.json(
				{ error: "ocrJobId is required" },
				{ status: 400 }
			);
		}

		// Get the OCR job to verify it's completed
		const ocrJob = await getJob(ocrJobId);
		if (!ocrJob) {
			return NextResponse.json({ error: "OCR job not found" }, { status: 404 });
		}

		if (ocrJob.status !== "completed") {
			return NextResponse.json(
				{
					error: "OCR job not completed",
					status: ocrJob.status,
					progress: ocrJob.progress,
				},
				{ status: 400 }
			);
		}

		// Load OCR results
		const ocrResultsKey = `processing/${ocrJobId}/ocr-results.json`;
		let ocrResults: OcrJobResults;

		try {
			const { body: stream } = await downloadFromR2(ocrResultsKey);
			const text = await streamToString(stream);
			ocrResults = JSON.parse(text) as OcrJobResults;
		} catch {
			return NextResponse.json(
				{ error: "Failed to load OCR results" },
				{ status: 500 }
			);
		}

		// Merge with default parameters
		const extractionParams: ExtractionParameters = {
			...DEFAULT_EXTRACTION_PARAMETERS,
			...parameters,
		};

		// Create the extraction job
		// We don't know essay count yet, will update after detection
		const job = await createJob(
			"extraction",
			ocrJob.sourceKey,
			ocrJob.projectId,
			1 // Initial estimate, will update
		);

		// Update asset status if provided
		if (assetId) {
			const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
			if (convexUrl) {
				const { ConvexHttpClient } = await import("convex/browser");
				const { api } = await import("@/convex/_generated/api");
				const convex = new ConvexHttpClient(convexUrl);

				// assetId is a string from the request, Convex validates at runtime
				await convex.mutation(api.assets.updateStatus, {
					id: assetId as never,
					status: "extraction_processing",
					extractionJobId: job.id,
				});
			}
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
				ocrJobId,
				sourceKey: ocrJob.sourceKey,
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
