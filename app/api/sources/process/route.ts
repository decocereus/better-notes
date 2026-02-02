/**
 * API route for processing content sources.
 * Fetches content from various source types and extracts text for LLM use.
 */

import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { getModelForTask } from "@/lib/llm/provider";
import { getNotionApiKey } from "@/lib/notion/config";
import {
	extractUserContentFromFetched,
	fetchUserContent,
	getUserContentStats,
} from "@/lib/notion/content-fetcher";
import { createLogger } from "@/lib/utils/logger";
import type { ExtractionParameters } from "@/types/extraction";
import { DEFAULT_EXTRACTION_PARAMETERS } from "@/types/extraction";

const log = createLogger("api/sources/process");

interface ProcessRequestBody {
	projectId: string;
	pageId: string;
	type: "notion" | "pdf" | "image" | "url";
	modelConfig?: Record<string, string>;
	parameters?: ExtractionParameters;
}

/**
 * POST /api/sources/process
 * Processes a content source and extracts text content.
 */
export async function POST(request: Request) {
	log.info("POST /api/sources/process - Starting source processing");

	try {
		const body = (await request.json()) as ProcessRequestBody;
		const { projectId, pageId, type, modelConfig, parameters } = body;

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
					({ content, metadata } = await processNotionSource(
						pageId,
						parameters ?? DEFAULT_EXTRACTION_PARAMETERS,
						getModelForTask("pattern_extraction", modelConfig)
					));
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
	pageIdOrUrl: string,
	parameters: ExtractionParameters,
	modelId?: string
): Promise<{ content: string; metadata: Record<string, unknown> }> {
	const apiKey = getNotionApiKey();
	const userContent = await fetchUserContent(pageIdOrUrl, apiKey);
	const extractedContent = await extractUserContentFromFetched(
		userContent,
		parameters,
		modelId
	);
	const extractionStats = getUserContentStats(extractedContent);
	const content = userContent.text;

	return {
		content,
		metadata: {
			pageId: userContent.pageId,
			pageTitle: userContent.title,
			blockCount: userContent.blockCount,
			url: userContent.url,
			wordCount: userContent.wordCount,
			imageCount: userContent.images.length,
			extraction: {
				items: extractedContent,
				stats: {
					totalItems: extractionStats.totalItems,
					byType: extractionStats.byType,
					byQuality: extractionStats.byQuality,
				},
				parameters,
				extractedAt: new Date().toISOString(),
			},
		},
	};
}
