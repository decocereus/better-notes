/**
 * OCR API Route
 * Starts and manages OCR processing jobs for PDF files.
 *
 * POST: Start a new OCR job
 * GET: Get job status
 */

import { type NextRequest, NextResponse } from "next/server";
import { validateAIConfig } from "@/lib/ai";
import { combineOcrResults, performOcrOnPage } from "@/lib/ai/ocr";
import {
	calculateOptimalBatchSize,
	createPageRanges,
	createProcessingPlan,
	loadPdfFromR2,
} from "@/lib/pdf";
import {
	addJobError,
	addJobResult,
	completeJob,
	createJob,
	failJob,
	getJob,
	updateJobProgress,
} from "@/lib/processing";
import { getReadUrl, uploadToR2, validateR2Config } from "@/lib/storage";
import type { OcrJobResults, OcrPageResult, StartOcrJobInput } from "@/types";

/**
 * Extended input that includes asset tracking.
 */
interface ExtendedOcrJobInput extends StartOcrJobInput {
	assetId?: string;
	autoExtract?: boolean;
}

/**
 * POST /api/ocr
 * Starts a new OCR processing job.
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
		const body = (await request.json()) as ExtendedOcrJobInput;
		const { sourceKey, projectId, startPage, endPage, assetId, autoExtract } =
			body;

		if (!sourceKey) {
			return NextResponse.json(
				{ error: "sourceKey is required" },
				{ status: 400 }
			);
		}

		// Load PDF and analyze
		const pdfResult = await loadPdfFromR2({ key: sourceKey });
		const { metadata, document } = pdfResult;

		// Create processing plan
		const plan = await createProcessingPlan(pdfResult);

		// Determine page range
		const firstPage = startPage ?? 1;
		const lastPage = endPage ?? metadata.pageCount;
		const totalPages = lastPage - firstPage + 1;

		// Create the job
		const job = await createJob("ocr", sourceKey, projectId, totalPages);

		// Start processing in the background
		processOcrJob(
			job.id,
			pdfResult,
			firstPage,
			lastPage,
			plan.approach,
			assetId,
			autoExtract,
			request.url
		).catch((error) => {
			console.error(`OCR job ${job.id} failed:`, error);
			failJob(job.id, error instanceof Error ? error.message : "Unknown error");
		});

		// Clean up - destroy document after starting background processing
		await document.destroy();

		return NextResponse.json(
			{
				jobId: job.id,
				status: job.status,
				totalPages,
				processingPlan: plan,
			},
			{ status: 202 }
		);
	} catch (error) {
		console.error("Failed to start OCR job:", error);
		return NextResponse.json(
			{
				error: "Failed to start OCR job",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

/**
 * GET /api/ocr?jobId=xxx
 * Gets the status and results of an OCR job.
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

	// If completed, include the combined results
	if (job.status === "completed") {
		const ocrResults = job.results.map((r) => r.data as OcrPageResult);
		const combined = combineOcrResults(ocrResults);

		const fullResults: OcrJobResults = {
			jobId: job.id,
			sourceKey: job.sourceKey,
			totalPages: job.totalItems,
			pages: ocrResults,
			combinedText: combined.fullText,
			totalWordCount: combined.totalWords,
			averageConfidence: combined.averageConfidence,
			processedAt: job.completedAt || job.updatedAt,
		};

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
			results: fullResults,
		});
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
 * Background function to process OCR job.
 * This runs asynchronously after the initial response.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Background job processing requires handling many cases
async function processOcrJob(
	jobId: string,
	pdfResult: Awaited<ReturnType<typeof loadPdfFromR2>>,
	startPage: number,
	endPage: number,
	_approach: "ocr_all" | "ocr_partial" | "text_only",
	assetId?: string,
	autoExtract?: boolean,
	requestUrl?: string
) {
	const totalPages = endPage - startPage + 1;
	const batchSize = calculateOptimalBatchSize(totalPages);
	const ranges = createPageRanges(totalPages, batchSize);

	// Reload PDF for processing (previous instance might be destroyed)
	const freshPdf = await loadPdfFromR2({ key: pdfResult.metadata.title || "" });

	let processedCount = 0;

	for (const range of ranges) {
		const actualStart = startPage + range.start - 1;
		const actualEnd = Math.min(startPage + range.end - 1, endPage);

		for (let pageNum = actualStart; pageNum <= actualEnd; pageNum++) {
			try {
				// Get signed URL for the PDF (for LLM access)
				// Note: We're passing the PDF URL, the LLM will render the specific page
				const urlResult = await getReadUrl({
					key: freshPdf.metadata.title || pdfResult.metadata.title || "",
					expiresIn: 3600,
				});

				// For now, we pass the full PDF URL with page hint
				// The OCR model handles extracting specific pages
				const result = await performOcrOnPage(
					`${urlResult.readUrl}#page=${pageNum}`,
					pageNum,
					{
						contentHint: "UPSC essay answer sheet, handwritten content",
					}
				);

				await addJobResult(jobId, result, pageNum);
				processedCount++;
				await updateJobProgress(jobId, processedCount, totalPages);
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "OCR failed";
				await addJobError(jobId, errorMessage, pageNum);
			}
		}
	}

	// Save combined results to R2
	const job = await getJob(jobId);
	if (job) {
		const ocrResults = job.results.map((r) => r.data as OcrPageResult);
		const combined = combineOcrResults(ocrResults);

		const fullResults: OcrJobResults = {
			jobId: job.id,
			sourceKey: job.sourceKey,
			totalPages: job.totalItems,
			pages: ocrResults,
			combinedText: combined.fullText,
			totalWordCount: combined.totalWords,
			averageConfidence: combined.averageConfidence,
			processedAt: new Date().toISOString(),
		};

		// Store results in R2
		const resultsKey = `processing/${jobId}/ocr-results.json`;
		await uploadToR2(
			resultsKey,
			Buffer.from(JSON.stringify(fullResults, null, 2)),
			"application/json"
		);

		// Update asset status if assetId provided
		if (assetId) {
			try {
				const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
				if (convexUrl) {
					const { ConvexHttpClient } = await import("convex/browser");
					const { api } = await import("@/convex/_generated/api");
					const convex = new ConvexHttpClient(convexUrl);

					// assetId is string from request, Convex validates at runtime
					await convex.mutation(api.assets.updateStatus, {
						id: assetId as never,
						status: "ocr_completed",
						ocrWordCount: fullResults.totalWordCount,
					});

					console.log(`Updated asset ${assetId} status to ocr_completed`);

					// Trigger extraction if autoExtract is enabled
					if (autoExtract && requestUrl) {
						const baseUrl = new URL(requestUrl).origin;
						fetch(`${baseUrl}/api/extract`, {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								ocrJobId: jobId,
								assetId,
							}),
						}).catch((err) => {
							console.error(
								`Failed to trigger auto-extraction for asset ${assetId}:`,
								err
							);
						});

						// Update asset status to extraction_queued
						await convex.mutation(api.assets.updateStatus, {
							id: assetId as never,
							status: "extraction_queued",
						});

						console.log(`Auto-extraction triggered for asset ${assetId}`);
					}
				}
			} catch (err) {
				console.error(`Failed to update asset ${assetId}:`, err);
			}
		}
	}

	await completeJob(jobId);

	// Clean up
	await freshPdf.document.destroy();
}
