/**
 * Model selection helpers for OCR pipeline.
 * Provides access to Gemini Flash (primary) and Claude Sonnet (fallback).
 */

import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

/**
 * OCR model types.
 */
export type OcrModelType = "gemini-flash" | "claude-sonnet";

/**
 * Gets the Gemini Flash model for primary OCR.
 * Fast and cost-effective for bulk processing.
 */
export function getGeminiFlashModel() {
	return google("gemini-2.0-flash-001");
}

/**
 * Gets the Claude Sonnet model for OCR retries.
 * Higher quality for difficult pages.
 */
export function getClaudeSonnetModel() {
	return anthropic("claude-sonnet-4-20250514");
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
	const geminiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	const anthropicKey = process.env.ANTHROPIC_API_KEY;

	return {
		geminiAvailable: Boolean(geminiKey),
		claudeAvailable: Boolean(anthropicKey),
		error:
			geminiKey || anthropicKey
				? undefined
				: "No OCR model API keys configured (GOOGLE_GENERATIVE_AI_API_KEY or ANTHROPIC_API_KEY)",
	};
}
