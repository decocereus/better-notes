/**
 * Notion page fetcher utilities.
 * Extracts page IDs from URLs and fetches page content.
 */

import { parseBlocksToText } from "./block-parser";
import type { NotionClient } from "./client";
import type { NotionBlock, NotionPage } from "./types";

// Regex patterns for extracting Notion page IDs from various URL formats
const NOTION_PAGE_ID_PATTERNS = [
	// Full URL with ID at end: notion.so/workspace/Page-Title-abc123def456...
	/notion\.(?:so|site)\/.*?([a-f0-9]{32})(?:[?#]|$)/i,
	// UUID format with dashes: abc12345-def6-7890-abcd-ef1234567890
	/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
	// Just the 32-char ID: abc123def456...
	/^([a-f0-9]{32})$/i,
];

/**
 * Result of fetching a Notion page.
 */
export interface FetchedPage {
	id: string;
	title: string;
	url: string;
	content: string;
	blocks: NotionBlock[];
}

/**
 * Extracts a Notion page ID from a URL or raw ID string.
 *
 * Handles various formats:
 * - Full Notion URL: https://notion.so/workspace/Page-Title-abc123...
 * - notion.site URLs: https://workspace.notion.site/Page-abc123...
 * - UUID with dashes: abc12345-def6-7890-abcd-ef1234567890
 * - Raw 32-character ID: abc123def456789012345678901234567
 *
 * @param urlOrId - URL or ID string to extract from
 * @returns The 32-character page ID without dashes, or null if invalid
 */
export function extractPageIdFromUrl(urlOrId: string): string | null {
	const trimmed = urlOrId.trim();

	for (const pattern of NOTION_PAGE_ID_PATTERNS) {
		const match = trimmed.match(pattern);
		if (match?.[1]) {
			// Remove dashes from UUID format to get 32-char ID
			return match[1].replace(/-/g, "");
		}
	}

	return null;
}

/**
 * Extracts the page title from a Notion page object.
 * Handles both page title property and database title array.
 *
 * @param page - The Notion page object
 * @returns The page title or "Untitled" if not found
 */
export function extractPageTitle(page: NotionPage): string {
	// Try to find the title property
	const titleProp = Object.values(page.properties).find(
		(prop) => prop.type === "title"
	);

	if (titleProp?.title?.[0]?.plain_text) {
		return titleProp.title[0].plain_text;
	}

	return "Untitled";
}

/**
 * Fetches a Notion page including its title and content.
 *
 * @param client - The Notion client to use
 * @param pageIdOrUrl - Page ID or URL to fetch
 * @returns The fetched page with title, content, and blocks
 * @throws Error if the page ID is invalid or the page cannot be fetched
 */
export async function fetchPageContent(
	client: NotionClient,
	pageIdOrUrl: string
): Promise<FetchedPage> {
	const pageId = extractPageIdFromUrl(pageIdOrUrl);

	if (!pageId) {
		throw new Error("Invalid Notion page URL or ID");
	}

	// Fetch page metadata and content in parallel
	const [page, blocks] = await Promise.all([
		client.getPage(pageId),
		client.getPageContent(pageId),
	]);

	const title = extractPageTitle(page);
	const content = parseBlocksToText(blocks);

	return {
		id: pageId,
		title,
		url: page.url,
		content,
		blocks,
	};
}

/**
 * Validates if a string is a valid Notion URL or page ID.
 *
 * @param urlOrId - The string to validate
 * @returns True if valid, false otherwise
 */
export function isValidNotionPageReference(urlOrId: string): boolean {
	return extractPageIdFromUrl(urlOrId) !== null;
}
