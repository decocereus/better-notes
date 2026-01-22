/**
 * Cloudflare R2 storage client using S3-compatible API.
 * R2 provides better performance and cost for large files compared to Vercel Blob.
 */

import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

/**
 * Validates that R2 environment variables are configured.
 */
export function validateR2Config(): {
	valid: boolean;
	missing: string[];
} {
	const required = [
		"R2_ENDPOINT",
		"R2_ACCESS_KEY_ID",
		"R2_SECRET_ACCESS_KEY",
		"R2_BUCKET_NAME",
	] as const;

	const missing = required.filter((key) => !env[key]);

	return {
		valid: missing.length === 0,
		missing,
	};
}

/**
 * Creates an S3 client configured for Cloudflare R2.
 * Lazily initialized to avoid errors when env vars are not set.
 */
function createR2Client(): S3Client {
	const { valid, missing } = validateR2Config();

	if (!valid) {
		throw new Error(
			`R2 configuration missing: ${missing.join(", ")}. ` +
				"Please set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME."
		);
	}

	return new S3Client({
		region: "auto",
		endpoint: env.R2_ENDPOINT,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		},
	});
}

// Lazy singleton for the R2 client
let _r2Client: S3Client | null = null;

/**
 * Gets the R2 client instance (lazy initialization).
 */
export function getR2Client(): S3Client {
	if (!_r2Client) {
		_r2Client = createR2Client();
	}
	return _r2Client;
}

/**
 * Gets the configured R2 bucket name.
 */
export function getR2BucketName(): string {
	if (!env.R2_BUCKET_NAME) {
		throw new Error("R2_BUCKET_NAME environment variable is not set");
	}
	return env.R2_BUCKET_NAME;
}

/**
 * Uploads a file to R2.
 */
export async function uploadToR2(
	key: string,
	body: Buffer | Uint8Array | ReadableStream,
	contentType: string,
	metadata?: Record<string, string>
): Promise<{ key: string; size?: number }> {
	const client = getR2Client();
	const bucket = getR2BucketName();

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		Body: body,
		ContentType: contentType,
		Metadata: metadata,
	});

	await client.send(command);

	return { key };
}

/**
 * Downloads a file from R2.
 */
export async function downloadFromR2(
	key: string
): Promise<{ body: ReadableStream; contentType?: string; size?: number }> {
	const client = getR2Client();
	const bucket = getR2BucketName();

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
	});

	const response = await client.send(command);

	if (!response.Body) {
		throw new Error(`File not found: ${key}`);
	}

	return {
		body: response.Body as ReadableStream,
		contentType: response.ContentType,
		size: response.ContentLength,
	};
}

/**
 * Gets metadata for a file in R2 without downloading it.
 */
export async function getR2FileInfo(key: string): Promise<{
	exists: boolean;
	contentType?: string;
	size?: number;
	lastModified?: Date;
}> {
	const client = getR2Client();
	const bucket = getR2BucketName();

	try {
		const command = new HeadObjectCommand({
			Bucket: bucket,
			Key: key,
		});

		const response = await client.send(command);

		return {
			exists: true,
			contentType: response.ContentType,
			size: response.ContentLength,
			lastModified: response.LastModified,
		};
	} catch (error) {
		// Check if it's a "not found" error
		if (
			error instanceof Error &&
			(error.name === "NotFound" || error.name === "NoSuchKey")
		) {
			return { exists: false };
		}
		throw error;
	}
}

/**
 * Deletes a file from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
	const client = getR2Client();
	const bucket = getR2BucketName();

	const command = new DeleteObjectCommand({
		Bucket: bucket,
		Key: key,
	});

	await client.send(command);
}

/**
 * Lists files in R2 with a given prefix.
 */
export async function listR2Files(
	prefix: string,
	maxKeys = 100
): Promise<{ key: string; size?: number; lastModified?: Date }[]> {
	const client = getR2Client();
	const bucket = getR2BucketName();

	const command = new ListObjectsV2Command({
		Bucket: bucket,
		Prefix: prefix,
		MaxKeys: maxKeys,
	});

	const response = await client.send(command);

	return (response.Contents ?? []).map((item) => ({
		key: item.Key ?? "",
		size: item.Size,
		lastModified: item.LastModified,
	}));
}

/**
 * Generates a key for storing project files.
 */
export function generateProjectFileKey(
	projectId: string,
	filename: string
): string {
	const timestamp = Date.now();
	const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
	return `projects/${projectId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Generates a key for storing processing results.
 */
export function generateProcessingResultKey(
	jobId: string,
	resultType: string
): string {
	return `processing/${jobId}/${resultType}.json`;
}
