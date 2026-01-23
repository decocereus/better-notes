/**
 * API route for checking if a Notion page is already added as a theme page.
 */

import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

/**
 * GET /api/notion/check-duplicate?pageId=xxx
 * Checks if a Notion page ID is already saved as a theme page.
 *
 * Returns: { exists: boolean, title?: string }
 */
export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const pageId = searchParams.get("pageId");

	if (!pageId) {
		return NextResponse.json(
			{ error: "pageId query parameter is required" },
			{ status: 400 }
		);
	}

	if (!convexUrl) {
		return NextResponse.json(
			{ error: "Convex not configured" },
			{ status: 500 }
		);
	}

	try {
		const convex = new ConvexHttpClient(convexUrl);
		const existing = await convex.query(api.themePages.getByNotionId, {
			notionPageId: pageId,
		});

		if (existing) {
			return NextResponse.json({
				exists: true,
				title: existing.title,
			});
		}

		return NextResponse.json({ exists: false });
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Failed to check for duplicate";
		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}
