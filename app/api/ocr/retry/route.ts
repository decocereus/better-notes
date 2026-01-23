/**
 * OCR Retry API
 *
 * POST /api/ocr/retry
 * Retries OCR on specific pages or all low-confidence pages using Claude.
 *
 * Body: { assetId: string, pageNumbers?: number[] }
 */

import { type NextRequest, NextResponse } from "next/server";
import { validateOcrModelConfig } from "@/lib/ai/models";
import { findLowConfidencePages, retryPagesWithClaude } from "@/lib/ai/ocr";
import { getCombinedOcrResults } from "@/lib/storage/ocr-results";

interface RetryRequest {
	assetId: string;
	pageNumbers?: number[];
}

/**
 * Updates asset status in Convex.
 */
async function updateAssetOcrWordCount(assetId: string, wordCount: number) {
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
			status: "ocr_completed" as never,
			ocrWordCount: wordCount,
		});
	} catch (err) {
		console.error(`[OCR] Failed to update asset ${assetId}:`, err);
	}
}

/**
 * POST /api/ocr/retry
 * Retries OCR on specific pages with Claude Sonnet.
 */
export async function POST(request: NextRequest) {
	try {
		// Check Claude is available
		const config = validateOcrModelConfig();
		if (!config.claudeAvailable) {
			return NextResponse.json(
				{
					error: "Claude not configured",
					details: "ANTHROPIC_API_KEY is required for retry",
				},
				{ status: 503 }
			);
		}

		// Parse request
		const body = (await request.json()) as RetryRequest;
		const { assetId, pageNumbers } = body;

		if (!assetId) {
			return NextResponse.json(
				{ error: "assetId is required" },
				{ status: 400 }
			);
		}

		// Get pages to retry
		let pagesToRetry: number[];

		if (pageNumbers && pageNumbers.length > 0) {
			// Use specified pages
			pagesToRetry = pageNumbers;
		} else {
			// Find all low-confidence pages
			const lowConfidencePages = await findLowConfidencePages(assetId);
			pagesToRetry = lowConfidencePages.map((p) => p.pageNumber);
		}

		if (pagesToRetry.length === 0) {
			return NextResponse.json({
				assetId,
				message: "No pages need retry",
				pagesRetried: 0,
			});
		}

		console.log(
			`[OCR] Retrying ${pagesToRetry.length} pages for asset ${assetId}`
		);

		// Run retry
		const result = await retryPagesWithClaude(
			assetId,
			pagesToRetry,
			{ contentHint: "UPSC essay answer sheets with handwritten content" },
			(processed, total) => {
				console.log(`[OCR] Retry progress: ${processed}/${total}`);
			}
		);

		// Update word count
		const combinedResults = await getCombinedOcrResults(assetId);
		if (combinedResults) {
			await updateAssetOcrWordCount(assetId, combinedResults.totalWordCount);
		}

		return NextResponse.json({
			assetId,
			success: result.success,
			pagesRetried: result.pagesRetried,
			errors: result.errors,
		});
	} catch (error) {
		console.error("Failed to retry OCR:", error);
		return NextResponse.json(
			{
				error: "Failed to retry OCR",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
