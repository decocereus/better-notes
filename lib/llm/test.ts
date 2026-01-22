/**
 * LLM connection test utility.
 *
 * Tests the connection to OpenRouter by sending a simple prompt
 * and measuring the response time.
 */

import { generateText } from "ai";
import { createLLMProvider, isValidModel } from "./provider";

/**
 * Result of an LLM connection test.
 */
export interface LLMTestResult {
	/** Whether the test was successful */
	success: boolean;
	/** Response time in milliseconds */
	responseTime: number;
	/** The model that was tested */
	modelId: string;
	/** Error message if the test failed */
	error?: string;
	/** The response text (for debugging) */
	response?: string;
}

/**
 * Tests the LLM connection with a specific model.
 *
 * Sends a simple prompt and checks if the response is valid.
 * Measures the response time for performance monitoring.
 *
 * @param modelId - The model ID to test (e.g., "anthropic/claude-3.5-sonnet")
 * @param apiKey - Optional API key override
 * @returns Test result with success status and response time
 */
export async function testLLMConnection(
	modelId: string,
	apiKey?: string
): Promise<LLMTestResult> {
	const startTime = Date.now();

	// Validate model ID first
	if (!isValidModel(modelId)) {
		return {
			success: false,
			responseTime: Date.now() - startTime,
			modelId,
			error: `Invalid model ID: ${modelId}`,
		};
	}

	try {
		const provider = createLLMProvider(apiKey);
		const model = provider(modelId);

		const result = await generateText({
			model,
			prompt: 'Respond with exactly: "Hello, BetterNotes!" and nothing else.',
			maxOutputTokens: 20,
		});

		const responseTime = Date.now() - startTime;
		const responseText = result.text.trim();

		// Check if response is valid (contains expected text)
		const isValidResponse = responseText.toLowerCase().includes("hello");

		return {
			success: isValidResponse,
			responseTime,
			modelId,
			response: responseText,
			error: isValidResponse ? undefined : "Unexpected response format",
		};
	} catch (error) {
		const responseTime = Date.now() - startTime;
		const errorMessage = extractErrorMessage(error);

		return {
			success: false,
			responseTime,
			modelId,
			error: errorMessage,
		};
	}
}

/**
 * Error patterns mapped to user-friendly messages.
 */
const ERROR_PATTERNS: Array<{ patterns: string[]; message: string }> = [
	{ patterns: ["401", "unauthorized"], message: "Invalid API key" },
	{ patterns: ["402", "payment"], message: "Insufficient credits" },
	{ patterns: ["429", "rate limit"], message: "Rate limit exceeded" },
	{ patterns: ["timeout"], message: "Request timeout" },
	{ patterns: ["network", "fetch"], message: "Network error" },
];

/**
 * Finds a matching error pattern for a message.
 */
function findMatchingErrorPattern(message: string): string | undefined {
	const lowerMessage = message.toLowerCase();
	for (const { patterns, message: errorMessage } of ERROR_PATTERNS) {
		if (patterns.some((pattern) => lowerMessage.includes(pattern))) {
			return errorMessage;
		}
	}
	return undefined;
}

/**
 * Extracts a user-friendly error message from an error.
 */
function extractErrorMessage(error: unknown): string {
	if (!(error instanceof Error)) {
		return "Unknown error";
	}

	const matchedMessage = findMatchingErrorPattern(error.message);
	if (matchedMessage) {
		return matchedMessage;
	}

	// Return the original message if it's short enough
	if (error.message.length < 100) {
		return error.message;
	}

	return "Connection failed";
}

/**
 * Tests multiple models in parallel.
 *
 * Useful for testing all configured models at once.
 *
 * @param modelIds - Array of model IDs to test
 * @param apiKey - Optional API key override
 * @returns Object mapping model IDs to their test results
 */
export async function testMultipleModels(
	modelIds: string[],
	apiKey?: string
): Promise<Record<string, LLMTestResult>> {
	const results = await Promise.all(
		modelIds.map((modelId) => testLLMConnection(modelId, apiKey))
	);

	const resultMap: Record<string, LLMTestResult> = {};
	for (const result of results) {
		resultMap[result.modelId] = result;
	}

	return resultMap;
}
