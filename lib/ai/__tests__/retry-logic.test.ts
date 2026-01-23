/**
 * Tests for OCR retry logic.
 */

import { describe, expect, it } from "vitest";
import type { PageOcrResult } from "@/types/ocr";
import { DEFAULT_RETRY_THRESHOLDS } from "@/types/ocr";
import {
	calculateQualityMetrics,
	findPagesNeedingRetry,
	shouldRetryPage,
} from "../retry-logic";

/**
 * Creates a mock PageOcrResult with defaults.
 */
function createMockResult(
	overrides: Partial<PageOcrResult> = {}
): PageOcrResult {
	return {
		pageNumber: 1,
		text: "This is some sample text from an OCR page result.",
		wordCount: 100,
		confidence: 0.85,
		illegibleCount: 2,
		model: "gemini-flash",
		processingTimeMs: 1500,
		retried: false,
		...overrides,
	};
}

describe("shouldRetryPage", () => {
	it("returns false for high-quality results", () => {
		const result = createMockResult({
			confidence: 0.9,
			wordCount: 200,
			illegibleCount: 5,
		});

		const check = shouldRetryPage(result);

		expect(check.needsRetry).toBe(false);
		expect(check.reason).toBeUndefined();
	});

	it("returns false for already retried pages", () => {
		const result = createMockResult({
			confidence: 0.5, // Low confidence, but already retried
			retried: true,
		});

		const check = shouldRetryPage(result);

		expect(check.needsRetry).toBe(false);
	});

	it("returns true with reason error when result has error", () => {
		const result = createMockResult({
			error: "Some error occurred",
		});

		const check = shouldRetryPage(result);

		expect(check.needsRetry).toBe(true);
		expect(check.reason).toBe("error");
	});

	it("returns true with reason low_word_count when word count is below threshold", () => {
		const result = createMockResult({
			wordCount: 10, // Below default threshold of 30
		});

		const check = shouldRetryPage(result);

		expect(check.needsRetry).toBe(true);
		expect(check.reason).toBe("low_word_count");
	});

	it("returns true with reason low_confidence when confidence is below threshold", () => {
		const result = createMockResult({
			confidence: 0.5, // Below default threshold of 0.7
		});

		const check = shouldRetryPage(result);

		expect(check.needsRetry).toBe(true);
		expect(check.reason).toBe("low_confidence");
	});

	it("returns true with reason high_illegible when illegible ratio is above threshold", () => {
		const result = createMockResult({
			wordCount: 100,
			illegibleCount: 20, // 20% illegible, above 15% threshold
		});

		const check = shouldRetryPage(result);

		expect(check.needsRetry).toBe(true);
		expect(check.reason).toBe("high_illegible");
	});

	it("uses custom thresholds when provided", () => {
		const result = createMockResult({
			confidence: 0.6,
			wordCount: 50,
		});

		// With custom thresholds, this should not need retry
		const customThresholds = {
			minWordCount: 20,
			minConfidence: 0.5,
			maxIllegibleRatio: 0.2,
		};

		const check = shouldRetryPage(result, customThresholds);

		expect(check.needsRetry).toBe(false);
	});

	it("prioritizes error reason over other issues", () => {
		const result = createMockResult({
			error: "Error",
			wordCount: 10, // Also low word count
			confidence: 0.5, // Also low confidence
		});

		const check = shouldRetryPage(result);

		expect(check.needsRetry).toBe(true);
		expect(check.reason).toBe("error");
	});
});

describe("findPagesNeedingRetry", () => {
	it("returns empty array for empty input", () => {
		const result = findPagesNeedingRetry([]);

		expect(result).toEqual([]);
	});

	it("returns empty array when no pages need retry", () => {
		const results = [
			createMockResult({ pageNumber: 1, confidence: 0.9, wordCount: 150 }),
			createMockResult({ pageNumber: 2, confidence: 0.85, wordCount: 200 }),
		];

		const pagesNeedingRetry = findPagesNeedingRetry(results);

		expect(pagesNeedingRetry).toEqual([]);
	});

	it("finds pages with low confidence", () => {
		const results = [
			createMockResult({ pageNumber: 1, confidence: 0.9 }),
			createMockResult({ pageNumber: 2, confidence: 0.5 }), // Low confidence
			createMockResult({ pageNumber: 3, confidence: 0.8 }),
		];

		const pagesNeedingRetry = findPagesNeedingRetry(results);

		expect(pagesNeedingRetry).toHaveLength(1);
		expect(pagesNeedingRetry[0]).toEqual({
			pageNumber: 2,
			reason: "low_confidence",
		});
	});

	it("finds multiple pages needing retry", () => {
		const results = [
			createMockResult({ pageNumber: 1, confidence: 0.5 }), // Low confidence
			createMockResult({ pageNumber: 2, wordCount: 10 }), // Low word count
			createMockResult({ pageNumber: 3, error: "Error" }), // Error
			createMockResult({ pageNumber: 4, confidence: 0.9 }), // Good
		];

		const pagesNeedingRetry = findPagesNeedingRetry(results);

		expect(pagesNeedingRetry).toHaveLength(3);
		expect(pagesNeedingRetry.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
	});

	it("excludes already retried pages", () => {
		const results = [
			createMockResult({ pageNumber: 1, confidence: 0.5, retried: true }),
			createMockResult({ pageNumber: 2, confidence: 0.5, retried: false }),
		];

		const pagesNeedingRetry = findPagesNeedingRetry(results);

		expect(pagesNeedingRetry).toHaveLength(1);
		expect(pagesNeedingRetry[0].pageNumber).toBe(2);
	});
});

describe("calculateQualityMetrics", () => {
	it("returns zeros for empty input", () => {
		const metrics = calculateQualityMetrics([]);

		expect(metrics).toEqual({
			totalPages: 0,
			averageConfidence: 0,
			averageWordCount: 0,
			lowConfidencePages: 0,
			lowWordCountPages: 0,
			highIllegiblePages: 0,
			errorPages: 0,
			retriedPages: 0,
		});
	});

	it("calculates correct averages", () => {
		const results = [
			createMockResult({ confidence: 0.8, wordCount: 100 }),
			createMockResult({ confidence: 0.9, wordCount: 200 }),
		];

		const metrics = calculateQualityMetrics(results);

		expect(metrics.totalPages).toBe(2);
		expect(metrics.averageConfidence).toBeCloseTo(0.85, 5);
		expect(metrics.averageWordCount).toBe(150);
	});

	it("counts low confidence pages correctly", () => {
		const results = [
			createMockResult({ pageNumber: 1, confidence: 0.9 }),
			createMockResult({ pageNumber: 2, confidence: 0.5 }), // Below 0.7
			createMockResult({ pageNumber: 3, confidence: 0.6 }), // Below 0.7
		];

		const metrics = calculateQualityMetrics(results);

		expect(metrics.lowConfidencePages).toBe(2);
	});

	it("counts low word count pages correctly", () => {
		const results = [
			createMockResult({ pageNumber: 1, wordCount: 100 }),
			createMockResult({ pageNumber: 2, wordCount: 20 }), // Below 30
			createMockResult({ pageNumber: 3, wordCount: 25 }), // Below 30
		];

		const metrics = calculateQualityMetrics(results);

		expect(metrics.lowWordCountPages).toBe(2);
	});

	it("counts high illegible pages correctly", () => {
		const results = [
			createMockResult({ wordCount: 100, illegibleCount: 5 }), // 5%
			createMockResult({ wordCount: 100, illegibleCount: 20 }), // 20%, above 15%
		];

		const metrics = calculateQualityMetrics(results);

		expect(metrics.highIllegiblePages).toBe(1);
	});

	it("counts error pages correctly", () => {
		const results = [
			createMockResult({ error: undefined }),
			createMockResult({ error: "Error 1" }),
			createMockResult({ error: "Error 2" }),
		];

		const metrics = calculateQualityMetrics(results);

		expect(metrics.errorPages).toBe(2);
	});

	it("counts retried pages correctly", () => {
		const results = [
			createMockResult({ retried: false }),
			createMockResult({ retried: true }),
			createMockResult({ retried: true }),
		];

		const metrics = calculateQualityMetrics(results);

		expect(metrics.retriedPages).toBe(2);
	});

	it("handles edge case of zero word count for illegible ratio", () => {
		const results = [createMockResult({ wordCount: 0, illegibleCount: 5 })];

		const metrics = calculateQualityMetrics(results);

		// Should not count as high illegible when word count is 0
		expect(metrics.highIllegiblePages).toBe(0);
		expect(metrics.lowWordCountPages).toBe(1);
	});
});

describe("DEFAULT_RETRY_THRESHOLDS", () => {
	it("has expected default values", () => {
		expect(DEFAULT_RETRY_THRESHOLDS).toEqual({
			minWordCount: 30,
			maxIllegibleRatio: 0.15,
			minConfidence: 0.7,
		});
	});
});
