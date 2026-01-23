/**
 * Storage helpers for page images.
 * Handles listing and reading converted page images from R2.
 */

import type { AssetMetadata, ConversionStatus } from "@/types/ocr";
import {
	downloadFromR2,
	getR2FileInfo,
	listR2Files,
	uploadToR2,
} from "./r2-client";
import { getReadUrl } from "./signed-urls";

/**
 * Regex for extracting page number from image filename.
 */
const PAGE_NUMBER_REGEX = /page-(\d+)\.jpg$/;

/**
 * Base path for asset files in R2.
 */
function getAssetBasePath(assetId: string): string {
	return `assets/${assetId}`;
}

/**
 * Gets the path for a page image.
 */
export function getPageImageKey(assetId: string, pageNumber: number): string {
	const paddedPage = String(pageNumber).padStart(4, "0");
	return `${getAssetBasePath(assetId)}/pages/page-${paddedPage}.jpg`;
}

/**
 * Gets the path for asset metadata.
 */
export function getMetadataKey(assetId: string): string {
	return `${getAssetBasePath(assetId)}/metadata.json`;
}

/**
 * Gets the path for conversion status.
 */
export function getConversionStatusKey(assetId: string): string {
	return `${getAssetBasePath(assetId)}/conversion-status.json`;
}

/**
 * Lists all page images for an asset.
 */
export async function listPageImages(
	assetId: string
): Promise<{ pageNumber: number; key: string; size?: number }[]> {
	const prefix = `${getAssetBasePath(assetId)}/pages/`;
	const files = await listR2Files(prefix, 2000);

	return files
		.filter((f) => f.key.endsWith(".jpg"))
		.map((f) => {
			// Extract page number from key: .../page-0001.jpg
			const match = f.key.match(PAGE_NUMBER_REGEX);
			const pageNumber = match ? Number.parseInt(match[1], 10) : 0;
			return {
				pageNumber,
				key: f.key,
				size: f.size,
			};
		})
		.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Gets a signed URL for a page image.
 */
export async function getPageImageUrl(
	assetId: string,
	pageNumber: number,
	expiresIn = 3600
): Promise<string> {
	const key = getPageImageKey(assetId, pageNumber);
	const result = await getReadUrl({ key, expiresIn });
	return result.readUrl;
}

/**
 * Gets signed URLs for all page images.
 */
export async function getAllPageImageUrls(
	assetId: string,
	expiresIn = 3600
): Promise<{ pageNumber: number; url: string }[]> {
	const pages = await listPageImages(assetId);

	const urls = await Promise.all(
		pages.map(async (page) => {
			const result = await getReadUrl({ key: page.key, expiresIn });
			return {
				pageNumber: page.pageNumber,
				url: result.readUrl,
			};
		})
	);

	return urls;
}

/**
 * Stores a page image in R2.
 */
export async function storePageImage(
	assetId: string,
	pageNumber: number,
	imageBuffer: Buffer
): Promise<string> {
	const key = getPageImageKey(assetId, pageNumber);
	await uploadToR2(key, imageBuffer, "image/jpeg");
	return key;
}

/**
 * Reads asset metadata from R2.
 */
export async function getAssetMetadata(
	assetId: string
): Promise<AssetMetadata | null> {
	const key = getMetadataKey(assetId);
	const info = await getR2FileInfo(key);

	if (!info.exists) {
		return null;
	}

	const { body } = await downloadFromR2(key);
	const chunks: Uint8Array[] = [];
	const reader = body.getReader();

	let done = false;
	while (!done) {
		const { value, done: readerDone } = await reader.read();
		done = readerDone;
		if (value) {
			chunks.push(value);
		}
	}

	const text = new TextDecoder().decode(
		Buffer.concat(chunks.map((c) => Buffer.from(c)))
	);
	return JSON.parse(text) as AssetMetadata;
}

/**
 * Stores asset metadata in R2.
 */
export async function storeAssetMetadata(
	assetId: string,
	metadata: AssetMetadata
): Promise<void> {
	const key = getMetadataKey(assetId);
	await uploadToR2(
		key,
		Buffer.from(JSON.stringify(metadata, null, 2)),
		"application/json"
	);
}

/**
 * Reads conversion status from R2.
 */
export async function getConversionStatus(
	assetId: string
): Promise<ConversionStatus | null> {
	const key = getConversionStatusKey(assetId);
	const info = await getR2FileInfo(key);

	if (!info.exists) {
		return null;
	}

	const { body } = await downloadFromR2(key);
	const chunks: Uint8Array[] = [];
	const reader = body.getReader();

	let done = false;
	while (!done) {
		const { value, done: readerDone } = await reader.read();
		done = readerDone;
		if (value) {
			chunks.push(value);
		}
	}

	const text = new TextDecoder().decode(
		Buffer.concat(chunks.map((c) => Buffer.from(c)))
	);
	return JSON.parse(text) as ConversionStatus;
}

/**
 * Stores conversion status in R2.
 */
export async function storeConversionStatus(
	assetId: string,
	status: ConversionStatus
): Promise<void> {
	const key = getConversionStatusKey(assetId);
	await uploadToR2(
		key,
		Buffer.from(JSON.stringify(status, null, 2)),
		"application/json"
	);
}

/**
 * Checks if conversion is complete for an asset.
 */
export async function isConversionComplete(assetId: string): Promise<boolean> {
	const status = await getConversionStatus(assetId);
	return status?.status === "completed";
}

/**
 * Gets the total page count for an asset.
 */
export async function getPageCount(assetId: string): Promise<number> {
	const metadata = await getAssetMetadata(assetId);
	return metadata?.totalPages ?? 0;
}
