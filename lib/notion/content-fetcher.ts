/**
 * User Content Fetcher
 * Fetches and extracts content from user's Notion pages for classification.
 * Converts Notion content into ExtractedContent format.
 */

import { generateText, Output } from "ai";
import { getModel } from "@/lib/ai/client";
import {
	assessMultiUse,
	calculateQuality,
	isOverusedExample,
} from "@/lib/extraction/quality";
import {
	createExtractionPrompt,
	EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/llm/prompts/extraction";
import { ExtractionResultSchema } from "@/lib/llm/schemas/extraction";
import type {
	ExtractedContent,
	ExtractionParameters,
} from "@/types/extraction";
import { NotionClient } from "./client";
import { fetchPageContent } from "./page-fetcher";
import type { NotionBlock } from "./types";

/**
 * Regex for splitting text into words.
 */
const WORD_SPLIT_REGEX = /\s+/;

/**
 * Result of fetching user content.
 */
export interface UserContentFetchResult {
	/** Notion page ID */
	pageId: string;
	/** Page title */
	title: string;
	/** Raw text content */
	text: string;
	/** Image URLs found in the page */
	images: string[];
	/** Word count */
	wordCount: number;
}

/**
 * Fetches user content from a Notion page.
 *
 * @param pageIdOrUrl - The Notion page ID or URL
 * @param apiKey - The Notion API key
 * @returns The fetched user content
 */
export async function fetchUserContent(
	pageIdOrUrl: string,
	apiKey: string
): Promise<UserContentFetchResult> {
	const client = new NotionClient(apiKey);
	const page = await fetchPageContent(client, pageIdOrUrl);

	const images = extractImageUrls(page.blocks);
	const wordCount = page.content.split(WORD_SPLIT_REGEX).filter(Boolean).length;

	return {
		pageId: page.id,
		title: page.title,
		text: page.content,
		images,
		wordCount,
	};
}

/**
 * Extracts image URLs from Notion blocks.
 */
function extractImageUrls(blocks: NotionBlock[]): string[] {
	const urls: string[] = [];

	for (const block of blocks) {
		if (block.type === "image") {
			const image = block.image;
			if (image?.type === "external" && image.external?.url) {
				urls.push(image.external.url);
			} else if (image?.type === "file" && image.file?.url) {
				urls.push(image.file.url);
			}
		}
	}

	return urls;
}

/**
 * Extracts structured content from a user's Notion page.
 * Uses LLM to parse the content into ExtractedContent format.
 *
 * @param pageIdOrUrl - The Notion page ID or URL
 * @param apiKey - The Notion API key
 * @param parameters - Extraction parameters
 * @returns Array of extracted content items
 */
export async function extractUserContentFromPage(
	pageIdOrUrl: string,
	apiKey: string,
	parameters: ExtractionParameters
): Promise<ExtractedContent[]> {
	// Fetch the page content
	const userContent = await fetchUserContent(pageIdOrUrl, apiKey);

	// Skip very short pages
	if (userContent.wordCount < 50) {
		return [];
	}

	// Use LLM to extract structured content
	const model = getModel("EXTRACTION");
	const prompt = createExtractionPrompt(
		userContent.text,
		parameters,
		userContent.title
	);

	const { output } = await generateText({
		model,
		output: Output.object({
			schema: ExtractionResultSchema,
		}),
		system: EXTRACTION_SYSTEM_PROMPT,
		prompt,
	});

	if (!output) {
		return [];
	}

	// Convert to ExtractedContent format with user source type
	const extractedContent: ExtractedContent[] = output.items.map((item) => {
		const qualityResult = calculateQuality(item.content, item.contentType);
		const overused = isOverusedExample(
			item.content,
			parameters.overusedExamples
		);
		const multiUse = assessMultiUse(item.content, item.contentType);

		return {
			id: crypto.randomUUID(),
			sourceType: "user" as const,
			sourceRef: userContent.pageId,
			contentType: item.contentType,
			exampleCategory: item.exampleCategory,
			content: item.content,
			context: item.context,
			quality: qualityResult.quality,
			isOverused: overused || item.isOverused,
			multiUse: multiUse || item.multiUse,
			themes: [], // Will be classified in a separate step
			createdAt: new Date().toISOString(),
		};
	});

	return extractedContent;
}

/**
 * Extracts user content from multiple Notion pages.
 *
 * @param pageRefs - Array of Notion page IDs or URLs
 * @param apiKey - The Notion API key
 * @param parameters - Extraction parameters
 * @param onProgress - Progress callback
 * @returns Array of extracted content from all pages
 */
export async function extractUserContentBatch(
	pageRefs: string[],
	apiKey: string,
	parameters: ExtractionParameters,
	onProgress?: (processed: number, total: number) => void
): Promise<ExtractedContent[]> {
	const allContent: ExtractedContent[] = [];

	for (let i = 0; i < pageRefs.length; i++) {
		const pageRef = pageRefs[i];

		try {
			const content = await extractUserContentFromPage(
				pageRef,
				apiKey,
				parameters
			);
			allContent.push(...content);
		} catch (error) {
			console.error(`Failed to extract from page ${pageRef}:`, error);
			// Continue with other pages
		}

		onProgress?.(i + 1, pageRefs.length);
	}

	return allContent;
}

/**
 * Gets statistics about user content from Notion.
 */
export function getUserContentStats(contents: ExtractedContent[]): {
	totalItems: number;
	byType: Record<string, number>;
	byQuality: Record<string, number>;
	pages: Set<string>;
} {
	const byType: Record<string, number> = {};
	const byQuality: Record<string, number> = {};
	const pages = new Set<string>();

	for (const content of contents) {
		if (content.sourceType !== "user") {
			continue;
		}

		pages.add(content.sourceRef);
		byType[content.contentType] = (byType[content.contentType] || 0) + 1;
		byQuality[content.quality] = (byQuality[content.quality] || 0) + 1;
	}

	return {
		totalItems: contents.filter((c) => c.sourceType === "user").length,
		byType,
		byQuality,
		pages,
	};
}

/**
 * Combines user content with topper content for a complete view.
 *
 * @param userContent - Extracted user content
 * @param topperContent - Extracted topper content
 * @returns Combined array with distinct source types
 */
export function combineUserAndTopperContent(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[]
): ExtractedContent[] {
	// Ensure source types are correct
	const markedUser = userContent.map((c) => ({
		...c,
		sourceType: "user" as const,
	}));

	const markedTopper = topperContent.map((c) => ({
		...c,
		sourceType: "topper" as const,
	}));

	return [...markedUser, ...markedTopper];
}

/**
 * Finds matching content between user and topper sources.
 * Useful for identifying overlap and gaps.
 */
export function findContentOverlap(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[]
): {
	similar: Array<{
		user: ExtractedContent;
		topper: ExtractedContent;
		similarity: number;
	}>;
	userOnly: ExtractedContent[];
	topperOnly: ExtractedContent[];
} {
	// Simple overlap detection based on content type and rough text matching
	// More sophisticated matching could use embeddings
	const matched = new Set<string>();
	const matchedTopper = new Set<string>();
	const similar: Array<{
		user: ExtractedContent;
		topper: ExtractedContent;
		similarity: number;
	}> = [];

	for (const user of userContent) {
		for (const topper of topperContent) {
			if (
				user.contentType === topper.contentType &&
				!matchedTopper.has(topper.id)
			) {
				const similarity = calculateTextSimilarity(
					user.content,
					topper.content
				);
				if (similarity > 0.5) {
					similar.push({ user, topper, similarity });
					matched.add(user.id);
					matchedTopper.add(topper.id);
					break;
				}
			}
		}
	}

	const userOnly = userContent.filter((c) => !matched.has(c.id));
	const topperOnly = topperContent.filter((c) => !matchedTopper.has(c.id));

	return { similar, userOnly, topperOnly };
}

/**
 * Simple text similarity calculation using word overlap.
 */
function calculateTextSimilarity(text1: string, text2: string): number {
	const words1 = new Set(text1.toLowerCase().split(WORD_SPLIT_REGEX));
	const words2 = new Set(text2.toLowerCase().split(WORD_SPLIT_REGEX));

	let intersection = 0;
	for (const word of words1) {
		if (words2.has(word)) {
			intersection++;
		}
	}

	const union = words1.size + words2.size - intersection;
	return union > 0 ? intersection / union : 0;
}
