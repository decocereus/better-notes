/**
 * Typed environment variable access with validation.
 * All environment variables should be accessed through this module.
 */

export const env = {
	NOTION_API_KEY: process.env.NOTION_API_KEY ?? "",
	OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ?? "",
	BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ?? "",
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
