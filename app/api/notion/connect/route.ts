import { NextResponse } from "next/server";

import { NotionClient } from "@/lib/notion/client";

interface ConnectRequest {
	apiKey: string;
}

interface ConnectResponse {
	valid: boolean;
	user?: string;
	error?: string;
}

/**
 * POST /api/notion/connect
 * Tests the Notion API connection with the provided API key.
 *
 * Request body: { apiKey: string }
 * Response: { valid: boolean, user?: string, error?: string }
 */
export async function POST(
	request: Request
): Promise<NextResponse<ConnectResponse>> {
	try {
		const body = (await request.json()) as ConnectRequest;
		const { apiKey } = body;

		if (!apiKey) {
			return NextResponse.json(
				{ valid: false, error: "API key is required" },
				{ status: 400 }
			);
		}

		const client = new NotionClient(apiKey);
		const result = await client.testConnection();

		return NextResponse.json(result);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Connection test failed";
		return NextResponse.json({ valid: false, error: message }, { status: 500 });
	}
}
