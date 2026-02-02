/**
 * API route for listing and creating assets.
 *
 * GET: List assets with filters
 * POST: Create a new asset record (called after R2 upload)
 */

import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createLogger } from "@/lib/utils/logger";
import type { ExtractionParameters } from "@/types/extraction";

const log = createLogger("api/assets");

interface CreateAssetBody {
	key: string;
	filename: string;
	size: number;
	mimeType: string;
	projectId?: string;
	autoProcess?: boolean;
	parameters?: ExtractionParameters;
	modelConfig?: Record<string, string>;
}

/**
 * GET /api/assets
 * List assets with optional filters.
 */
export async function GET(request: NextRequest) {
	try {
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 }
			);
		}

		const convex = new ConvexHttpClient(convexUrl);

		const { searchParams } = new URL(request.url);
		const projectId = searchParams.get("projectId");
		const status = searchParams.get("status");
		const unassignedOnly = searchParams.get("unassignedOnly") === "true";

		// Valid status values
		const validStatuses = [
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
		] as const;

		type Status = (typeof validStatuses)[number];

		// Build query args
		const args: {
			projectId?: Id<"projects">;
			status?: Status;
			unassignedOnly?: boolean;
		} = {};

		if (projectId) {
			args.projectId = projectId as Id<"projects">;
		}
		if (status && validStatuses.includes(status as Status)) {
			args.status = status as Status;
		}
		if (unassignedOnly) {
			args.unassignedOnly = true;
		}

		const [assets, stats] = await Promise.all([
			convex.query(api.assets.list, args),
			convex.query(api.assets.getStats, {}),
		]);

		return NextResponse.json({ assets, stats });
	} catch (error) {
		log.error("Failed to list assets:", error);
		return NextResponse.json(
			{
				error: error instanceof Error ? error.message : "Failed to list assets",
			},
			{ status: 500 }
		);
	}
}

/**
 * POST /api/assets
 * Create a new asset record after R2 upload.
 */
export async function POST(request: NextRequest) {
	try {
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 }
			);
		}

		const convex = new ConvexHttpClient(convexUrl);

		const body = (await request.json()) as CreateAssetBody;
		const {
			key,
			filename,
			size,
			mimeType,
			projectId,
			autoProcess,
			parameters,
			modelConfig,
		} = body;

		if (!(key && filename && size && mimeType)) {
			return NextResponse.json(
				{ error: "Missing required fields: key, filename, size, mimeType" },
				{ status: 400 }
			);
		}

		// Determine source type from mime type
		const sourceType = mimeType === "application/pdf" ? "pdf" : "image";

		// Create the asset record
		const assetId = await convex.mutation(api.assets.create, {
			key,
			filename,
			size,
			mimeType,
			sourceType,
			projectId: projectId ? (projectId as Id<"projects">) : undefined,
		});

		log.info(`Created asset: ${assetId} for file ${filename}`);

		// If autoProcess is enabled and it's a PDF, trigger the processing pipeline
		if (autoProcess && sourceType === "pdf") {
			// Trigger processing in the background via the process endpoint
			const processUrl = new URL(`/api/assets/${assetId}/process`, request.url);
			fetch(processUrl.toString(), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ parameters, modelConfig }),
			}).catch((err) => {
				log.error(
					`Failed to trigger auto-processing for asset ${assetId}:`,
					err
				);
			});

			log.info(`Auto-processing triggered for asset ${assetId}`);
		}

		return NextResponse.json({
			assetId,
			autoProcessing: autoProcess && sourceType === "pdf",
		});
	} catch (error) {
		log.error("Failed to create asset:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to create asset",
			},
			{ status: 500 }
		);
	}
}
