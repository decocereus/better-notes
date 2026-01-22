import { NextResponse } from "next/server";
import { noteToNotionBlocks } from "@/lib/notion/block-builder";
import { NotionAPIError, NotionClient } from "@/lib/notion/client";
import { getNotionApiKey } from "@/lib/notion/config";
import type { GeneratedNote, SyncResult } from "@/types/generation";

interface SyncRequest {
	/** The generated note to sync */
	note: GeneratedNote;
	/** Notion page ID to sync to */
	destinationPageId: string;
	/** Whether to append or replace content */
	mode?: "append" | "replace";
}

interface SyncResponse {
	success: boolean;
	result?: SyncResult;
	error?: string;
}

/**
 * POST /api/notion/sync
 * Syncs a generated note to a Notion page.
 * Uses NOTION_API_KEY env variable for authentication.
 *
 * Request body: { note: GeneratedNote, destinationPageId: string, mode?: "append" | "replace" }
 * Response: { success: boolean, result?: SyncResult, error?: string }
 */
export async function POST(
	request: Request
): Promise<NextResponse<SyncResponse>> {
	try {
		const body = (await request.json()) as SyncRequest;
		const { note, destinationPageId, mode = "append" } = body;

		// Validate inputs
		if (!note) {
			return NextResponse.json(
				{ success: false, error: "Note is required" },
				{ status: 400 }
			);
		}

		if (!destinationPageId) {
			return NextResponse.json(
				{ success: false, error: "Destination page ID is required" },
				{ status: 400 }
			);
		}

		const apiKey = getNotionApiKey();
		if (!apiKey) {
			return NextResponse.json(
				{
					success: false,
					error:
						"No API key configured. Set NOTION_API_KEY environment variable.",
				},
				{ status: 400 }
			);
		}

		const client = new NotionClient(apiKey);

		// Verify page exists and is accessible
		try {
			await client.getPage(destinationPageId);
		} catch (error) {
			if (error instanceof NotionAPIError && error.status === 404) {
				return NextResponse.json(
					{
						success: false,
						error:
							"Page not found. Make sure the page exists and the integration has access.",
					},
					{ status: 404 }
				);
			}
			throw error;
		}

		// If replace mode, delete existing content first
		if (mode === "replace") {
			const existingBlocks = await client.getPageContent(destinationPageId);
			for (const block of existingBlocks) {
				await client.deleteBlock(block.id);
			}
		}

		// Convert note to Notion blocks
		const blocks = noteToNotionBlocks(note);

		// Append blocks to page
		const response = await client.appendChildren(destinationPageId, blocks);

		// Extract created block IDs
		const blockIds = response.results.map((block) => block.id);

		const result: SyncResult = {
			success: true,
			noteId: note.id,
			notionPageId: destinationPageId,
			blockIds,
			syncedAt: new Date().toISOString(),
		};

		return NextResponse.json({ success: true, result });
	} catch (error) {
		if (error instanceof NotionAPIError) {
			return NextResponse.json(
				{ success: false, error: error.message },
				{ status: error.status }
			);
		}

		const message = error instanceof Error ? error.message : "Sync failed";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
