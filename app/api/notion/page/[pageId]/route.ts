import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { NotionAPIError, NotionClient } from "@/lib/notion/client";
import { getNotionApiKey } from "@/lib/notion/config";

interface PageInfoResponse {
	id: string;
	title: string;
	icon: string | null;
	url: string;
	type: "page";
	error?: string;
}

/**
 * GET /api/notion/page/[pageId]
 * Gets information about a specific Notion page.
 * Uses NOTION_API_KEY env variable.
 *
 * Response: { id, title, icon, url, type: "page" }
 */
export async function GET(
	_request: NextRequest,
	{ params }: { params: Promise<{ pageId: string }> }
): Promise<NextResponse<PageInfoResponse | { error: string }>> {
	try {
		const { pageId } = await params;
		const apiKey = getNotionApiKey();

		if (!apiKey) {
			return NextResponse.json(
				{
					error:
						"No API key configured. Set NOTION_API_KEY environment variable.",
				},
				{ status: 400 }
			);
		}

		if (!pageId) {
			return NextResponse.json(
				{ error: "Page ID is required" },
				{ status: 400 }
			);
		}

		const client = new NotionClient(apiKey);
		const page = await client.getPage(pageId);

		// Extract title from page properties
		let title = "Untitled";
		const titleProp = Object.values(page.properties).find(
			(prop) => prop.type === "title"
		);
		if (titleProp?.title?.[0]?.plain_text) {
			title = titleProp.title[0].plain_text;
		}

		// Extract icon
		let icon: string | null = null;
		if (page.icon?.emoji) {
			icon = page.icon.emoji;
		}

		return NextResponse.json({
			id: page.id,
			title,
			icon,
			url: page.url,
			type: "page",
		});
	} catch (error) {
		if (error instanceof NotionAPIError) {
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status }
			);
		}

		const message =
			error instanceof Error ? error.message : "Failed to fetch page info";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
