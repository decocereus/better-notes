/**
 * Notion API client using REST API (v2025-09-03).
 * Provides typed methods for common Notion operations.
 */

import type {
	NotionBlock,
	NotionBlocksResponse,
	NotionPage,
	NotionSearchResult,
	NotionUser,
	SearchResultItem,
} from "./types";

const NOTION_VERSION = "2025-09-03";
const BASE_URL = "https://api.notion.com/v1";

/**
 * Custom error class for Notion API errors.
 * Includes the HTTP status code for error handling.
 */
export class NotionAPIError extends Error {
	readonly status: number;

	constructor(status: number, message: string) {
		super(`Notion API Error (${status}): ${message}`);
		this.name = "NotionAPIError";
		this.status = status;
	}
}

/**
 * Notion API client for interacting with the Notion REST API.
 */
export class NotionClient {
	private readonly apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	/**
	 * Makes an authenticated request to the Notion API.
	 */
	private async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const res = await fetch(`${BASE_URL}${endpoint}`, {
			...options,
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Notion-Version": NOTION_VERSION,
				"Content-Type": "application/json",
				...options.headers,
			},
		});

		if (!res.ok) {
			const error = await res.json().catch(() => ({}));
			const message =
				(error as { message?: string }).message ?? "Unknown error";
			throw new NotionAPIError(res.status, message);
		}

		return res.json() as Promise<T>;
	}

	/**
	 * Tests the API connection by fetching the current user.
	 * @returns Object with connection validity and user name if successful
	 */
	async testConnection(): Promise<{ valid: boolean; user?: string }> {
		try {
			const user = await this.request<NotionUser>("/users/me");
			return { valid: true, user: user.name };
		} catch {
			return { valid: false };
		}
	}

	/**
	 * Searches the Notion workspace for pages and databases.
	 * @param query - Search query string (empty for all accessible items)
	 * @returns Search results with pages and databases
	 */
	search(query = ""): Promise<NotionSearchResult> {
		return this.request<NotionSearchResult>("/search", {
			method: "POST",
			body: JSON.stringify({
				query,
				sort: {
					direction: "descending",
					timestamp: "last_edited_time",
				},
			}),
		});
	}

	/**
	 * Searches and returns simplified results for UI display.
	 * @param query - Search query string
	 * @returns Array of simplified search result items
	 */
	async searchSimplified(query = ""): Promise<SearchResultItem[]> {
		const results = await this.search(query);
		return results.results.map((item) => this.toSearchResultItem(item));
	}

	/**
	 * Gets a page by ID.
	 * @param pageId - The Notion page ID
	 * @returns The page object
	 */
	getPage(pageId: string): Promise<NotionPage> {
		return this.request<NotionPage>(`/pages/${pageId}`);
	}

	/**
	 * Gets all blocks from a page, handling pagination.
	 * @param pageId - The page ID to fetch blocks from
	 * @returns Array of all blocks in the page
	 */
	async getPageContent(pageId: string): Promise<NotionBlock[]> {
		const blocks: NotionBlock[] = [];
		let cursor: string | undefined;

		do {
			const endpoint = `/blocks/${pageId}/children${cursor ? `?start_cursor=${cursor}` : ""}`;
			const response = await this.request<NotionBlocksResponse>(endpoint);
			blocks.push(...response.results);
			cursor = response.has_more
				? (response.next_cursor ?? undefined)
				: undefined;
		} while (cursor);

		return blocks;
	}

	/**
	 * Gets children of a specific block (for nested content like toggles).
	 * @param blockId - The block ID to fetch children from
	 * @returns Array of child blocks
	 */
	async getBlockChildren(blockId: string): Promise<NotionBlock[]> {
		const blocks: NotionBlock[] = [];
		let cursor: string | undefined;

		do {
			const endpoint = `/blocks/${blockId}/children${cursor ? `?start_cursor=${cursor}` : ""}`;
			const response = await this.request<NotionBlocksResponse>(endpoint);
			blocks.push(...response.results);
			cursor = response.has_more
				? (response.next_cursor ?? undefined)
				: undefined;
		} while (cursor);

		return blocks;
	}

	/**
	 * Appends blocks to a page or block.
	 * @param parentId - The page or block ID to append to
	 * @param children - Array of block objects to append
	 * @returns Response with created blocks
	 */
	appendChildren(
		parentId: string,
		children: unknown[]
	): Promise<NotionBlocksResponse> {
		return this.request<NotionBlocksResponse>(`/blocks/${parentId}/children`, {
			method: "PATCH",
			body: JSON.stringify({ children }),
		});
	}

	/**
	 * Deletes a block by ID.
	 * @param blockId - The block ID to delete
	 */
	async deleteBlock(blockId: string): Promise<void> {
		await this.request(`/blocks/${blockId}`, {
			method: "DELETE",
		});
	}

	/**
	 * Converts a Notion page or database to a simplified search result item.
	 */
	private toSearchResultItem(
		item:
			| NotionPage
			| {
					object: "database";
					id: string;
					title: { plain_text: string }[];
					icon: { emoji?: string } | null;
					url: string;
			  }
	): SearchResultItem {
		const isPage = item.object === "page";

		let title = "Untitled";
		if (isPage) {
			// Extract title from page properties
			const page = item as NotionPage;
			const titleProp = Object.values(page.properties).find(
				(prop) => prop.type === "title"
			);
			if (titleProp?.title?.[0]?.plain_text) {
				title = titleProp.title[0].plain_text;
			}
		} else {
			// Database title is in the title array
			const db = item as { title: { plain_text: string }[] };
			if (db.title?.[0]?.plain_text) {
				title = db.title[0].plain_text;
			}
		}

		// Extract icon
		let icon: string | null = null;
		if (item.icon?.emoji) {
			icon = item.icon.emoji;
		}

		return {
			id: item.id,
			title,
			type: isPage ? "page" : "database",
			icon,
			url: item.url,
		};
	}
}
