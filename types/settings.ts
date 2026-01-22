/**
 * Application settings and configuration types.
 */

export type TaskType =
	| "ocr"
	| "pattern_extraction"
	| "classification"
	| "comparison"
	| "generation";

export interface ModelConfig {
	task: TaskType;
	modelId: string;
	modelName: string;
}

/**
 * Application settings stored in localStorage
 */
export interface AppSettings {
	/** Notion API key (user-provided) */
	notionApiKey?: string;
	/** Whether Notion is connected and working */
	notionConnected: boolean;
	/** Selected Notion page ID for themes */
	themePageId?: string;
	/** Selected Notion page ID for strategy document */
	strategyPageId?: string;
	/** Selected Notion page ID for output/notes */
	outputPageId?: string;
	/** Model configuration per task */
	models: ModelConfig[];
	/** Custom extraction parameters (from strategy doc) */
	extractionParameters: Record<string, unknown>;
}

/**
 * Default settings for new installations
 */
export const DEFAULT_SETTINGS: AppSettings = {
	notionConnected: false,
	models: [],
	extractionParameters: {},
};

/**
 * Available LLM models for selection
 */
export interface AvailableModel {
	id: string;
	name: string;
	capabilities: ModelCapability[];
}

export type ModelCapability = "text" | "vision";

/**
 * Notion connection status
 */
export interface NotionConnectionStatus {
	connected: boolean;
	userName?: string;
	workspaceName?: string;
	error?: string;
}
