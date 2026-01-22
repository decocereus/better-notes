import { NextResponse } from "next/server";

import {
	AVAILABLE_MODELS,
	DEFAULT_MODEL_CONFIG,
	getModelsForTask,
	isValidModel,
	TASK_DEFINITIONS,
	type TaskType,
} from "@/lib/llm";

/**
 * Response for GET /api/models
 */
interface ModelsResponse {
	/** Available LLM models */
	models: typeof AVAILABLE_MODELS;
	/** Task definitions with requirements */
	tasks: typeof TASK_DEFINITIONS;
	/** Default model configuration */
	defaults: typeof DEFAULT_MODEL_CONFIG;
}

/**
 * Request body for POST /api/models/validate
 */
interface ValidateConfigRequest {
	/** Model configuration to validate (task -> modelId) */
	config: Record<string, string>;
}

/**
 * Response for POST /api/models/validate
 */
interface ValidateConfigResponse {
	/** Whether the configuration is valid */
	valid: boolean;
	/** Validation errors by task */
	errors?: Record<string, string>;
	/** Validated configuration (with defaults filled in) */
	config?: Record<string, string>;
}

/**
 * GET /api/models
 *
 * Returns available models, task definitions, and default configuration.
 * Client uses this to populate the model selection UI.
 */
export function GET(): NextResponse<ModelsResponse> {
	return NextResponse.json({
		models: AVAILABLE_MODELS,
		tasks: TASK_DEFINITIONS,
		defaults: DEFAULT_MODEL_CONFIG,
	});
}

/**
 * POST /api/models
 *
 * Validates a model configuration.
 * Checks that each task has a valid model assigned that meets its requirements.
 *
 * Request body: { config: Record<string, string> }
 * Response: { valid: boolean, errors?: Record<string, string>, config?: Record<string, string> }
 */
export async function POST(
	request: Request
): Promise<NextResponse<ValidateConfigResponse>> {
	try {
		const body = (await request.json()) as ValidateConfigRequest;
		const { config } = body;

		if (!config || typeof config !== "object") {
			return NextResponse.json(
				{ valid: false, errors: { _: "Configuration object is required" } },
				{ status: 400 }
			);
		}

		const errors: Record<string, string> = {};
		const validatedConfig: Record<string, string> = {};

		// Validate each task's model configuration
		for (const task of TASK_DEFINITIONS) {
			const modelId = config[task.id];

			if (!modelId) {
				// Use default if not specified
				validatedConfig[task.id] = DEFAULT_MODEL_CONFIG[task.id as TaskType];
				continue;
			}

			// Check if model exists
			if (!isValidModel(modelId)) {
				errors[task.id] = `Invalid model: ${modelId}`;
				continue;
			}

			// Check if model meets task requirements
			const suitableModels = getModelsForTask(task.id as TaskType);
			const isModelSuitable = suitableModels.some((m) => m.id === modelId);

			if (!isModelSuitable) {
				errors[task.id] =
					`Model ${modelId} does not meet requirements for ${task.name}`;
				continue;
			}

			validatedConfig[task.id] = modelId;
		}

		if (Object.keys(errors).length > 0) {
			return NextResponse.json({ valid: false, errors }, { status: 400 });
		}

		return NextResponse.json({ valid: true, config: validatedConfig });
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Validation failed";
		return NextResponse.json(
			{ valid: false, errors: { _: message } },
			{ status: 500 }
		);
	}
}
