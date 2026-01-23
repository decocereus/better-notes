/**
 * Types for file uploads.
 */

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
