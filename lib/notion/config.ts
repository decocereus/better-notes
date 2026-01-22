/**
 * Notion configuration helper.
 * Provides the API key from environment variable or request body.
 */

/**
 * Gets the Notion API key, prioritizing env variable over request body.
 * @param requestApiKey - API key from request body (fallback)
 * @returns The API key to use, or null if none available
 */
export function getNotionApiKey(requestApiKey?: string): string | null {
	// Prefer env variable
	const envKey = process.env.NOTION_API_KEY;
	if (envKey) {
		return envKey;
	}

	// Fall back to request body
	if (requestApiKey) {
		return requestApiKey;
	}

	return null;
}

/**
 * Checks if the Notion API key is configured via environment variable.
 * @returns True if NOTION_API_KEY env variable is set
 */
export function hasEnvApiKey(): boolean {
	return Boolean(process.env.NOTION_API_KEY);
}
