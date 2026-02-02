/**
 * AI Client for OpenRouter
 * Provides access to LLM models via OpenRouter API.
 * Uses AI SDK for a unified interface.
 */

import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";

/**
 * Available models for different tasks.
 * Using OpenRouter model identifiers.
 */
export const MODELS = {
	/** Kimi K2.5 - Used for all tasks */
	OCR: "moonshotai/kimi-k2.5",
	/** Kimi K2.5 - Used for all tasks */
	EXTRACTION: "moonshotai/kimi-k2.5",
	/** Kimi K2.5 - Used for all tasks */
	CLASSIFICATION: "moonshotai/kimi-k2.5",
	/** Kimi K2.5 - Used for all tasks */
	COMPARISON: "moonshotai/kimi-k2.5",
	/** Kimi K2.5 - Used for all tasks */
	GENERATION: "moonshotai/kimi-k2.5",
	/** Kimi K2.5 - Used for all tasks */
	SIMPLE: "moonshotai/kimi-k2.5",
} as const;

export type ModelType = keyof typeof MODELS;

/**
 * Creates an OpenRouter-compatible AI client.
 */
export function getAIClient() {
	if (!env.OPENROUTER_API_KEY) {
		throw new Error("OPENROUTER_API_KEY is not configured");
	}

	return createOpenAI({
		baseURL: "https://openrouter.ai/api/v1",
		apiKey: env.OPENROUTER_API_KEY,
		headers: {
			"HTTP-Referer": "https://better-notes.app",
			"X-Title": "BetterNotes",
		},
	});
}

/**
 * Gets a model instance for a specific task type.
 */
export function getModel(type: ModelType, overrideModelId?: string) {
	const client = getAIClient();
	const modelId = overrideModelId ?? MODELS[type];
	return client(modelId);
}

/**
 * Creates a completely fresh model instance with unique request headers.
 * Use this when processing chunks sequentially to ensure each chunk gets
 * full model attention without shortcut-taking from previous similar requests.
 */
export function getFreshModel(
	type: ModelType,
	chunkId?: string,
	overrideModelId?: string
) {
	// Create a wrapper that adds unique headers for each chunk
	// This prevents any potential caching or context reuse
	const freshClient = createOpenAI({
		baseURL: "https://openrouter.ai/api/v1",
		apiKey: env.OPENROUTER_API_KEY,
		headers: {
			"HTTP-Referer": "https://better-notes.app",
			"X-Title": "BetterNotes",
			// Add unique identifier for this specific model instance
			"X-Request-Context": chunkId ? `chunk-${chunkId}` : `fresh-${Date.now()}`,
		},
	});

	const modelId = overrideModelId ?? MODELS[type];
	return freshClient(modelId);
}

/**
 * Validates that the AI client is properly configured.
 */
export function validateAIConfig(): { valid: boolean; error?: string } {
	if (!env.OPENROUTER_API_KEY) {
		return { valid: false, error: "OPENROUTER_API_KEY is not configured" };
	}
	return { valid: true };
}
