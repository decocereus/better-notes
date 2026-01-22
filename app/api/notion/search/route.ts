import { NextResponse } from "next/server";

import { NotionAPIError, NotionClient } from "@/lib/notion/client";
import type { SearchResultItem } from "@/lib/notion/types";

interface SearchRequest {
	apiKey: string;
	query?: string;
}

interface SearchResponse {
	results?: SearchResultItem[];
	error?: string;
}

/**
 * POST /api/notion/search
 * Searches the Notion workspace for pages and databases.
 *
 * Request body: { apiKey: string, query?: string }
 * Response: { results: SearchResultItem[], error?: string }
 */
export async function POST(
	request: Request
): Promise<NextResponse<SearchResponse>> {
	try {
		const body = (await request.json()) as SearchRequest;
		const { apiKey, query = "" } = body;

		if (!apiKey) {
			return NextResponse.json(
				{ error: "API key is required" },
				{ status: 400 }
			);
		}

		const client = new NotionClient(apiKey);
		const results = await client.searchSimplified(query);

		return NextResponse.json({ results });
	} catch (error) {
		if (error instanceof NotionAPIError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status }
			);
		}

		const message = error instanceof Error ? error.message : "Search failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
