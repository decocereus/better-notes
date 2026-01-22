/**
 * API route to get a signed read URL for accessing files from R2.
 * Supports inline viewing and download modes.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
	getDownloadUrl,
	getInlineViewUrl,
	getR2FileInfo,
	getReadUrl,
	type ReadUrlResult,
	validateR2Config,
} from "@/lib/storage";

/**
 * Request body for getting a read URL.
 */
interface ReadUrlRequest {
	/** R2 key of the file */
	key: string;
	/** Mode: 'inline' for browser viewing, 'download' for download dialog */
	mode?: "inline" | "download" | "raw";
	/** Optional filename for Content-Disposition header */
	filename?: string;
	/** Optional expiration time in seconds (default: 1 hour) */
	expiresIn?: number;
}

/**
 * Gets the appropriate signed URL based on the requested mode.
 */
function getUrlForMode(
	mode: "inline" | "download" | "raw",
	key: string,
	filename: string,
	expiresIn: number
): Promise<ReadUrlResult> {
	if (mode === "inline") {
		return getInlineViewUrl(key, filename, expiresIn);
	}
	if (mode === "download") {
		return getDownloadUrl(key, filename, expiresIn);
	}
	return getReadUrl({ key, expiresIn });
}

/**
 * POST /api/storage/read-url
 * Returns a signed URL for reading a file from R2.
 */
export async function POST(request: NextRequest) {
	try {
		// Validate R2 configuration
		const { valid, missing } = validateR2Config();
		if (!valid) {
			return NextResponse.json(
				{
					error: "R2 storage not configured",
					details: `Missing: ${missing.join(", ")}`,
				},
				{ status: 503 }
			);
		}

		// Parse request body
		const body = (await request.json()) as ReadUrlRequest;
		const { key, mode = "raw", filename, expiresIn = 3600 } = body;

		// Validate required fields
		if (!key) {
			return NextResponse.json(
				{ error: "Missing required field: key" },
				{ status: 400 }
			);
		}

		// Check if file exists
		const fileInfo = await getR2FileInfo(key);
		if (!fileInfo.exists) {
			return NextResponse.json(
				{ error: "File not found", key },
				{ status: 404 }
			);
		}

		// Generate the appropriate URL based on mode
		const resolvedFilename = filename ?? key.split("/").pop() ?? "file";
		const result = await getUrlForMode(mode, key, resolvedFilename, expiresIn);

		return NextResponse.json({
			readUrl: result.readUrl,
			key: result.key,
			expiresAt: result.expiresAt.toISOString(),
			contentType: fileInfo.contentType,
			size: fileInfo.size,
		});
	} catch (error) {
		console.error("Error generating read URL:", error);
		return NextResponse.json(
			{ error: "Failed to generate read URL" },
			{ status: 500 }
		);
	}
}
