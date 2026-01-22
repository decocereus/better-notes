/**
 * API route for processing content sources.
 * Fetches content from various source types and extracts text for LLM use.
 */

import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { NotionClient } from "@/lib/notion/client";
import { getNotionApiKey } from "@/lib/notion/config";
import { createLogger } from "@/lib/utils/logger";

const log = createLogger("api/sources/process");

interface ProcessRequestBody {
	projectId: string;
	pageId: string;
	type: "notion" | "pdf" | "image" | "url";
}

/**
 * POST /api/sources/process
 * Processes a content source and extracts text content.
 */
export async function POST(request: Request) {
	log.info("POST /api/sources/process - Starting source processing");

	try {
		const body = (await request.json()) as ProcessRequestBody;
		const { projectId, pageId, type } = body;

		log.info(`Processing source: type=${type}, pageId=${pageId}`);

		if (!(projectId && pageId && type)) {
			return NextResponse.json(
				{ error: "Missing required fields: projectId, pageId, type" },
				{ status: 400 }
			);
		}

		// Get Convex client
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			log.error("NEXT_PUBLIC_CONVEX_URL not configured");
			return NextResponse.json(
				{ error: "Server configuration error" },
				{ status: 500 }
			);
		}

		const convex = new ConvexHttpClient(convexUrl);

		// Find the source by reference (pageId)
		const project = await convex.query(api.projects.get, {
			id: projectId as Id<"projects">,
		});

		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const source = project.sources.find((s) => s.reference === pageId);
		if (!source) {
			return NextResponse.json({ error: "Source not found" }, { status: 404 });
		}

		// Update status to processing
		await convex.mutation(api.projects.updateSource, {
			id: source.id as Id<"contentSources">,
			status: "processing",
		});

		// Process based on type
		let content: string;
		let metadata: Record<string, unknown> = {};

		try {
			switch (type) {
				case "notion":
					({ content, metadata } = await processNotionSource(pageId));
					break;
				case "pdf":
				case "image":
					// PDF/image processing would go through OCR pipeline
					content = "PDF/image processing not yet implemented for sources";
					break;
				case "url":
					content = "URL processing not yet implemented";
					break;
				default:
					throw new Error(`Unknown source type: ${type}`);
			}

			// Update source with completed status and content
			await convex.mutation(api.projects.updateSource, {
				id: source.id as Id<"contentSources">,
				status: "completed",
				metadata: {
					...metadata,
					content,
					processedAt: new Date().toISOString(),
				},
			});

			log.info(
				`Source processed successfully: ${content.length} characters extracted`
			);

			return NextResponse.json({
				success: true,
				contentLength: content.length,
				metadata,
			});
		} catch (processError) {
			log.error("Processing failed:", processError);

			// Update source with failed status
			await convex.mutation(api.projects.updateSource, {
				id: source.id as Id<"contentSources">,
				status: "failed",
				metadata: {
					error:
						processError instanceof Error
							? processError.message
							: "Unknown error",
					failedAt: new Date().toISOString(),
				},
			});

			throw processError;
		}
	} catch (error) {
		log.error("Error processing source:", error);

		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to process source",
			},
			{ status: 500 }
		);
	}
}

/**
 * Process a Notion page and extract its content.
 */
async function processNotionSource(
	pageIdOrUrl: string
): Promise<{ content: string; metadata: Record<string, unknown> }> {
	const apiKey = getNotionApiKey();

	if (!apiKey) {
		throw new Error("Notion API key not configured");
	}

	// Extract page ID from URL if needed
	const pageId = extractPageId(pageIdOrUrl);
	if (!pageId) {
		throw new Error(`Invalid Notion page reference: ${pageIdOrUrl}`);
	}

	log.info(`Extracted page ID: ${pageId} from reference: ${pageIdOrUrl}`);

	const client = new NotionClient(apiKey);

	// Fetch page metadata
	const page = await client.getPage(pageId);
	log.debug(`Fetched page: ${pageId}`);

	// Extract page title
	let pageTitle = "Untitled";
	const titleProp = Object.values(page.properties).find(
		(prop) => prop.type === "title"
	);
	if (titleProp?.title?.[0]?.plain_text) {
		pageTitle = titleProp.title[0].plain_text;
	}

	// Fetch all blocks and extract text
	const blocks = await client.getPageContent(pageId);
	log.info(`Fetched ${blocks.length} blocks from page "${pageTitle}"`);

	// Extract text content from all blocks recursively
	const textParts: string[] = [];

	for (const block of blocks) {
		const text = await extractBlockTextRecursive(client, block);
		if (text.trim()) {
			textParts.push(text);
		}
	}

	const content = textParts.join("\n\n");

	return {
		content,
		metadata: {
			pageId,
			pageTitle,
			blockCount: blocks.length,
			url: page.url,
		},
	};
}

/**
 * Recursively extract text from a block and its children.
 */
async function extractBlockTextRecursive(
	client: NotionClient,
	block: {
		id: string;
		type: string;
		has_children: boolean;
		paragraph?: { rich_text: Array<{ plain_text: string }> };
		heading_1?: { rich_text: Array<{ plain_text: string }> };
		heading_2?: { rich_text: Array<{ plain_text: string }> };
		heading_3?: { rich_text: Array<{ plain_text: string }> };
		bulleted_list_item?: { rich_text: Array<{ plain_text: string }> };
		numbered_list_item?: { rich_text: Array<{ plain_text: string }> };
		toggle?: { rich_text: Array<{ plain_text: string }> };
		quote?: { rich_text: Array<{ plain_text: string }> };
		callout?: { rich_text: Array<{ plain_text: string }> };
		code?: { rich_text: Array<{ plain_text: string }>; language?: string };
		to_do?: { rich_text: Array<{ plain_text: string }>; checked?: boolean };
		child_page?: { title: string };
		child_database?: { title: string };
	}
): Promise<string> {
	const parts: string[] = [];

	// Extract text from this block
	const blockText = extractTextFromBlock(block);
	if (blockText) {
		parts.push(blockText);
	}

	// If block has children, fetch and process them
	if (block.has_children) {
		const children = await client.getBlockChildren(block.id);
		for (const child of children) {
			const childText = await extractBlockTextRecursive(client, child);
			if (childText.trim()) {
				parts.push(childText);
			}
		}
	}

	return parts.join("\n");
}

interface BlockWithRichText {
	type: string;
	paragraph?: { rich_text: Array<{ plain_text: string }> };
	heading_1?: { rich_text: Array<{ plain_text: string }> };
	heading_2?: { rich_text: Array<{ plain_text: string }> };
	heading_3?: { rich_text: Array<{ plain_text: string }> };
	bulleted_list_item?: { rich_text: Array<{ plain_text: string }> };
	numbered_list_item?: { rich_text: Array<{ plain_text: string }> };
	toggle?: { rich_text: Array<{ plain_text: string }> };
	quote?: { rich_text: Array<{ plain_text: string }> };
	callout?: { rich_text: Array<{ plain_text: string }> };
	code?: { rich_text: Array<{ plain_text: string }>; language?: string };
	to_do?: { rich_text: Array<{ plain_text: string }>; checked?: boolean };
	child_page?: { title: string };
	child_database?: { title: string };
}

/**
 * Extract text content from a single block.
 */
function extractTextFromBlock(block: BlockWithRichText): string {
	const { type } = block;

	// Helper to extract text from rich_text array
	const extractRichText = (
		richText?: Array<{ plain_text: string }>
	): string => {
		if (!richText) {
			return "";
		}
		return richText.map((rt) => rt.plain_text).join("");
	};

	switch (type) {
		case "paragraph":
			return extractRichText(block.paragraph?.rich_text);
		case "heading_1":
			return `# ${extractRichText(block.heading_1?.rich_text)}`;
		case "heading_2":
			return `## ${extractRichText(block.heading_2?.rich_text)}`;
		case "heading_3":
			return `### ${extractRichText(block.heading_3?.rich_text)}`;
		case "bulleted_list_item":
			return `• ${extractRichText(block.bulleted_list_item?.rich_text)}`;
		case "numbered_list_item":
			return `- ${extractRichText(block.numbered_list_item?.rich_text)}`;
		case "toggle":
			return extractRichText(block.toggle?.rich_text);
		case "quote":
			return `> ${extractRichText(block.quote?.rich_text)}`;
		case "callout":
			return `📌 ${extractRichText(block.callout?.rich_text)}`;
		case "to_do": {
			const text = extractRichText(block.to_do?.rich_text);
			const checked = block.to_do?.checked ?? false;
			return `[${checked ? "x" : " "}] ${text}`;
		}
		case "code": {
			const text = extractRichText(block.code?.rich_text);
			const language = block.code?.language ?? "";
			return `\`\`\`${language}\n${text}\n\`\`\``;
		}
		case "child_page":
			return block.child_page?.title ? `[Page: ${block.child_page.title}]` : "";
		case "child_database":
			return block.child_database?.title
				? `[Database: ${block.child_database.title}]`
				: "";
		default:
			return "";
	}
}

// Regex patterns for extracting Notion page IDs from various URL formats
const NOTION_PAGE_ID_PATTERNS = [
	// Full URL with ID at end: notion.so/workspace/Page-Title-abc123def456...
	/notion\.(?:so|site)\/.*?([a-f0-9]{32})(?:[?#]|$)/i,
	// UUID format with dashes: abc12345-def6-7890-abcd-ef1234567890
	/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i,
	// Just the 32-char ID: abc123def456...
	/^([a-f0-9]{32})$/i,
];

/**
 * Extracts a Notion page ID from a URL or raw ID string.
 * Returns null if the input is not a valid Notion page reference.
 */
function extractPageId(urlOrId: string): string | null {
	const trimmed = urlOrId.trim();

	for (const pattern of NOTION_PAGE_ID_PATTERNS) {
		const match = trimmed.match(pattern);
		if (match?.[1]) {
			// Remove dashes from UUID format to get 32-char ID
			return match[1].replace(/-/g, "");
		}
	}

	return null;
}
