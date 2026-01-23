/**
 * API route for individual asset operations.
 *
 * GET: Get asset with preview URL
 * PATCH: Update asset (assign to project)
 * DELETE: Delete asset from Convex + R2
 */

import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deleteFromR2, getReadUrl, validateR2Config } from "@/lib/storage";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api/assets/[id]");

interface RouteContext {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/assets/[id]
 * Get a single asset with preview URL and extraction results.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
	try {
		const { id } = await context.params;

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
			id: id as Id<"assets">,
		});

		if (!asset) {
			return NextResponse.json({ error: "Asset not found" }, { status: 404 });
		}

		// Generate preview URL
		let previewUrl: string | undefined;
		const r2Config = validateR2Config();
		if (r2Config.valid) {
			try {
				const { readUrl } = await getReadUrl({
					key: asset.key,
					expiresIn: 3600, // 1 hour
				});
				previewUrl = readUrl;
			} catch (err) {
				log.error(`Failed to generate preview URL for asset ${id}:`, err);
			}
		}

		// Get extraction results if available
		let extractionResult: Awaited<
			ReturnType<typeof convex.query<typeof api.extractionResults.getByAsset>>
		> | null = null;
		if (asset.processingStatus === "extraction_completed") {
			extractionResult = await convex.query(api.extractionResults.getByAsset, {
				assetId: id as Id<"assets">,
			});
		}

		return NextResponse.json({
			asset,
			previewUrl,
			extractionResult,
		});
	} catch (error) {
		log.error("Failed to get asset:", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to get asset" },
			{ status: 500 }
		);
	}
}

/**
 * PATCH /api/assets/[id]
 * Update an asset (assign/unassign to project).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
	try {
		const { id } = await context.params;

		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 }
			);
		}

		const convex = new ConvexHttpClient(convexUrl);

		const body = await request.json();
		const { projectId } = body as { projectId?: string | null };

		// Assign or unassign from project
		await convex.mutation(api.assets.assignToProject, {
			id: id as Id<"assets">,
			projectId: projectId ? (projectId as Id<"projects">) : undefined,
		});

		log.info(
			`Asset ${id} ${projectId ? `assigned to project ${projectId}` : "unassigned"}`
		);

		return NextResponse.json({ success: true });
	} catch (error) {
		log.error("Failed to update asset:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to update asset",
			},
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/assets/[id]
 * Delete an asset from Convex and R2.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
	try {
		const { id } = await context.params;

		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 }
			);
		}

		const convex = new ConvexHttpClient(convexUrl);

		// Delete from Convex (this also deletes extraction results)
		const { key } = await convex.mutation(api.assets.remove, {
			id: id as Id<"assets">,
		});

		// Delete from R2
		const r2Config = validateR2Config();
		if (r2Config.valid) {
			try {
				await deleteFromR2(key);
				log.info(`Deleted R2 file: ${key}`);
			} catch (err) {
				log.error(`Failed to delete R2 file ${key}:`, err);
				// Don't fail the request, asset is already removed from Convex
			}
		}

		log.info(`Deleted asset: ${id}`);

		return NextResponse.json({ success: true });
	} catch (error) {
		log.error("Failed to delete asset:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to delete asset",
			},
			{ status: 500 }
		);
	}
}
