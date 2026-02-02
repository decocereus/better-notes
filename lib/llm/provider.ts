/**
 * LLM Provider configuration using Vercel AI SDK with OpenRouter.
 *
 * OpenRouter provides access to multiple LLM providers through a single API.
 * The API key is stored in environment variables (OPENROUTER_API_KEY).
 */

import { createOpenAI } from "@ai-sdk/openai";

/**
 * Available model capabilities
 */
export type ModelCapability = "text" | "vision";

/**
 * Model definition with capabilities
 */
export interface AvailableModel {
	/** Unique model identifier (OpenRouter format) */
	id: string;
	/** Human-readable model name */
	name: string;
	/** Model capabilities (text, vision) */
	capabilities: ModelCapability[];
	/** Brief description of the model */
	description: string;
}

/**
 * Task types that use LLM
 */
export type TaskType =
	| "ocr"
	| "pattern_extraction"
	| "classification"
	| "comparison"
	| "generation";

/**
 * Task definition with requirements
 */
export interface TaskDefinition {
	/** Task identifier */
	id: TaskType;
	/** Human-readable task name */
	name: string;
	/** Task description */
	description: string;
	/** Whether the task requires vision capability */
	requiresVision: boolean;
}

/**
 * Available LLM models via OpenRouter.
 * Models are selected based on cost-effectiveness and capability.
 */
export const AVAILABLE_MODELS: AvailableModel[] = [
	{
		id: "moonshotai/kimi-k2.5",
		name: "Kimi K2.5",
		capabilities: ["text", "vision"],
		description: "Moonshot AI's Kimi K2.5 model for all tasks",
	},
] as const;

/**
 * Task definitions with their requirements.
 */
export const TASK_DEFINITIONS: TaskDefinition[] = [
	{
		id: "ocr",
		name: "OCR / Text Extraction",
		description: "Extract text from PDFs and images using vision models",
		requiresVision: true,
	},
	{
		id: "pattern_extraction",
		name: "Pattern Extraction",
		description: "Analyze topper essays to extract writing patterns",
		requiresVision: false,
	},
	{
		id: "classification",
		name: "Content Classification",
		description: "Classify content into themes and mini-themes",
		requiresVision: false,
	},
	{
		id: "comparison",
		name: "Comparison Analysis",
		description: "Compare user content against topper patterns",
		requiresVision: false,
	},
	{
		id: "generation",
		name: "Note Generation",
		description: "Generate revision-ready notes from classified content",
		requiresVision: false,
	},
] as const;

/**
 * Default model configuration per task.
 * Maps task ID to model ID.
 */
export const DEFAULT_MODEL_CONFIG: Record<TaskType, string> = {
	ocr: "moonshotai/kimi-k2.5",
	pattern_extraction: "moonshotai/kimi-k2.5",
	classification: "moonshotai/kimi-k2.5",
	comparison: "moonshotai/kimi-k2.5",
	generation: "moonshotai/kimi-k2.5",
} as const;

/**
 * Creates an OpenRouter-compatible LLM provider using Vercel AI SDK.
 *
 * @param apiKey - Optional API key override (defaults to env var)
 * @returns OpenAI-compatible provider configured for OpenRouter
 */
export function createLLMProvider(apiKey?: string) {
	const key = apiKey || process.env.OPENROUTER_API_KEY;

	if (!key) {
		throw new Error(
			"OPENROUTER_API_KEY environment variable is required for LLM functionality"
		);
	}

	return createOpenAI({
		baseURL: "https://openrouter.ai/api/v1",
		apiKey: key,
		headers: {
			"HTTP-Referer": "https://betternotes.app",
			"X-Title": "BetterNotes",
		},
	});
}

/**
 * Gets the model ID for a specific task from config or defaults.
 *
 * @param task - The task type
 * @param config - Optional custom model configuration
 * @returns The model ID to use for the task
 */
export function getModelForTask(
	task: TaskType,
	config?: Record<string, string>
): string {
	return config?.[task] || DEFAULT_MODEL_CONFIG[task];
}

/**
 * Gets models that have a specific capability.
 *
 * @param capability - The required capability
 * @returns Array of models with that capability
 */
export function getModelsWithCapability(
	capability: ModelCapability
): AvailableModel[] {
	return AVAILABLE_MODELS.filter((model) =>
		model.capabilities.includes(capability)
	);
}

/**
 * Gets models suitable for a specific task.
 *
 * @param task - The task type
 * @returns Array of models that can perform the task
 */
export function getModelsForTask(task: TaskType): AvailableModel[] {
	const taskDef = TASK_DEFINITIONS.find((t) => t.id === task);

	if (!taskDef) {
		return AVAILABLE_MODELS;
	}

	if (taskDef.requiresVision) {
		return getModelsWithCapability("vision");
	}

	return AVAILABLE_MODELS;
}

/**
 * Validates that a model ID exists in the available models.
 *
 * @param modelId - The model ID to validate
 * @returns True if the model exists
 */
export function isValidModel(modelId: string): boolean {
	return AVAILABLE_MODELS.some((model) => model.id === modelId);
}

/**
 * Gets a model by its ID.
 *
 * @param modelId - The model ID
 * @returns The model definition or undefined
 */
export function getModelById(modelId: string): AvailableModel | undefined {
	return AVAILABLE_MODELS.find((model) => model.id === modelId);
}
