/**
 * OCR Pipeline Start API
 *
 * POST /api/ocr/start
 * Triggers the PDF-to-images conversion and OCR pipeline.
 *
 * Body: { assetId: string, sourceKey: string, autoExtract?: boolean }
 * Returns: { jobId: string, status: string }
 */

import { type NextRequest, NextResponse } from "next/server";
import { validateOcrModelConfig } from "@/lib/ai/models";
import { runOcrPipeline } from "@/lib/ai/ocr";
import {
	convertPdfToImages,
	validateConverterConfig,
} from "@/lib/services/pdf-conversion";
import { validateR2Config } from "@/lib/storage/r2-client";
import type { StartOcrPipelineInput } from "@/types/ocr";

/**
 * Updates asset status in Convex.
 */
async function updateAssetStatus(
	assetId: string,
	status: string,
	additionalFields?: Record<string, unknown>
) {
	try {
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			return;
		}

		const { ConvexHttpClient } = await import("convex/browser");
		const { api } = await import("@/convex/_generated/api");
		const convex = new ConvexHttpClient(convexUrl);

		await convex.mutation(api.assets.updateStatus, {
			id: assetId as never,
			status: status as never,
			...additionalFields,
		});

		console.log(`[OCR] Updated asset ${assetId} status to ${status}`);
	} catch (err) {
		console.error(`[OCR] Failed to update asset ${assetId}:`, err);
	}
}

/**
 * Background function to run the full OCR pipeline.
 */
async function runFullPipeline(
	assetId: string,
	sourceKey: string,
	autoExtract: boolean,
	requestUrl: string
) {
	try {
		// Phase 1: Convert PDF to images
		console.log(`[OCR] Starting PDF conversion for asset ${assetId}`);
		await updateAssetStatus(assetId, "conversion_processing");

		const conversionResult = await convertPdfToImages(
			assetId,
			sourceKey,
			{ quality: 85, dpi: 150 },
			(converted, total) => {
				console.log(`[OCR] Conversion progress: ${converted}/${total}`);
			}
		);

		if (!conversionResult.success) {
			throw new Error(
				`Conversion failed: ${conversionResult.errors.join(", ")}`
			);
		}

		console.log(
			`[OCR] Conversion complete: ${conversionResult.totalPages} pages`
		);
		await updateAssetStatus(assetId, "conversion_completed");

		// Phase 2: Run OCR on page images
		console.log(`[OCR] Starting OCR for asset ${assetId}`);
		await updateAssetStatus(assetId, "ocr_processing");

		const ocrResult = await runOcrPipeline(
			assetId,
			{ contentHint: "UPSC essay answer sheets with handwritten content" },
			(phase, processed, total) => {
				console.log(`[OCR] ${phase} progress: ${processed}/${total}`);
			}
		);

		// Calculate total word count from results
		const { getCombinedOcrResults } = await import("@/lib/storage/ocr-results");
		const combinedResults = await getCombinedOcrResults(assetId);
		const totalWordCount = combinedResults?.totalWordCount ?? 0;

		if (!ocrResult.success) {
			console.warn(
				`[OCR] OCR completed with errors: ${ocrResult.errors.length}`
			);
		}

		console.log(
			`[OCR] OCR complete: ${ocrResult.totalPages} pages, ${ocrResult.retriedPages} retried`
		);
		await updateAssetStatus(assetId, "ocr_completed", {
			ocrWordCount: totalWordCount,
		});

		// Phase 3: Auto-extract if enabled
		if (autoExtract) {
			const baseUrl = new URL(requestUrl).origin;
			await updateAssetStatus(assetId, "extraction_queued");

			fetch(`${baseUrl}/api/extract`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ assetId }),
			}).catch((err) => {
				console.error(
					`[OCR] Failed to trigger auto-extraction for asset ${assetId}:`,
					err
				);
			});

			console.log(`[OCR] Auto-extraction triggered for asset ${assetId}`);
		}
	} catch (error) {
		console.error(`[OCR] Pipeline failed for asset ${assetId}:`, error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		await updateAssetStatus(assetId, "ocr_failed", {
			lastError: errorMessage,
		});
	}
}

/**
 * POST /api/ocr/start
 * Starts the OCR pipeline for an asset.
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

		const converterConfig = validateConverterConfig();
		if (!converterConfig.valid) {
			return NextResponse.json(
				{
					error: "PDF converter not configured",
					details: converterConfig.error,
				},
				{ status: 503 }
			);
		}

		const ocrConfig = validateOcrModelConfig();
		if (!(ocrConfig.geminiAvailable || ocrConfig.claudeAvailable)) {
			return NextResponse.json(
				{ error: ocrConfig.error || "No OCR model configured" },
				{ status: 503 }
			);
		}

		// Parse request
		const body = (await request.json()) as StartOcrPipelineInput;
		const { assetId, sourceKey, autoExtract = false } = body;

		if (!assetId) {
			return NextResponse.json(
				{ error: "assetId is required" },
				{ status: 400 }
			);
		}

		if (!sourceKey) {
			return NextResponse.json(
				{ error: "sourceKey is required" },
				{ status: 400 }
			);
		}

		// Update status to conversion_queued
		await updateAssetStatus(assetId, "conversion_queued");

		// Start pipeline in background
		runFullPipeline(assetId, sourceKey, autoExtract, request.url).catch(
			(error) => {
				console.error(`[OCR] Pipeline error for ${assetId}:`, error);
			}
		);

		return NextResponse.json(
			{
				assetId,
				status: "conversion_queued",
				message: "OCR pipeline started - converting PDF to images",
			},
			{ status: 202 }
		);
	} catch (error) {
		console.error("Failed to start OCR pipeline:", error);
		return NextResponse.json(
			{
				error: "Failed to start OCR pipeline",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
