/**
 * Retry logic for OCR processing.
 * Determines when to retry OCR with a different model based on quality thresholds.
 */

import type { PageOcrResult, RetryThresholds } from "@/types/ocr";
import { DEFAULT_RETRY_THRESHOLDS } from "@/types/ocr";

/**
 * Result of checking if a page needs retry.
 */
export interface RetryCheckResult {
	needsRetry: boolean;
	reason?: "low_confidence" | "low_word_count" | "high_illegible" | "error";
}

/**
 * Checks if a page OCR result should be retried with a different model.
 */
export function shouldRetryPage(
	result: PageOcrResult,
	thresholds: RetryThresholds = DEFAULT_RETRY_THRESHOLDS
): RetryCheckResult {
	// Already retried - don't retry again
	if (result.retried) {
		return { needsRetry: false };
	}

	// Error during processing
	if (result.error) {
		return { needsRetry: true, reason: "error" };
	}

	// Low word count - might have missed content
	if (result.wordCount < thresholds.minWordCount) {
		return { needsRetry: true, reason: "low_word_count" };
	}

	// Low confidence score
	if (result.confidence < thresholds.minConfidence) {
		return { needsRetry: true, reason: "low_confidence" };
	}

	// High illegible ratio
	const illegibleRatio =
		result.wordCount > 0 ? result.illegibleCount / result.wordCount : 0;
	if (illegibleRatio > thresholds.maxIllegibleRatio) {
		return { needsRetry: true, reason: "high_illegible" };
	}

	return { needsRetry: false };
}

/**
 * Finds all pages that need retry from a list of results.
 */
export function findPagesNeedingRetry(
	results: PageOcrResult[],
	thresholds: RetryThresholds = DEFAULT_RETRY_THRESHOLDS
): { pageNumber: number; reason: RetryCheckResult["reason"] }[] {
	const pagesNeedingRetry: {
		pageNumber: number;
		reason: RetryCheckResult["reason"];
	}[] = [];

	for (const result of results) {
		const check = shouldRetryPage(result, thresholds);
		if (check.needsRetry) {
			pagesNeedingRetry.push({
				pageNumber: result.pageNumber,
				reason: check.reason,
			});
		}
	}

	return pagesNeedingRetry;
}

/**
 * Calculates quality metrics for a set of OCR results.
 */
export function calculateQualityMetrics(results: PageOcrResult[]): {
	totalPages: number;
	averageConfidence: number;
	averageWordCount: number;
	lowConfidencePages: number;
	lowWordCountPages: number;
	highIllegiblePages: number;
	errorPages: number;
	retriedPages: number;
} {
	if (results.length === 0) {
		return {
			totalPages: 0,
			averageConfidence: 0,
			averageWordCount: 0,
			lowConfidencePages: 0,
			lowWordCountPages: 0,
			highIllegiblePages: 0,
			errorPages: 0,
			retriedPages: 0,
		};
	}

	const thresholds = DEFAULT_RETRY_THRESHOLDS;
	let totalConfidence = 0;
	let totalWordCount = 0;
	let lowConfidencePages = 0;
	let lowWordCountPages = 0;
	let highIllegiblePages = 0;
	let errorPages = 0;
	let retriedPages = 0;

	for (const result of results) {
		totalConfidence += result.confidence;
		totalWordCount += result.wordCount;

		if (result.confidence < thresholds.minConfidence) {
			lowConfidencePages++;
		}
		if (result.wordCount < thresholds.minWordCount) {
			lowWordCountPages++;
		}
		const illegibleRatio =
			result.wordCount > 0 ? result.illegibleCount / result.wordCount : 0;
		if (illegibleRatio > thresholds.maxIllegibleRatio) {
			highIllegiblePages++;
		}
		if (result.error) {
			errorPages++;
		}
		if (result.retried) {
			retriedPages++;
		}
	}

	return {
		totalPages: results.length,
		averageConfidence: totalConfidence / results.length,
		averageWordCount: totalWordCount / results.length,
		lowConfidencePages,
		lowWordCountPages,
		highIllegiblePages,
		errorPages,
		retriedPages,
	};
}
