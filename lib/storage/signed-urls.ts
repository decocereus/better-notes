/**
 * Signed URL utilities for R2 storage.
 * Enables direct browser uploads and secure file access.
 */

import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2BucketName, getR2Client } from "./r2-client";

/** Default expiration time for signed URLs (1 hour) */
const DEFAULT_EXPIRES_IN = 3600;

/** Maximum expiration time for signed URLs (7 days) */
const MAX_EXPIRES_IN = 604_800;

/**
 * Options for generating a signed upload URL.
 */
export interface UploadUrlOptions {
	/** R2 key (path) for the file */
	key: string;
	/** MIME type of the file */
	contentType: string;
	/** URL expiration time in seconds (default: 1 hour, max: 7 days) */
	expiresIn?: number;
	/** Optional file size limit in bytes */
	maxSize?: number;
	/** Optional metadata to attach to the file */
	metadata?: Record<string, string>;
}

/**
 * Options for generating a signed read URL.
 */
export interface ReadUrlOptions {
	/** R2 key (path) for the file */
	key: string;
	/** URL expiration time in seconds (default: 1 hour, max: 7 days) */
	expiresIn?: number;
	/** Optional: override the Content-Disposition header */
	responseContentDisposition?: string;
}

/**
 * Result of generating a signed upload URL.
 */
export interface UploadUrlResult {
	/** The signed URL for uploading */
	uploadUrl: string;
	/** The R2 key where the file will be stored */
	key: string;
	/** When the URL expires */
	expiresAt: Date;
}

/**
 * Result of generating a signed read URL.
 */
export interface ReadUrlResult {
	/** The signed URL for reading */
	readUrl: string;
	/** The R2 key of the file */
	key: string;
	/** When the URL expires */
	expiresAt: Date;
}

/**
 * Generates a signed URL for uploading a file directly from the browser to R2.
 * This enables large file uploads without passing through the server.
 */
export async function getUploadUrl(
	options: UploadUrlOptions
): Promise<UploadUrlResult> {
	const {
		key,
		contentType,
		expiresIn = DEFAULT_EXPIRES_IN,
		metadata,
	} = options;

	const client = getR2Client();
	const bucket = getR2BucketName();

	// Clamp expiration time
	const clampedExpiresIn = Math.min(Math.max(expiresIn, 60), MAX_EXPIRES_IN);

	const command = new PutObjectCommand({
		Bucket: bucket,
		Key: key,
		ContentType: contentType,
		Metadata: metadata,
	});

	const uploadUrl = await getSignedUrl(client, command, {
		expiresIn: clampedExpiresIn,
	});

	const expiresAt = new Date(Date.now() + clampedExpiresIn * 1000);

	return {
		uploadUrl,
		key,
		expiresAt,
	};
}

/**
 * Generates a signed URL for reading/downloading a file from R2.
 * Can be used to serve files to the browser without exposing the bucket publicly.
 */
export async function getReadUrl(
	options: ReadUrlOptions
): Promise<ReadUrlResult> {
	const {
		key,
		expiresIn = DEFAULT_EXPIRES_IN,
		responseContentDisposition,
	} = options;

	const client = getR2Client();
	const bucket = getR2BucketName();

	// Clamp expiration time
	const clampedExpiresIn = Math.min(Math.max(expiresIn, 60), MAX_EXPIRES_IN);

	const command = new GetObjectCommand({
		Bucket: bucket,
		Key: key,
		ResponseContentDisposition: responseContentDisposition,
	});

	const readUrl = await getSignedUrl(client, command, {
		expiresIn: clampedExpiresIn,
	});

	const expiresAt = new Date(Date.now() + clampedExpiresIn * 1000);

	return {
		readUrl,
		key,
		expiresAt,
	};
}

/**
 * Generates a signed URL for inline viewing (e.g., PDF in browser).
 */
export function getInlineViewUrl(
	key: string,
	filename: string,
	expiresIn = DEFAULT_EXPIRES_IN
): Promise<ReadUrlResult> {
	return getReadUrl({
		key,
		expiresIn,
		responseContentDisposition: `inline; filename="${filename}"`,
	});
}

/**
 * Generates a signed URL for downloading (triggers download dialog).
 */
export function getDownloadUrl(
	key: string,
	filename: string,
	expiresIn = DEFAULT_EXPIRES_IN
): Promise<ReadUrlResult> {
	return getReadUrl({
		key,
		expiresIn,
		responseContentDisposition: `attachment; filename="${filename}"`,
	});
}

/**
 * Batch generate read URLs for multiple files.
 */
export function getBatchReadUrls(
	keys: string[],
	expiresIn = DEFAULT_EXPIRES_IN
): Promise<ReadUrlResult[]> {
	return Promise.all(keys.map((key) => getReadUrl({ key, expiresIn })));
}
