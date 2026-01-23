/**
 * AI module for LLM operations.
 * Uses OpenRouter for model access.
 *
 * @module lib/ai
 */

export type { ModelType } from "./client";
export { getAIClient, getModel, MODELS, validateAIConfig } from "./client";
// Model selection helpers
export type { OcrModelType } from "./models";
export {
	getClaudeSonnetModel,
	getGeminiFlashModel,
	getOcrModel,
	validateOcrModelConfig,
} from "./models";
// OCR module - page-image based processing
export type { OcrOptions } from "./ocr";
export {
	findLowConfidencePages,
	performDirectPdfOcr,
	performOcrOnPageImage,
	processOcrJob,
	retryPagesWithClaude,
	runOcrPipeline,
} from "./ocr";

// Retry logic
export type { RetryCheckResult } from "./retry-logic";
export {
	calculateQualityMetrics,
	findPagesNeedingRetry,
	shouldRetryPage,
} from "./retry-logic";
