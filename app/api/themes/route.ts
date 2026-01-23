/**
 * API route for fetching and parsing themes from a Notion page.
 */

import { NextResponse } from "next/server";
import { NotionClient } from "@/lib/notion/client";
import { getNotionApiKey, hasEnvApiKey } from "@/lib/notion/config";
import { getThemeStats, parseThemePage } from "@/lib/notion/theme-parser";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api/themes");

interface ThemesRequestBody {
	pageId: string;
}

/**
 * GET /api/themes?pageId=xxx
 * Fetches themes from a Notion page.
 * For simplicity, this endpoint uses POST for passing pageId securely.
 */
export function GET() {
	return NextResponse.json(
		{
			error: "Use POST method with pageId in body",
		},
		{ status: 405 }
	);
}

/**
 * POST /api/themes
 * Fetches and parses themes from a Notion page.
 * Uses NOTION_API_KEY environment variable only.
 *
 * Body: { pageId: string }
 * Returns: { themes, pageTitle, parsedAt, stats }
 */
export async function POST(request: Request) {
	log.info("POST /api/themes - Starting theme parsing request");

	if (!hasEnvApiKey()) {
		log.warn("NOTION_API_KEY not configured");
		return NextResponse.json(
			{
				error:
					"NOTION_API_KEY environment variable not configured. Add it to your .env.local file.",
			},
			{ status: 400 }
		);
	}

	try {
		const body = (await request.json()) as ThemesRequestBody;
		const { pageId } = body;

		log.info(`Parsing themes for pageId: ${pageId}`);

		if (!pageId) {
			log.warn("No pageId provided");
			return NextResponse.json(
				{ error: "Page ID is required" },
				{ status: 400 }
			);
		}

		// Create client and parse themes
		const apiKey = getNotionApiKey();
		const client = new NotionClient(apiKey);
		log.info("Starting parseThemePage...");
		const themeData = await parseThemePage(client, pageId);
		const stats = getThemeStats(themeData.themes);

		log.info(
			`Theme parsing complete: ${stats.totalMainThemes} main themes, ` +
				`${stats.totalMiniThemes} mini themes, ${stats.totalQuestions} questions`
		);

		return NextResponse.json({
			themes: themeData.themes,
			pageTitle: themeData.pageTitle,
			pageId: themeData.pageId,
			parsedAt: themeData.parsedAt,
			stats,
		});
	} catch (error) {
		log.error("Error parsing themes:", error);

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
