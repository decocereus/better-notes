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
	/** Gemini Flash 2.0 - Fast, good for OCR and bulk processing */
	OCR: "google/gemini-2.0-flash-001",
	/** Claude Sonnet - High quality for extraction and analysis */
	EXTRACTION: "anthropic/claude-sonnet-4",
	/** Claude Sonnet - Better structured output for classification */
	CLASSIFICATION: "anthropic/claude-sonnet-4",
	/** Claude Sonnet - High quality for comparison and gap analysis */
	COMPARISON: "anthropic/claude-sonnet-4",
	/** Claude Haiku - Fast and cheap for simple tasks */
	SIMPLE: "anthropic/claude-3-5-haiku",
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
export function getModel(type: ModelType) {
	const client = getAIClient();
	return client(MODELS[type]);
}

/**
 * Creates a completely fresh model instance with unique request headers.
 * Use this when processing chunks sequentially to ensure each chunk gets
 * full model attention without shortcut-taking from previous similar requests.
 */
export function getFreshModel(type: ModelType, chunkId?: string) {
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

	return freshClient(MODELS[type]);
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
