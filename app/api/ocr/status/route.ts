/**
 * OCR Pipeline Status API
 *
 * GET /api/ocr/status?assetId={assetId}
 * Returns the current status of the OCR pipeline for an asset.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getOcrStatus } from "@/lib/storage/ocr-results";
import { getConversionStatus } from "@/lib/storage/page-images";
import type {
	ConversionStatus,
	OcrPipelineProgress,
	OcrStatus,
} from "@/types/ocr";

/**
 * Determines the overall pipeline phase from conversion and OCR status.
 */
function determinePhase(
	conversionStatus: ConversionStatus | null,
	ocrStatus: OcrStatus | null
): OcrPipelineProgress["phase"] {
	if (!conversionStatus) {
		return "conversion";
	}
	if (conversionStatus.status === "failed") {
		return "failed";
	}
	if (conversionStatus.status !== "completed") {
		return "conversion";
	}

	// Conversion is completed, check OCR status
	if (!ocrStatus) {
		return "ocr";
	}
	if (ocrStatus.status === "failed") {
		return "failed";
	}
	if (ocrStatus.status === "retrying") {
		return "retry";
	}
	if (ocrStatus.status === "completed") {
		return "completed";
	}
	return "ocr";
}

/**
 * GET /api/ocr/status
 * Gets the status of the OCR pipeline for an asset.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const assetId = searchParams.get("assetId");

	if (!assetId) {
		return NextResponse.json({ error: "assetId is required" }, { status: 400 });
	}

	try {
		// Get both conversion and OCR status
		const [conversionStatus, ocrStatus] = await Promise.all([
			getConversionStatus(assetId),
			getOcrStatus(assetId),
		]);

		const phase = determinePhase(conversionStatus, ocrStatus);

		const progress: OcrPipelineProgress = {
			phase,
			conversionProgress: conversionStatus
				? {
						pagesProcessed: conversionStatus.pagesProcessed,
						totalPages: conversionStatus.totalPages,
					}
				: undefined,
			ocrProgress: ocrStatus
				? {
						pagesProcessed: ocrStatus.pagesProcessed,
						totalPages: ocrStatus.totalPages,
					}
				: undefined,
			retryProgress: ocrStatus?.retriedCount
				? {
						pagesRetried: ocrStatus.retriedCount,
						totalToRetry: ocrStatus.retriedCount,
					}
				: undefined,
			error: conversionStatus?.error || ocrStatus?.error || undefined,
		};

		return NextResponse.json({
			assetId,
			progress,
			conversionStatus: conversionStatus || null,
			ocrStatus: ocrStatus || null,
		});
	} catch (error) {
		console.error("Failed to get OCR status:", error);
		return NextResponse.json(
			{
				error: "Failed to get OCR status",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
