/**
 * Storage helpers for per-page OCR results.
 * Handles reading and writing OCR results to R2.
 */

import type { AssetOcrResults, OcrStatus, PageOcrResult } from "@/types/ocr";
import {
	downloadFromR2,
	getR2FileInfo,
	listR2Files,
	uploadToR2,
} from "./r2-client";

/**
 * Regex for matching OCR result files.
 */
const OCR_RESULT_FILE_REGEX = /page-\d+\.json$/;

/**
 * Regex for extracting page number from OCR result filename.
 */
const OCR_PAGE_NUMBER_REGEX = /page-(\d+)\.json$/;

/**
 * Base path for asset files in R2.
 */
function getAssetBasePath(assetId: string): string {
	return `assets/${assetId}`;
}

/**
 * Gets the path for a page OCR result.
 */
export function getPageOcrResultKey(
	assetId: string,
	pageNumber: number
): string {
	const paddedPage = String(pageNumber).padStart(4, "0");
	return `${getAssetBasePath(assetId)}/ocr/page-${paddedPage}.json`;
}

/**
 * Gets the path for OCR status.
 */
export function getOcrStatusKey(assetId: string): string {
	return `${getAssetBasePath(assetId)}/ocr-status.json`;
}

/**
 * Helper to read a JSON file from R2.
 */
async function readJsonFromR2<T>(key: string): Promise<T | null> {
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
	return JSON.parse(text) as T;
}

/**
 * Reads a single page OCR result from R2.
 */
export function getPageOcrResult(
	assetId: string,
	pageNumber: number
): Promise<PageOcrResult | null> {
	const key = getPageOcrResultKey(assetId, pageNumber);
	return readJsonFromR2<PageOcrResult>(key);
}

/**
 * Stores a single page OCR result in R2.
 */
export async function storePageOcrResult(
	assetId: string,
	result: PageOcrResult
): Promise<void> {
	const key = getPageOcrResultKey(assetId, result.pageNumber);
	await uploadToR2(
		key,
		Buffer.from(JSON.stringify(result, null, 2)),
		"application/json"
	);
}

/**
 * Lists all OCR results for an asset.
 */
export async function listOcrResults(
	assetId: string
): Promise<{ pageNumber: number; key: string }[]> {
	const prefix = `${getAssetBasePath(assetId)}/ocr/`;
	const files = await listR2Files(prefix, 2000);

	return files
		.filter((f) => OCR_RESULT_FILE_REGEX.test(f.key))
		.map((f) => {
			const match = f.key.match(OCR_PAGE_NUMBER_REGEX);
			const pageNumber = match ? Number.parseInt(match[1], 10) : 0;
			return { pageNumber, key: f.key };
		})
		.sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * Reads all OCR results for an asset.
 */
export async function getAllOcrResults(
	assetId: string
): Promise<PageOcrResult[]> {
	const resultsList = await listOcrResults(assetId);

	const results = await Promise.all(
		resultsList.map(async ({ pageNumber }) => {
			const result = await getPageOcrResult(assetId, pageNumber);
			return result;
		})
	);

	return results.filter((r): r is PageOcrResult => r !== null);
}

/**
 * Reads OCR status from R2.
 */
export function getOcrStatus(assetId: string): Promise<OcrStatus | null> {
	const key = getOcrStatusKey(assetId);
	return readJsonFromR2<OcrStatus>(key);
}

/**
 * Stores OCR status in R2.
 */
export async function storeOcrStatus(
	assetId: string,
	status: OcrStatus
): Promise<void> {
	const key = getOcrStatusKey(assetId);
	await uploadToR2(
		key,
		Buffer.from(JSON.stringify(status, null, 2)),
		"application/json"
	);
}

/**
 * Combines all OCR results into a single result object.
 */
export async function getCombinedOcrResults(
	assetId: string
): Promise<AssetOcrResults | null> {
	const pages = await getAllOcrResults(assetId);

	if (pages.length === 0) {
		return null;
	}

	const sortedPages = pages.sort((a, b) => a.pageNumber - b.pageNumber);
	const combinedText = sortedPages.map((p) => p.text).join("\n\n---\n\n");
	const totalWordCount = sortedPages.reduce((sum, p) => sum + p.wordCount, 0);
	const averageConfidence =
		sortedPages.reduce((sum, p) => sum + p.confidence, 0) / sortedPages.length;
	const retriedCount = sortedPages.filter((p) => p.retried).length;

	return {
		assetId,
		totalPages: sortedPages.length,
		pages: sortedPages,
		combinedText,
		totalWordCount,
		averageConfidence,
		retriedCount,
		processedAt: new Date().toISOString(),
	};
}

/**
 * Streams combined text from OCR results.
 * Useful for the extraction pipeline.
 */
export async function* streamCombinedText(
	assetId: string
): AsyncGenerator<string> {
	const resultsList = await listOcrResults(assetId);

	for (const { pageNumber } of resultsList) {
		const result = await getPageOcrResult(assetId, pageNumber);
		if (result) {
			yield result.text;
			// Add page separator
			if (pageNumber < resultsList.length) {
				yield "\n\n---\n\n";
			}
		}
	}
}

/**
 * Checks if OCR is complete for an asset.
 */
export async function isOcrComplete(assetId: string): Promise<boolean> {
	const status = await getOcrStatus(assetId);
	return status?.status === "completed";
}
