/**
 * Typed environment variable access with validation.
 * All environment variables should be accessed through this module.
 */

export const env = {
	NOTION_API_KEY: process.env.NOTION_API_KEY ?? "",
	OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
	// Google AI for direct Gemini access (bypasses OpenRouter's 5MB file limit)
	GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
	// Anthropic API for Claude fallback OCR
	ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
	// CloudConvert API for PDF-to-image conversion
	CLOUDCONVERT_API_KEY: process.env.CLOUDCONVERT_API_KEY ?? "",
	// Cloudflare R2 Storage
	R2_ENDPOINT: process.env.R2_ENDPOINT ?? "",
	R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID ?? "",
	R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY ?? "",
	R2_BUCKET_NAME: process.env.R2_BUCKET_NAME ?? "",
} as const;

export type EnvKey = keyof typeof env;

interface ValidationResult {
	valid: boolean;
	missing: EnvKey[];
}

/**
 * Validates that all required environment variables are set.
 * @returns Object with validation status and list of missing variables
 */
export function validateEnv(): ValidationResult {
	const missing = (Object.keys(env) as EnvKey[]).filter((key) => !env[key]);

	return {
		valid: missing.length === 0,
		missing,
	};
}

/**
 * Validates only the critical environment variables needed for core functionality.
 * OPENROUTER_API_KEY is required for LLM operations.
 */
export function validateCriticalEnv(): ValidationResult {
	const criticalKeys: EnvKey[] = ["OPENROUTER_API_KEY"];
	const missing = criticalKeys.filter((key) => !env[key]);

	return {
		valid: missing.length === 0,
		missing,
	};
}
