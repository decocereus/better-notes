/**
 * Upload-related constants for file handling.
 * All uploads go directly to R2 storage.
 */

/**
 * Allowed MIME types for file uploads
 */
export const ALLOWED_MIME_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Human-readable file type names for error messages
 */
export const ALLOWED_FILE_TYPES_DISPLAY = "PDF, PNG, JPEG, or WebP";

/**
 * Maximum file size in bytes (500MB) - R2 direct upload limit
 */
export const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

/**
 * Maximum file size in human-readable format
 */
export const MAX_FILE_SIZE_DISPLAY = "500MB";

/**
 * Map MIME type to ContentSourceType
 */
export const MIME_TO_SOURCE_TYPE: Record<AllowedMimeType, "pdf" | "image"> = {
	"application/pdf": "pdf",
	"image/png": "image",
	"image/jpeg": "image",
	"image/webp": "image",
};

/**
 * Check if a MIME type is allowed
 */
export function isAllowedMimeType(
	mimeType: string
): mimeType is AllowedMimeType {
	return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * Format bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) {
		return "0 Bytes";
	}

	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}
