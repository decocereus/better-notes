/**
 * API route for triggering asset processing pipeline.
 *
 * POST: Start OCR → Extraction pipeline for an asset
 */

import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api/assets/[id]/process");

interface RouteContext {
	params: Promise<{ id: string }>;
}

/**
 * POST /api/assets/[id]/process
 * Trigger the processing pipeline (OCR → Extraction) for an asset.
 */
export async function POST(request: NextRequest, context: RouteContext) {
	try {
		const { id: assetId } = await context.params;

		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 }
			);
		}

		const convex = new ConvexHttpClient(convexUrl);

		// Get the asset
		const asset = await convex.query(api.assets.get, {
			id: assetId as Id<"assets">,
		});

		if (!asset) {
			return NextResponse.json({ error: "Asset not found" }, { status: 404 });
		}

		// Only process PDFs
		if (asset.sourceType !== "pdf") {
			return NextResponse.json(
				{ error: "Only PDF assets can be processed" },
				{ status: 400 }
			);
		}

		// Check if already processing
		if (
			asset.processingStatus === "ocr_processing" ||
			asset.processingStatus === "extraction_processing"
		) {
			return NextResponse.json(
				{ error: "Asset is already being processed" },
				{ status: 400 }
			);
		}

		// Update status to OCR queued
		await convex.mutation(api.assets.updateStatus, {
			id: assetId as Id<"assets">,
			status: "ocr_queued",
		});

		log.info(`Starting processing pipeline for asset ${assetId}`);

		// Start OCR processing with autoExtract and assetId
		const baseUrl = new URL(request.url).origin;
		const ocrResponse = await fetch(`${baseUrl}/api/ocr`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				sourceKey: asset.key,
				projectId: asset.projectId,
				assetId,
				autoExtract: true, // Automatically trigger extraction after OCR
			}),
		});

		if (!ocrResponse.ok) {
			const errorData = await ocrResponse.json();
			await convex.mutation(api.assets.updateStatus, {
				id: assetId as Id<"assets">,
				status: "ocr_failed",
				lastError: errorData.error || "Failed to start OCR",
			});
			return NextResponse.json(
				{ error: errorData.error || "Failed to start OCR" },
				{ status: 500 }
			);
		}

		const ocrData = await ocrResponse.json();

		// Update asset with OCR job ID
		await convex.mutation(api.assets.updateStatus, {
			id: assetId as Id<"assets">,
			status: "ocr_processing",
			ocrJobId: ocrData.jobId,
		});

		log.info(`OCR job ${ocrData.jobId} started for asset ${assetId}`);

		return NextResponse.json({
			success: true,
			assetId,
			ocrJobId: ocrData.jobId,
			status: "ocr_processing",
		});
	} catch (error) {
		log.error("Failed to start processing:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to start processing",
			},
			{ status: 500 }
		);
	}
}
