/**
 * Types for the global asset library.
 */

import type { Id } from "@/convex/_generated/dataModel";

/**
 * Processing status states for assets.
 * Assets go through:
 *   pending → conversion_queued → conversion_processing → conversion_completed →
 *   ocr_queued → ocr_processing → ocr_completed →
 *   extraction_queued → extraction_processing → extraction_completed
 *
 * Can fail at any stage: conversion_failed, ocr_failed, extraction_failed
 */
export type AssetProcessingStatus =
	| "pending"
	| "conversion_queued"
	| "conversion_processing"
	| "conversion_completed"
	| "conversion_failed"
	| "ocr_queued"
	| "ocr_processing"
	| "ocr_completed"
	| "ocr_failed"
	| "extraction_queued"
	| "extraction_processing"
	| "extraction_completed"
	| "extraction_failed";

/**
 * Source type for assets.
 */
export type AssetSourceType = "pdf" | "image";

/**
 * An asset in the global asset library.
 * Represents any file uploaded to R2 storage.
 */
export interface Asset {
	id: Id<"assets">;
	filename: string;
	key: string; // R2 key
	size: number;
	mimeType: string;
	sourceType: AssetSourceType;
	projectId?: Id<"projects">;
	processingStatus: AssetProcessingStatus;
	ocrJobId?: string;
	extractionJobId?: string;
	ocrWordCount?: number;
	extractedItemCount?: number;
	lastError?: string;
	uploadedAt: string;
	processedAt?: string;
	updatedAt: string;
}

/**
 * Statistics for the asset library dashboard.
 */
export interface AssetStats {
	total: number;
	unassigned: number;
	byStatus: Record<AssetProcessingStatus, number>;
	bySourceType: Record<AssetSourceType, number>;
}

/**
 * Extraction result metadata stored in Convex.
 */
export interface ExtractionResultMetadata {
	id: Id<"extractionResults">;
	assetId: Id<"assets">;
	ocrJobId: string;
	extractionJobId: string;
	totalEssays: number;
	totalItems: number;
	stats: ExtractionStats;
	resultsKey: string; // R2 key for full results JSON
	createdAt: string;
}

/**
 * Stats from extraction processing.
 */
export interface ExtractionStats {
	totalItems: number;
	byType: Record<string, number>;
	averageConfidence: number;
}

/**
 * Input for creating a new asset record.
 */
export interface CreateAssetInput {
	key: string;
	filename: string;
	size: number;
	mimeType: string;
	projectId?: string;
	autoProcess?: boolean;
}

/**
 * Input for listing assets with filters.
 */
export interface ListAssetsInput {
	projectId?: string;
	status?: AssetProcessingStatus;
	sourceType?: AssetSourceType;
	unassignedOnly?: boolean;
}

/**
 * Response for asset list endpoint.
 */
export interface AssetListResponse {
	assets: Asset[];
	stats: AssetStats;
}

/**
 * Response for single asset endpoint.
 */
export interface AssetResponse {
	asset: Asset;
	previewUrl?: string;
	extractionResult?: ExtractionResultMetadata;
}

/**
 * Check if a status indicates processing is in progress.
 */
export function isProcessing(status: AssetProcessingStatus): boolean {
	return (
		status === "conversion_queued" ||
		status === "conversion_processing" ||
		status === "ocr_queued" ||
		status === "ocr_processing" ||
		status === "extraction_queued" ||
		status === "extraction_processing"
	);
}

/**
 * Check if a status indicates a failure.
 */
export function isFailed(status: AssetProcessingStatus): boolean {
	return (
		status === "conversion_failed" ||
		status === "ocr_failed" ||
		status === "extraction_failed"
	);
}

/**
 * Check if a status indicates completion.
 */
export function isCompleted(status: AssetProcessingStatus): boolean {
	return status === "extraction_completed";
}

/**
 * Get a human-readable label for a processing status.
 */
export function getStatusLabel(status: AssetProcessingStatus): string {
	const labels: Record<AssetProcessingStatus, string> = {
		pending: "Pending",
		conversion_queued: "Conversion Queued",
		conversion_processing: "Converting PDF",
		conversion_completed: "Conversion Complete",
		conversion_failed: "Conversion Failed",
		ocr_queued: "OCR Queued",
		ocr_processing: "OCR Processing",
		ocr_completed: "OCR Complete",
		ocr_failed: "OCR Failed",
		extraction_queued: "Extraction Queued",
		extraction_processing: "Extracting",
		extraction_completed: "Complete",
		extraction_failed: "Extraction Failed",
	};
	return labels[status];
}
