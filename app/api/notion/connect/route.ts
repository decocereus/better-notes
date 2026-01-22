import { NextResponse } from "next/server";

import { NotionClient } from "@/lib/notion/client";
import { getNotionApiKey, hasEnvApiKey } from "@/lib/notion/config";

interface ConnectRequest {
	apiKey?: string;
}

interface ConnectResponse {
	valid: boolean;
	user?: string;
	error?: string;
	source?: "env" | "request";
}

/**
 * POST /api/notion/connect
 * Tests the Notion API connection.
 * Uses NOTION_API_KEY env variable if set, otherwise uses apiKey from request body.
 *
 * Request body: { apiKey?: string }
 * Response: { valid: boolean, user?: string, error?: string, source?: string }
 */
export async function POST(
	request: Request
): Promise<NextResponse<ConnectResponse>> {
	try {
		const body = (await request.json().catch(() => ({}))) as ConnectRequest;
		const apiKey = getNotionApiKey(body.apiKey);

		if (!apiKey) {
			return NextResponse.json(
				{
					valid: false,
					error:
						"No API key configured. Set NOTION_API_KEY environment variable or provide apiKey in request.",
				},
				{ status: 400 }
			);
		}

		const client = new NotionClient(apiKey);
		const result = await client.testConnection();

		return NextResponse.json({
			...result,
			source: hasEnvApiKey() ? "env" : "request",
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Connection test failed";
		return NextResponse.json({ valid: false, error: message }, { status: 500 });
	}
}

/**
 * GET /api/notion/connect
 * Checks if Notion is configured (env variable exists).
 */
export async function GET(): Promise<NextResponse<ConnectResponse>> {
	const hasKey = hasEnvApiKey();

	if (!hasKey) {
		return NextResponse.json({
			valid: false,
			error: "NOTION_API_KEY environment variable not set",
		});
	}

	// Test the connection with env key
	const apiKey = getNotionApiKey();
	if (!apiKey) {
		return NextResponse.json({
			valid: false,
			error: "API key not available",
		});
	}

	try {
		const client = new NotionClient(apiKey);
		const result = await client.testConnection();

		return NextResponse.json({
			...result,
			source: "env",
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Connection test failed";
		return NextResponse.json({ valid: false, error: message }, { status: 500 });
	}
}
