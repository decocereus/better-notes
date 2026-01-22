/**
 * LLM module exports.
 *
 * Provides LLM provider configuration, model definitions,
 * and utilities for working with language models.
 */

export {
	// Constants
	AVAILABLE_MODELS,
	// Types
	type AvailableModel,
	// Provider
	createLLMProvider,
	DEFAULT_MODEL_CONFIG,
	// Model utilities
	getModelById,
	getModelForTask,
	getModelsForTask,
	getModelsWithCapability,
	isValidModel,
	type ModelCapability,
	TASK_DEFINITIONS,
	type TaskDefinition,
	type TaskType,
} from "./provider";

export {
	// Types
	type LLMTestResult,
	// Test utilities
	testLLMConnection,
	testMultipleModels,
} from "./test";
