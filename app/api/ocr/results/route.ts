/**
 * OCR Results API
 *
 * GET /api/ocr/results?assetId={assetId}&page={pageNumber}
 *   Returns single page OCR result
 *
 * GET /api/ocr/results?assetId={assetId}&format=combined
 *   Returns combined text from all pages (for extraction pipeline)
 *
 * GET /api/ocr/results?assetId={assetId}
 *   Returns all page results with metadata
 */

import { type NextRequest, NextResponse } from "next/server";
import { calculateQualityMetrics } from "@/lib/ai/retry-logic";
import {
	getAllOcrResults,
	getCombinedOcrResults,
	getPageOcrResult,
} from "@/lib/storage/ocr-results";

/**
 * Handles single page result request.
 */
async function handleSinglePageRequest(assetId: string, pageParam: string) {
	const pageNumber = Number.parseInt(pageParam, 10);
	if (Number.isNaN(pageNumber)) {
		return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
	}

	const result = await getPageOcrResult(assetId, pageNumber);
	if (!result) {
		return NextResponse.json(
			{ error: "Page result not found" },
			{ status: 404 }
		);
	}

	return NextResponse.json({ assetId, page: result });
}

/**
 * Handles combined text format request.
 */
async function handleCombinedRequest(assetId: string) {
	const combined = await getCombinedOcrResults(assetId);
	if (!combined) {
		return NextResponse.json(
			{ error: "No OCR results found" },
			{ status: 404 }
		);
	}

	return new NextResponse(combined.combinedText, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"X-Total-Pages": String(combined.totalPages),
			"X-Total-Words": String(combined.totalWordCount),
			"X-Average-Confidence": String(combined.averageConfidence.toFixed(2)),
		},
	});
}

/**
 * Handles full results with metadata request.
 */
async function handleFullResultsRequest(assetId: string) {
	const results = await getAllOcrResults(assetId);
	if (results.length === 0) {
		return NextResponse.json(
			{ error: "No OCR results found" },
			{ status: 404 }
		);
	}

	const metrics = calculateQualityMetrics(results);
	const combined = await getCombinedOcrResults(assetId);

	return NextResponse.json({
		assetId,
		totalPages: results.length,
		totalWordCount: combined?.totalWordCount ?? 0,
		averageConfidence: combined?.averageConfidence ?? 0,
		retriedCount: combined?.retriedCount ?? 0,
		processedAt: combined?.processedAt,
		qualityMetrics: metrics,
		pages: results,
	});
}

/**
 * GET /api/ocr/results
 * Gets OCR results for an asset.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const assetId = searchParams.get("assetId");
	const pageParam = searchParams.get("page");
	const format = searchParams.get("format");

	if (!assetId) {
		return NextResponse.json({ error: "assetId is required" }, { status: 400 });
	}

	try {
		if (pageParam) {
			return await handleSinglePageRequest(assetId, pageParam);
		}

		if (format === "combined") {
			return await handleCombinedRequest(assetId);
		}

		return await handleFullResultsRequest(assetId);
	} catch (error) {
		console.error("Failed to get OCR results:", error);
		return NextResponse.json(
			{
				error: "Failed to get OCR results",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
