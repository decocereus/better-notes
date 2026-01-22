/**
 * Content Extractor
 * Main extraction logic for pulling structured content from UPSC topper essays.
 * Uses LLM with structured output to extract intros, examples, quotes, etc.
 */

import { generateObject } from "ai";
import { getModel } from "@/lib/ai/client";
import {
	createExtractionPrompt,
	EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/llm/prompts/extraction";
import {
	type ExtractedItem,
	ExtractionResultSchema,
} from "@/lib/llm/schemas/extraction";
import type {
	ContentType,
	EssayExtractionResult,
	ExtractedContent,
	ExtractionParameters,
} from "@/types/extraction";
import {
	assessMultiUse,
	calculateQuality,
	filterByQuality,
	isOverusedExample,
} from "./quality";

/**
 * Regex for splitting text into words.
 */
const WORD_SPLIT_REGEX = /\s+/;

/**
 * Extracts structured content from a single essay.
 *
 * @param essayText - The essay text to extract from
 * @param parameters - Extraction configuration parameters
 * @param sourceRef - Reference to the source (R2 key or Notion page ID)
 * @param essayTitle - Optional title of the essay
 * @returns Extracted content items
 */
export async function extractContentFromEssay(
	essayText: string,
	parameters: ExtractionParameters,
	sourceRef: string,
	essayTitle?: string
): Promise<ExtractedContent[]> {
	// Skip very short essays
	const wordCount = essayText.split(WORD_SPLIT_REGEX).filter(Boolean).length;
	if (wordCount < 100) {
		return [];
	}

	const model = getModel("EXTRACTION");
	const prompt = createExtractionPrompt(essayText, parameters, essayTitle);

	const result = await generateObject({
		model,
		schema: ExtractionResultSchema,
		system: EXTRACTION_SYSTEM_PROMPT,
		prompt,
	});

	// Convert and enhance extracted items
	const extractedContent = result.object.items.map((item) =>
		convertToExtractedContent(item, sourceRef, parameters)
	);

	// Filter by quality threshold
	return filterByQuality(extractedContent, parameters.minQualityThreshold);
}

/**
 * Converts an LLM-extracted item to the ExtractedContent format.
 */
function convertToExtractedContent(
	item: ExtractedItem,
	sourceRef: string,
	parameters: ExtractionParameters
): ExtractedContent {
	// Re-assess quality and flags using our local functions
	const qualityResult = calculateQuality(item.content, item.contentType);
	const overused = isOverusedExample(item.content, parameters.overusedExamples);
	const multiUse = assessMultiUse(item.content, item.contentType);

	return {
		id: crypto.randomUUID(),
		sourceType: "topper",
		sourceRef,
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
}

/**
 * Extracts content from multiple essays in a batch.
 *
 * @param essays - Array of essay texts with boundaries
 * @param parameters - Extraction configuration
 * @param sourceRef - Source reference
 * @param onProgress - Progress callback
 * @returns Array of extraction results per essay
 */
export async function extractContentBatch(
	essays: Array<{
		text: string;
		startPage: number;
		endPage: number;
		title?: string;
	}>,
	parameters: ExtractionParameters,
	sourceRef: string,
	onProgress?: (processed: number, total: number) => void
): Promise<EssayExtractionResult[]> {
	const results: EssayExtractionResult[] = [];

	for (let i = 0; i < essays.length; i++) {
		const essay = essays[i];

		try {
			const items = await extractContentFromEssay(
				essay.text,
				parameters,
				sourceRef,
				essay.title
			);

			const wordCount = essay.text
				.split(WORD_SPLIT_REGEX)
				.filter(Boolean).length;

			results.push({
				essayTitle: essay.title,
				startPage: essay.startPage,
				endPage: essay.endPage,
				items,
				overallQuality: calculateOverallQuality(items),
				wordCount,
			});
		} catch (error) {
			// Log error but continue with other essays
			console.error(`Failed to extract from essay ${i + 1}:`, error);
			results.push({
				startPage: essay.startPage,
				endPage: essay.endPage,
				items: [],
				overallQuality: "low",
				wordCount: essay.text.split(WORD_SPLIT_REGEX).filter(Boolean).length,
			});
		}

		onProgress?.(i + 1, essays.length);
	}

	return results;
}

/**
 * Calculates overall quality based on extracted items.
 */
function calculateOverallQuality(
	items: ExtractedContent[]
): ExtractedContent["quality"] {
	if (items.length === 0) {
		return "low";
	}

	const qualityScores = {
		high: 3,
		medium: 2,
		low: 1,
	};

	const totalScore = items.reduce(
		(sum, item) => sum + qualityScores[item.quality],
		0
	);
	const avgScore = totalScore / items.length;

	if (avgScore >= 2.5) {
		return "high";
	}
	if (avgScore >= 1.5) {
		return "medium";
	}
	return "low";
}

/**
 * Gets extraction statistics from results.
 */
export function getExtractionStats(results: EssayExtractionResult[]): {
	totalEssays: number;
	totalItems: number;
	byType: Record<ContentType, number>;
	byQuality: Record<ExtractedContent["quality"], number>;
	overusedCount: number;
	multiUseCount: number;
} {
	const allItems = results.flatMap((r) => r.items);

	const byType: Record<ContentType, number> = {
		introduction: 0,
		conclusion: 0,
		example: 0,
		quote: 0,
		thinker: 0,
		argument: 0,
		book_poem: 0,
		keyword_phrase: 0,
	};

	const byQuality: Record<ExtractedContent["quality"], number> = {
		high: 0,
		medium: 0,
		low: 0,
	};

	let overusedCount = 0;
	let multiUseCount = 0;

	for (const item of allItems) {
		byType[item.contentType]++;
		byQuality[item.quality]++;
		if (item.isOverused) {
			overusedCount++;
		}
		if (item.multiUse) {
			multiUseCount++;
		}
	}

	return {
		totalEssays: results.length,
		totalItems: allItems.length,
		byType,
		byQuality,
		overusedCount,
		multiUseCount,
	};
}

/**
 * Groups extracted content by type.
 */
export function groupByType(
	items: ExtractedContent[]
): Record<ContentType, ExtractedContent[]> {
	const grouped: Record<ContentType, ExtractedContent[]> = {
		introduction: [],
		conclusion: [],
		example: [],
		quote: [],
		thinker: [],
		argument: [],
		book_poem: [],
		keyword_phrase: [],
	};

	for (const item of items) {
		grouped[item.contentType].push(item);
	}

	return grouped;
}

/**
 * Filters items to only high-value content (high quality, not overused).
 */
export function getHighValueContent(
	items: ExtractedContent[]
): ExtractedContent[] {
	return items.filter((item) => item.quality === "high" && !item.isOverused);
}

/**
 * Gets multi-use content that can be applied across themes.
 */
export function getMultiUseContent(
	items: ExtractedContent[]
): ExtractedContent[] {
	return items.filter((item) => item.multiUse);
}
