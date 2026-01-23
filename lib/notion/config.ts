/**
 * Notion configuration helper.
 * Provides the API key from environment variable only.
 */

/**
 * Gets the Notion API key from environment variable.
 * @throws Error if NOTION_API_KEY is not configured
 * @returns The API key
 */
export function getNotionApiKey(): string {
	const envKey = process.env.NOTION_API_KEY;
	if (!envKey) {
		throw new Error(
			"NOTION_API_KEY environment variable is not configured. " +
				"Please add it to your .env.local file."
		);
	}
	return envKey;
}

/**
 * Checks if the Notion API key is configured via environment variable.
 * @returns True if NOTION_API_KEY env variable is set
 */
export function hasEnvApiKey(): boolean {
	return Boolean(process.env.NOTION_API_KEY);
}
