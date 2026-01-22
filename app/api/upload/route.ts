/**
 * API route for file uploads.
 * Supports both direct upload (small files) and returns signed URL for large files.
 *
 * For large files (>10MB), clients should use /api/storage/upload-url for direct R2 upload.
 */

import { type NextRequest, NextResponse } from "next/server";
import {
	ALLOWED_FILE_TYPES_DISPLAY,
	formatFileSize,
	isAllowedMimeType,
	MAX_FILE_SIZE_BYTES,
	MAX_FILE_SIZE_DISPLAY,
	MIME_TO_SOURCE_TYPE,
} from "@/lib/constants/upload";
import {
	generateProjectFileKey,
	uploadToR2,
	validateR2Config,
} from "@/lib/storage";

/**
 * Response type for successful upload
 */
export interface UploadResponse {
	/** R2 key for the uploaded file */
	key: string;
	/** Public URL or signed URL for accessing the file */
	url: string;
	/** Original filename */
	filename: string;
	/** File size in bytes */
	size: number;
	/** Human-readable file size */
	sizeFormatted: string;
	/** MIME type */
	type: string;
	/** Content source type for the project */
	sourceType: "pdf" | "image";
}

/** Threshold for recommending direct R2 upload (10MB) */
const DIRECT_UPLOAD_THRESHOLD = 10 * 1024 * 1024;

/**
 * POST /api/upload
 * Handles file uploads to R2 storage.
 *
 * For files > 10MB, returns a recommendation to use direct R2 upload.
 *
 * Expects multipart form data with:
 * - file: The file to upload (required)
 * - projectId: The project ID to associate the file with (optional, used for path organization)
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
					hint: "Please set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME",
				},
				{ status: 503 }
			);
		}

		const formData = await request.formData();
		const file = formData.get("file") as File | null;
		const projectId = formData.get("projectId") as string | null;

		// Validate file presence
		if (!file) {
			return NextResponse.json({ error: "No file provided" }, { status: 400 });
		}

		// Validate file type
		if (!isAllowedMimeType(file.type)) {
			return NextResponse.json(
				{
					error: `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_FILE_TYPES_DISPLAY}`,
				},
				{ status: 400 }
			);
		}

		// Validate file size
		if (file.size > MAX_FILE_SIZE_BYTES) {
			return NextResponse.json(
				{
					error: `File too large: ${formatFileSize(file.size)}. Maximum size: ${MAX_FILE_SIZE_DISPLAY}`,
				},
				{ status: 400 }
			);
		}

		// Validate file has content
		if (file.size === 0) {
			return NextResponse.json({ error: "File is empty" }, { status: 400 });
		}

		// For large files, recommend using direct R2 upload
		if (file.size > DIRECT_UPLOAD_THRESHOLD) {
			return NextResponse.json(
				{
					error: "File too large for server upload",
					hint: "Use /api/storage/upload-url for direct R2 upload with progress tracking",
					threshold: DIRECT_UPLOAD_THRESHOLD,
					fileSize: file.size,
				},
				{ status: 413 }
			);
		}

		// Generate R2 key
		const resolvedProjectId = projectId ?? "unassigned";
		const key = generateProjectFileKey(resolvedProjectId, file.name);

		// Upload to R2
		const buffer = Buffer.from(await file.arrayBuffer());
		await uploadToR2(key, buffer, file.type, {
			originalFilename: file.name,
			projectId: resolvedProjectId,
			uploadedAt: new Date().toISOString(),
		});

		const response: UploadResponse = {
			key,
			url: key, // For R2, we use the key; clients should use /api/storage/read-url to get signed URL
			filename: file.name,
			size: file.size,
			sizeFormatted: formatFileSize(file.size),
			type: file.type,
			sourceType: MIME_TO_SOURCE_TYPE[file.type],
		};

		return NextResponse.json(response, { status: 201 });
	} catch (error) {
		console.error("Upload failed:", error);

		// Check for R2 configuration errors
		if (
			error instanceof Error &&
			error.message.includes("R2 configuration missing")
		) {
			return NextResponse.json(
				{
					error: "Storage not configured",
					hint: "Please set R2 environment variables",
				},
				{ status: 503 }
			);
		}

		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}
