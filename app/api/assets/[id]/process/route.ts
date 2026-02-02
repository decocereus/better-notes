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
import type { Asset, AssetProcessingStatus } from "@/types/asset";
import type { ExtractionParameters } from "@/types/extraction";

const log = createLogger("api/assets/[id]/process");

interface RouteContext {
	params: Promise<{ id: string }>;
}

const ASSET_STATUS_VALUES: AssetProcessingStatus[] = [
	"pending",
	"conversion_queued",
	"conversion_processing",
	"conversion_completed",
	"conversion_failed",
	"ocr_queued",
	"ocr_processing",
	"ocr_completed",
	"ocr_failed",
	"extraction_queued",
	"extraction_processing",
	"extraction_completed",
	"extraction_failed",
];

function isAssetProcessingStatus(
	value: string
): value is AssetProcessingStatus {
	return ASSET_STATUS_VALUES.includes(value as AssetProcessingStatus);
}

function getConvexClient(): ConvexHttpClient {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
	}
	return new ConvexHttpClient(convexUrl);
}

function getAssetProcessingError(asset: Asset): NextResponse | null {
	if (asset.sourceType !== "pdf") {
		return NextResponse.json(
			{ error: "Only PDF assets can be processed" },
			{ status: 400 }
		);
	}

	const isProcessing =
		asset.processingStatus === "ocr_processing" ||
		asset.processingStatus === "extraction_processing";
	const hasStaleError = Boolean(asset.lastError);
	if (isProcessing && !hasStaleError) {
		return NextResponse.json(
			{ error: "Asset is already being processed" },
			{ status: 400 }
		);
	}

	return null;
}

async function applyOcrResponseStatus({
	convex,
	assetId,
	ocrData,
}: {
	convex: ConvexHttpClient;
	assetId: string;
	ocrData: { jobId?: string; status?: string };
}): Promise<{ jobId: string | null; status: AssetProcessingStatus | null }> {
	const jobId =
		typeof ocrData.jobId === "string" && ocrData.jobId.length > 0
			? ocrData.jobId
			: null;
	let nextStatus: AssetProcessingStatus | null = null;
	if (
		typeof ocrData.status === "string" &&
		isAssetProcessingStatus(ocrData.status)
	) {
		nextStatus = ocrData.status;
	}

	if (jobId) {
		await convex.mutation(api.assets.updateStatus, {
			id: assetId as Id<"assets">,
			status: "ocr_processing",
			ocrJobId: jobId,
			lastError: "",
		});
	} else if (nextStatus) {
		await convex.mutation(api.assets.updateStatus, {
			id: assetId as Id<"assets">,
			status: nextStatus,
			lastError: "",
		});
	}

	return { jobId, status: nextStatus };
}

/**
 * POST /api/assets/[id]/process
 * Trigger the processing pipeline (OCR → Extraction) for an asset.
 */
export async function POST(request: NextRequest, context: RouteContext) {
	try {
		const { id: assetId } = await context.params;
		const body = (await request.json().catch(() => ({}))) as {
			parameters?: ExtractionParameters;
			modelConfig?: Record<string, string>;
		};
		const { parameters, modelConfig } = body;

		const convex = getConvexClient();

		// Get the asset
		const asset = await convex.query(api.assets.get, {
			id: assetId as Id<"assets">,
		});

		if (!asset) {
			return NextResponse.json({ error: "Asset not found" }, { status: 404 });
		}

		const assetError = getAssetProcessingError(asset);
		if (assetError) {
			return assetError;
		}

		// Update status to OCR queued
		await convex.mutation(api.assets.updateStatus, {
			id: assetId as Id<"assets">,
			status: "ocr_queued",
			lastError: "",
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
				parameters,
				modelConfig,
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

		const jobLabel =
			typeof ocrData.jobId === "string" && ocrData.jobId.length > 0
				? `OCR job ${ocrData.jobId}`
				: `OCR pipeline (${ocrData.status ?? "started"})`;
		const { jobId, status } = await applyOcrResponseStatus({
			convex,
			assetId,
			ocrData,
		});

		log.info(`${jobLabel} started for asset ${assetId}`);

		return NextResponse.json({
			success: true,
			assetId,
			ocrJobId: jobId,
			status: status ?? "ocr_processing",
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
