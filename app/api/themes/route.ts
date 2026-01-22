/**
 * API route for fetching and parsing themes from a Notion page.
 */

import { NextResponse } from "next/server";
import { NotionClient } from "@/lib/notion/client";
import { getThemeStats, parseThemePage } from "@/lib/notion/theme-parser";

interface ThemesRequestBody {
	apiKey: string;
	pageId: string;
}

/**
 * GET /api/themes?pageId=xxx
 * Fetches themes from a Notion page (requires API key in query or expects it from body).
 * For simplicity, this endpoint uses POST for passing the API key securely.
 */
export function GET() {
	return NextResponse.json(
		{
			error: "Use POST method with apiKey and pageId in body",
		},
		{ status: 405 }
	);
}

/**
 * POST /api/themes
 * Fetches and parses themes from a Notion page.
 *
 * Body: { apiKey: string, pageId: string }
 * Returns: { themes, pageTitle, parsedAt, stats }
 */
export async function POST(request: Request) {
	try {
		const body = (await request.json()) as ThemesRequestBody;
		const { apiKey, pageId } = body;

		// Validate required fields
		if (!apiKey) {
			return NextResponse.json(
				{ error: "API key is required" },
				{ status: 400 }
			);
		}

		if (!pageId) {
			return NextResponse.json(
				{ error: "Page ID is required" },
				{ status: 400 }
			);
		}

		// Create client and parse themes
		const client = new NotionClient(apiKey);
		const themeData = await parseThemePage(client, pageId);
		const stats = getThemeStats(themeData.themes);

		return NextResponse.json({
			themes: themeData.themes,
			pageTitle: themeData.pageTitle,
			pageId: themeData.pageId,
			parsedAt: themeData.parsedAt,
			stats,
		});
	} catch (error) {
		// Handle Notion API errors
		if (error instanceof Error) {
			// Check for common Notion errors
			if (error.message.includes("401")) {
				return NextResponse.json(
					{ error: "Invalid Notion API key" },
					{ status: 401 }
				);
			}
			if (error.message.includes("404")) {
				return NextResponse.json(
					{ error: "Page not found or not accessible" },
					{ status: 404 }
				);
			}
			if (error.message.includes("403")) {
				return NextResponse.json(
					{ error: "Access denied to this page" },
					{ status: 403 }
				);
			}

			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json(
			{ error: "Failed to parse themes" },
			{ status: 500 }
		);
	}
}
