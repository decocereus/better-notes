/**
 * API route for fetching and parsing themes from a Notion page.
 */

import { NextResponse } from "next/server";
import { NotionClient } from "@/lib/notion/client";
import { getNotionApiKey } from "@/lib/notion/config";
import { getThemeStats, parseThemePage } from "@/lib/notion/theme-parser";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api/themes");

interface ThemesRequestBody {
	apiKey?: string;
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
			error: "Use POST method with pageId in body",
		},
		{ status: 405 }
	);
}

/**
 * POST /api/themes
 * Fetches and parses themes from a Notion page.
 * Uses NOTION_API_KEY env variable if set, otherwise uses apiKey from request body.
 *
 * Body: { apiKey?: string, pageId: string }
 * Returns: { themes, pageTitle, parsedAt, stats }
 */
export async function POST(request: Request) {
	log.info("POST /api/themes - Starting theme parsing request");

	try {
		const body = (await request.json()) as ThemesRequestBody;
		const { pageId } = body;
		const apiKey = getNotionApiKey(body.apiKey);

		log.info(`Parsing themes for pageId: ${pageId}`);
		log.debug(`API key present: ${!!apiKey}, from body: ${!!body.apiKey}`);

		// Validate required fields
		if (!apiKey) {
			log.warn("No API key configured");
			return NextResponse.json(
				{
					error:
						"No API key configured. Set NOTION_API_KEY environment variable or provide apiKey in request.",
				},
				{ status: 400 }
			);
		}

		if (!pageId) {
			log.warn("No pageId provided");
			return NextResponse.json(
				{ error: "Page ID is required" },
				{ status: 400 }
			);
		}

		// Create client and parse themes
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
