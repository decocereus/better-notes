/**
 * OCR API Route
 * Starts and manages OCR processing jobs for PDF files.
 *
 * Uses direct PDF-to-LLM approach - sends PDF URL directly to Gemini
 * instead of rendering pages with pdf.js.
 *
 * POST: Start a new OCR job
 * GET: Get job status
 */

import { type NextRequest, NextResponse } from "next/server";
import { validateAIConfig } from "@/lib/ai";
import { performDirectPdfOcr } from "@/lib/ai/ocr";
import {
	completeJob,
	createJob,
	failJob,
	getJob,
	updateJobProgress,
} from "@/lib/processing";
import { getReadUrl, uploadToR2, validateR2Config } from "@/lib/storage";
import type { OcrJobResults, StartOcrJobInput } from "@/types";

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
		const { sourceKey, projectId, assetId, autoExtract } = body;

		if (!sourceKey) {
			return NextResponse.json(
				{ error: "sourceKey is required" },
				{ status: 400 }
			);
		}

		// Get signed URL for the PDF
		const urlResult = await getReadUrl({
			key: sourceKey,
			expiresIn: 3600, // 1 hour
		});

		// Create the job (1 item = entire PDF)
		const job = await createJob("ocr", sourceKey, projectId, 1);

		// Start processing in the background
		processOcrJob(
			job.id,
			sourceKey,
			urlResult.readUrl,
			assetId,
			autoExtract,
			request.url
		).catch((error) => {
			console.error(`OCR job ${job.id} failed:`, error);
			failJob(job.id, error instanceof Error ? error.message : "Unknown error");
		});

		return NextResponse.json(
			{
				jobId: job.id,
				status: job.status,
				message: "OCR processing started - PDF sent directly to LLM",
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

	// If completed, try to load results from R2
	if (job.status === "completed") {
		try {
			const resultsUrl = await getReadUrl({
				key: `processing/${jobId}/ocr-results.json`,
				expiresIn: 3600,
			});

			const resultsResponse = await fetch(resultsUrl.readUrl);
			if (resultsResponse.ok) {
				const results = (await resultsResponse.json()) as OcrJobResults;
				return NextResponse.json({
					job: {
						id: job.id,
						status: job.status,
						progress: job.progress,
						createdAt: job.createdAt,
						completedAt: job.completedAt,
					},
					results,
				});
			}
		} catch {
			// Results file not found, return basic job info
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
			completedAt: job.completedAt,
		},
	});
}

/**
 * Background function to process OCR job.
 * Sends the entire PDF to the LLM for OCR processing.
 */
async function processOcrJob(
	jobId: string,
	sourceKey: string,
	pdfUrl: string,
	assetId?: string,
	autoExtract?: boolean,
	requestUrl?: string
) {
	console.log(`[OCR] Starting direct PDF OCR for job ${jobId}`);

	try {
		// Perform OCR on the entire PDF
		const ocrResult = await performDirectPdfOcr(pdfUrl, {
			contentHint: "UPSC essay answer sheets with handwritten content",
		});

		console.log(
			`[OCR] Completed - ${ocrResult.wordCount} words in ${ocrResult.processingTimeMs}ms`
		);

		// Update progress
		await updateJobProgress(jobId, 1, 1);

		// Build results object
		const fullResults: OcrJobResults = {
			jobId,
			sourceKey,
			totalPages: 1, // Treated as single document
			pages: [
				{
					pageNumber: 1,
					text: ocrResult.text,
					confidence: ocrResult.confidence,
					wordCount: ocrResult.wordCount,
					hasHandwriting: true,
					processingTimeMs: ocrResult.processingTimeMs,
				},
			],
			combinedText: ocrResult.text,
			totalWordCount: ocrResult.wordCount,
			averageConfidence: ocrResult.confidence,
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
			await updateAssetStatus(
				assetId,
				"ocr_completed",
				fullResults.totalWordCount,
				jobId,
				autoExtract,
				requestUrl
			);
		}

		// Mark job as completed
		await completeJob(jobId);
		console.log(`[OCR] Job ${jobId} completed successfully`);
	} catch (error) {
		console.error(`[OCR] Job ${jobId} failed:`, error);

		// Update asset status to failed
		if (assetId) {
			await updateAssetStatus(
				assetId,
				"ocr_failed",
				undefined,
				undefined,
				undefined,
				undefined,
				error instanceof Error ? error.message : "OCR failed"
			);
		}

		throw error;
	}
}

/**
 * Helper to update asset status in Convex.
 */
async function updateAssetStatus(
	assetId: string,
	status: "ocr_completed" | "ocr_failed" | "extraction_queued",
	wordCount?: number,
	ocrJobId?: string,
	autoExtract?: boolean,
	requestUrl?: string,
	errorMessage?: string
) {
	try {
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			return;
		}

		const { ConvexHttpClient } = await import("convex/browser");
		const { api } = await import("@/convex/_generated/api");
		const convex = new ConvexHttpClient(convexUrl);

		// Update status
		await convex.mutation(api.assets.updateStatus, {
			id: assetId as never,
			status,
			ocrWordCount: wordCount,
			ocrJobId,
			lastError: errorMessage,
		});

		console.log(`[OCR] Updated asset ${assetId} status to ${status}`);

		// Trigger extraction if autoExtract is enabled and OCR completed
		if (autoExtract && status === "ocr_completed" && requestUrl && ocrJobId) {
			const baseUrl = new URL(requestUrl).origin;

			// Update to extraction_queued first
			await convex.mutation(api.assets.updateStatus, {
				id: assetId as never,
				status: "extraction_queued",
			});

			// Trigger extraction
			fetch(`${baseUrl}/api/extract`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					ocrJobId,
					assetId,
				}),
			}).catch((err) => {
				console.error(
					`[OCR] Failed to trigger auto-extraction for asset ${assetId}:`,
					err
				);
			});

			console.log(`[OCR] Auto-extraction triggered for asset ${assetId}`);
		}
	} catch (err) {
		console.error(`[OCR] Failed to update asset ${assetId}:`, err);
	}
}
