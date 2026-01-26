/**
 * Model selection helpers for OCR pipeline.
 * Provides access to Gemini Flash (primary) and Claude Sonnet (fallback).
 */

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { getAIClient } from "@/lib/ai/client";
import { env } from "@/lib/env";

const OPENROUTER_MODELS = {
	geminiFlash: "google/gemini-2.0-flash-001",
	claudeSonnet: "anthropic/claude-sonnet-4",
} as const;

const DIRECT_MODELS = {
	geminiFlash: "gemini-2.0-flash-001",
	claudeSonnet: "claude-sonnet-4-20250514",
} as const;

function shouldUseOpenRouter(): boolean {
	return Boolean(env.OPENROUTER_API_KEY);
}

/**
 * OCR model types.
 */
export type OcrModelType = "gemini-flash" | "claude-sonnet";

/**
 * Gets the Gemini Flash model for primary OCR.
 * Fast and cost-effective for bulk processing.
 */
export function getGeminiFlashModel() {
	if (shouldUseOpenRouter()) {
		return getAIClient()(OPENROUTER_MODELS.geminiFlash);
	}
	return google(DIRECT_MODELS.geminiFlash);
}

/**
 * Gets the Claude Sonnet model for OCR retries.
 * Higher quality for difficult pages.
 */
export function getClaudeSonnetModel() {
	if (shouldUseOpenRouter()) {
		return getAIClient()(OPENROUTER_MODELS.claudeSonnet);
	}
	return anthropic(DIRECT_MODELS.claudeSonnet);
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
	const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	const anthropicKey = process.env.ANTHROPIC_API_KEY;

	return {
		geminiAvailable: Boolean(openRouterKey || geminiKey),
		claudeAvailable: Boolean(openRouterKey || anthropicKey),
		error:
			openRouterKey || geminiKey || anthropicKey
				? undefined
				: "No OCR model API keys configured (OPENROUTER_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, or ANTHROPIC_API_KEY)",
	};
}
