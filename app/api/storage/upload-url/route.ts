/**
 * API route to get a signed upload URL for direct browser-to-R2 uploads.
 * This enables large file uploads without passing through the server.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
	generateProjectFileKey,
	getUploadUrl,
	validateR2Config,
} from "@/lib/storage";

/**
 * Request body for getting an upload URL.
 */
interface UploadUrlRequest {
	/** Original filename */
	filename: string;
	/** MIME type of the file */
	contentType: string;
	/** Project ID to associate the file with */
	projectId: string;
	/** Optional file size in bytes (for validation) */
	fileSize?: number;
}

/** Maximum file size: 500MB */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

/** Allowed MIME types for upload */
const ALLOWED_MIME_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/gif",
];

/**
 * POST /api/storage/upload-url
 * Returns a signed URL for uploading a file directly to R2.
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
		const body = (await request.json()) as UploadUrlRequest;
		const { filename, contentType, projectId, fileSize } = body;

		// Validate required fields
		if (!(filename && contentType && projectId)) {
			return NextResponse.json(
				{ error: "Missing required fields: filename, contentType, projectId" },
				{ status: 400 }
			);
		}

		// Validate content type
		if (!ALLOWED_MIME_TYPES.includes(contentType)) {
			return NextResponse.json(
				{
					error: "Invalid file type",
					allowed: ALLOWED_MIME_TYPES,
				},
				{ status: 400 }
			);
		}

		// Validate file size if provided
		if (fileSize && fileSize > MAX_FILE_SIZE) {
			return NextResponse.json(
				{
					error: "File too large",
					maxSize: MAX_FILE_SIZE,
					maxSizeFormatted: "500MB",
				},
				{ status: 400 }
			);
		}

		// Generate R2 key
		const key = generateProjectFileKey(projectId, filename);

		// Get signed upload URL
		const result = await getUploadUrl({
			key,
			contentType,
			expiresIn: 3600, // 1 hour
			metadata: {
				originalFilename: filename,
				projectId,
				uploadedAt: new Date().toISOString(),
			},
		});

		return NextResponse.json({
			uploadUrl: result.uploadUrl,
			key: result.key,
			expiresAt: result.expiresAt.toISOString(),
		});
	} catch (error) {
		console.error("Error generating upload URL:", error);
		return NextResponse.json(
			{ error: "Failed to generate upload URL" },
			{ status: 500 }
		);
	}
}
