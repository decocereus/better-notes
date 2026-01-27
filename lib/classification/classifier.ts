/**
 * Theme Classifier
 * Main logic for classifying extracted content into theme hierarchy.
 * Uses LLM with structured output for accurate classification.
 */

import { generateText, Output } from "ai";
import { getModel } from "@/lib/ai/client";
import {
	CLASSIFICATION_SYSTEM_PROMPT,
	createBatchClassificationPrompt,
	createClassificationPrompt,
} from "@/lib/llm/prompts/classification";
import {
	type BatchClassificationResult,
	BatchClassificationResultSchema,
	isMultiTheme as checkMultiTheme,
	filterByRelevance,
	SingleClassificationResultSchema,
} from "@/lib/llm/schemas/classification";
import type {
	ThemeMapping as ContentThemeMapping,
	ExtractedContent,
} from "@/types/extraction";
import type { MainTheme } from "@/types/theme";

/**
 * Minimum relevance score for including a theme mapping.
 */
const MIN_RELEVANCE_THRESHOLD = 0.5;

/**
 * Maximum items per batch for batch classification.
 */
const MAX_BATCH_SIZE = 10;

/**
 * Classifies a single content item into themes.
 *
 * @param content - The content to classify
 * @param themes - The theme hierarchy to classify into
 * @returns The content with theme mappings added
 */
export async function classifyContent(
	content: ExtractedContent,
	themes: MainTheme[]
): Promise<ExtractedContent> {
	if (themes.length === 0) {
		return content;
	}

	const model = getModel("CLASSIFICATION");
	const prompt = createClassificationPrompt(content, themes);

	try {
		const { output: classification } = await generateText({
			model,
			output: Output.object({
				schema: SingleClassificationResultSchema,
			}),
			system: CLASSIFICATION_SYSTEM_PROMPT,
			prompt,
		});

		if (!classification) {
			console.warn(
				`Classification returned null for content ${content.id}, returning unclassified`
			);
			return content;
		}

		// Filter mappings by relevance threshold
		const validMappings = filterByRelevance(
			classification.mappings,
			MIN_RELEVANCE_THRESHOLD
		);

		// Convert to the format used in ExtractedContent
		const themeMappings: ContentThemeMapping[] = validMappings.map((m) => ({
			mainThemeId: m.mainThemeId,
			miniThemeId: m.miniThemeId,
			relevanceScore: m.relevanceScore,
			reasoning: m.reasoning,
		}));

		return {
			...content,
			themes: themeMappings,
			multiUse: content.multiUse || checkMultiTheme(validMappings),
			updatedAt: new Date().toISOString(),
		};
	} catch (error) {
		// Log the error and return unclassified content
		console.warn(
			`Classification failed for content ${content.id}, returning unclassified:`,
			error
		);
		return content;
	}
}

/**
 * Classifies multiple content items in batches.
 * More efficient than classifying one at a time.
 *
 * @param contents - Array of content items to classify
 * @param themes - The theme hierarchy
 * @param onProgress - Progress callback
 * @returns Array of classified content
 */
export async function classifyContentBatch(
	contents: ExtractedContent[],
	themes: MainTheme[],
	onProgress?: (processed: number, total: number) => void
): Promise<ExtractedContent[]> {
	if (themes.length === 0 || contents.length === 0) {
		return contents;
	}

	const results: ExtractedContent[] = [];
	const batches = chunkArray(contents, MAX_BATCH_SIZE);

	let processed = 0;

	for (const batch of batches) {
		const classifiedBatch = await classifyBatch(batch, themes);
		results.push(...classifiedBatch);
		processed += batch.length;
		onProgress?.(processed, contents.length);
	}

	return results;
}

/**
 * Classifies a single batch of content items.
 */
async function classifyBatch(
	contents: ExtractedContent[],
	themes: MainTheme[]
): Promise<ExtractedContent[]> {
	const model = getModel("CLASSIFICATION");
	const prompt = createBatchClassificationPrompt(contents, themes);

	try {
		const { output: batchResult } = await generateText({
			model,
			output: Output.object({
				schema: BatchClassificationResultSchema,
			}),
			system: CLASSIFICATION_SYSTEM_PROMPT,
			prompt,
		});

		if (!batchResult) {
			throw new Error("Batch classification returned null output");
		}

		// Map classifications back to content items
		return mapClassificationsToContent(contents, batchResult);
	} catch (error) {
		// Fall back to individual classification on batch failure
		console.warn(
			`Batch classification failed for ${contents.length} items, falling back to individual:`,
			error
		);
		return classifyIndividually(contents, themes);
	}
}

/**
 * Falls back to classifying items individually.
 * classifyContent now handles errors internally and returns unclassified content on failure.
 */
async function classifyIndividually(
	contents: ExtractedContent[],
	themes: MainTheme[]
): Promise<ExtractedContent[]> {
	const results: ExtractedContent[] = [];

	for (const content of contents) {
		const classified = await classifyContent(content, themes);
		results.push(classified);
	}

	return results;
}

/**
 * Maps batch classification results back to content items.
 */
function mapClassificationsToContent(
	contents: ExtractedContent[],
	batchResult: BatchClassificationResult
): ExtractedContent[] {
	const classificationMap = new Map(
		batchResult.classifications.map((c) => [c.contentId, c])
	);

	return contents.map((content) => {
		const classification = classificationMap.get(content.id);

		if (!classification) {
			return content;
		}

		const validMappings = filterByRelevance(
			classification.mappings,
			MIN_RELEVANCE_THRESHOLD
		);

		const themeMappings: ContentThemeMapping[] = validMappings.map((m) => ({
			mainThemeId: m.mainThemeId,
			miniThemeId: m.miniThemeId,
			relevanceScore: m.relevanceScore,
			reasoning: m.reasoning,
		}));

		return {
			...content,
			themes: themeMappings,
			multiUse: content.multiUse || classification.isMultiTheme,
			updatedAt: new Date().toISOString(),
		};
	});
}

/**
 * Re-classifies content when themes are updated.
 *
 * @param content - Content with existing classifications
 * @param themes - Updated theme hierarchy
 * @returns Content with updated classifications
 */
export function reclassifyContent(
	content: ExtractedContent,
	themes: MainTheme[]
): Promise<ExtractedContent> {
	// For now, just re-classify from scratch
	// Could be optimized to only update changed mappings
	return classifyContent({ ...content, themes: [] }, themes);
}

/**
 * Gets classification statistics from classified content.
 */
export function getClassificationStats(contents: ExtractedContent[]): {
	totalClassified: number;
	unclassified: number;
	multiThemeCount: number;
	averageMappings: number;
	themeDistribution: Map<string, number>;
} {
	const classified = contents.filter((c) => c.themes.length > 0);
	const multiTheme = contents.filter((c) => c.themes.length >= 3);

	const themeDistribution = new Map<string, number>();
	let totalMappings = 0;

	for (const content of classified) {
		totalMappings += content.themes.length;

		for (const mapping of content.themes) {
			const key = `${mapping.mainThemeId}:${mapping.miniThemeId}`;
			themeDistribution.set(key, (themeDistribution.get(key) || 0) + 1);
		}
	}

	return {
		totalClassified: classified.length,
		unclassified: contents.length - classified.length,
		multiThemeCount: multiTheme.length,
		averageMappings:
			classified.length > 0 ? totalMappings / classified.length : 0,
		themeDistribution,
	};
}

/**
 * Finds content that matches a specific theme.
 *
 * @param contents - Array of classified content
 * @param mainThemeId - Main theme ID to filter by
 * @param miniThemeId - Optional mini-theme ID for more specific filtering
 * @param minRelevance - Minimum relevance score
 * @returns Filtered content items
 */
export function findContentByTheme(
	contents: ExtractedContent[],
	mainThemeId: string,
	miniThemeId?: string,
	minRelevance: number = MIN_RELEVANCE_THRESHOLD
): ExtractedContent[] {
	return contents.filter((content) =>
		content.themes.some(
			(mapping) =>
				mapping.mainThemeId === mainThemeId &&
				(miniThemeId === undefined || mapping.miniThemeId === miniThemeId) &&
				mapping.relevanceScore >= minRelevance
		)
	);
}

/**
 * Gets content sorted by relevance for a specific theme.
 */
export function getContentByRelevance(
	contents: ExtractedContent[],
	mainThemeId: string,
	miniThemeId: string
): ExtractedContent[] {
	return contents
		.filter((content) =>
			content.themes.some(
				(m) => m.mainThemeId === mainThemeId && m.miniThemeId === miniThemeId
			)
		)
		.sort((a, b) => {
			const aScore =
				a.themes.find(
					(m) => m.mainThemeId === mainThemeId && m.miniThemeId === miniThemeId
				)?.relevanceScore || 0;
			const bScore =
				b.themes.find(
					(m) => m.mainThemeId === mainThemeId && m.miniThemeId === miniThemeId
				)?.relevanceScore || 0;
			return bScore - aScore;
		});
}

/**
 * Helper to chunk an array into smaller arrays.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}
