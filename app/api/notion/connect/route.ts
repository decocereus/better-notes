import { NextResponse } from "next/server";

import { NotionClient } from "@/lib/notion/client";
import { getNotionApiKey, hasEnvApiKey } from "@/lib/notion/config";

interface ConnectResponse {
	valid: boolean;
	user?: string;
	error?: string;
}

/**
 * GET /api/notion/connect
 * Checks if Notion is configured and tests the connection.
 * Uses NOTION_API_KEY environment variable only.
 *
 * Response: { valid: boolean, user?: string, error?: string }
 */
export async function GET(): Promise<NextResponse<ConnectResponse>> {
	if (!hasEnvApiKey()) {
		return NextResponse.json({
			valid: false,
			error: "NOTION_API_KEY environment variable not configured",
		});
	}

	try {
		const apiKey = getNotionApiKey();
		const client = new NotionClient(apiKey);
		const result = await client.testConnection();

		return NextResponse.json(result);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Connection test failed";
		return NextResponse.json({ valid: false, error: message }, { status: 500 });
	}
}

/**
 * POST /api/notion/connect
 * Tests the Notion API connection.
 * Uses NOTION_API_KEY environment variable only.
 *
 * Response: { valid: boolean, user?: string, error?: string }
 */
export async function POST(): Promise<NextResponse<ConnectResponse>> {
	if (!hasEnvApiKey()) {
		return NextResponse.json(
			{
				valid: false,
				error:
					"NOTION_API_KEY environment variable not configured. Add it to your .env.local file.",
			},
			{ status: 400 }
		);
	}

	try {
		const apiKey = getNotionApiKey();
		const client = new NotionClient(apiKey);
		const result = await client.testConnection();

		return NextResponse.json(result);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Connection test failed";
		return NextResponse.json({ valid: false, error: message }, { status: 500 });
	}
}
