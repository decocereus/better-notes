import { put } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";
import {
	ALLOWED_FILE_TYPES_DISPLAY,
	formatFileSize,
	isAllowedMimeType,
	MAX_FILE_SIZE_BYTES,
	MAX_FILE_SIZE_DISPLAY,
	MIME_TO_SOURCE_TYPE,
} from "@/lib/constants/upload";

/**
 * Response type for successful upload
 */
export interface UploadResponse {
	url: string;
	filename: string;
	size: number;
	sizeFormatted: string;
	type: string;
	sourceType: "pdf" | "image";
}

/**
 * POST /api/upload
 * Handles file uploads to Vercel Blob storage.
 *
 * Expects multipart form data with:
 * - file: The file to upload (required)
 * - projectId: The project ID to associate the file with (optional, used for path organization)
 */
export async function POST(request: NextRequest) {
	try {
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

		// Create a safe filename
		const timestamp = Date.now();
		const safeFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
		const blobPath = projectId
			? `projects/${projectId}/${timestamp}-${safeFilename}`
			: `uploads/${timestamp}-${safeFilename}`;

		// Upload to Vercel Blob
		const blob = await put(blobPath, file, {
			access: "public",
			contentType: file.type,
		});

		const response: UploadResponse = {
			url: blob.url,
			filename: file.name,
			size: file.size,
			sizeFormatted: formatFileSize(file.size),
			type: file.type,
			sourceType: MIME_TO_SOURCE_TYPE[file.type],
		};

		return NextResponse.json(response, { status: 201 });
	} catch (error) {
		console.error("Upload failed:", error);

		// Check for specific Vercel Blob errors
		if (
			error instanceof Error &&
			error.message.includes("BLOB_READ_WRITE_TOKEN")
		) {
			return NextResponse.json(
				{
					error:
						"Storage not configured. Please set BLOB_READ_WRITE_TOKEN environment variable.",
				},
				{ status: 500 }
			);
		}

		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}
