/**
 * AI module for LLM operations.
 * Uses OpenRouter for model access.
 *
 * @module lib/ai
 */

export type { ModelType } from "./client";
export { getAIClient, getModel, MODELS, validateAIConfig } from "./client";
export type { OcrOptions } from "./ocr";
export {
	combineOcrResults,
	performOcrBatch,
	performOcrOnPage,
	performOcrOnPages,
} from "./ocr";
