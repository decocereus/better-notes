import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { NotionAPIError, NotionClient } from "@/lib/notion/client";
import { getNotionApiKey, hasEnvApiKey } from "@/lib/notion/config";
import type { SearchResultItem } from "@/lib/notion/types";

interface SearchRequest {
	query?: string;
}

interface SearchResponse {
	results?: SearchResultItem[];
	error?: string;
}

/**
 * GET /api/notion/search
 * Searches the Notion workspace for pages and databases.
 * Uses NOTION_API_KEY env variable only.
 *
 * Query params: q (search query), type (page or database)
 * Response: { results: SearchResultItem[], error?: string }
 */
export async function GET(
	request: NextRequest
): Promise<NextResponse<SearchResponse>> {
	if (!hasEnvApiKey()) {
		return NextResponse.json(
			{ error: "NOTION_API_KEY environment variable not configured" },
			{ status: 400 }
		);
	}

	try {
		const searchParams = request.nextUrl.searchParams;
		const query = searchParams.get("q") || "";
		const filterType = searchParams.get("type");
		const apiKey = getNotionApiKey();

		const client = new NotionClient(apiKey);
		let results = await client.searchSimplified(query);

		// Filter by type if specified
		if (filterType === "page" || filterType === "database") {
			results = results.filter((r) => r.type === filterType);
		}

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

/**
 * POST /api/notion/search
 * Searches the Notion workspace for pages and databases.
 * Uses NOTION_API_KEY env variable only.
 *
 * Request body: { query?: string }
 * Response: { results: SearchResultItem[], error?: string }
 */
export async function POST(
	request: Request
): Promise<NextResponse<SearchResponse>> {
	if (!hasEnvApiKey()) {
		return NextResponse.json(
			{
				error:
					"NOTION_API_KEY environment variable not configured. Add it to your .env.local file.",
			},
			{ status: 400 }
		);
	}

	try {
		const body = (await request.json()) as SearchRequest;
		const { query = "" } = body;
		const apiKey = getNotionApiKey();

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
