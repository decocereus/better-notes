/**
 * Model selection helpers for OCR pipeline.
 * Uses OpenRouter with Kimi K2.5 for primary and fallback OCR.
 */
import { getAIClient } from "@/lib/ai/client";
import { env } from "@/lib/env";

const OPENROUTER_MODELS = {
	geminiFlash: "moonshotai/kimi-k2.5",
	claudeSonnet: "moonshotai/kimi-k2.5",
} as const;

/**
 * OCR model types.
 */
export type OcrModelType = "gemini-flash" | "claude-sonnet";

/**
 * Gets the primary OCR model via OpenRouter.
 */
export function getGeminiFlashModel() {
	return getAIClient()(OPENROUTER_MODELS.geminiFlash);
}

/**
 * Gets the fallback OCR model via OpenRouter.
 */
export function getClaudeSonnetModel() {
	return getAIClient()(OPENROUTER_MODELS.claudeSonnet);
}

/**
 * Gets a model by type.
 */
export function getOcrModel(type: OcrModelType) {
	switch (type) {
		case "gemini-flash":
			return getGeminiFlashModel();
		case "claude-sonnet":
			return getClaudeSonnetModel();
		default:
			throw new Error(`Unknown model type: ${type}`);
	}
}

/**
 * Validates that required API keys are configured.
 */
export function validateOcrModelConfig(): {
	geminiAvailable: boolean;
	claudeAvailable: boolean;
	error?: string;
} {
	const openRouterKey = env.OPENROUTER_API_KEY;

	return {
		geminiAvailable: Boolean(openRouterKey),
		claudeAvailable: Boolean(openRouterKey),
		error: openRouterKey
			? undefined
			: "OPENROUTER_API_KEY is required for OCR models",
	};
}
