/**
 * Zod Schemas for Theme Classification
 * Validates LLM classification output for type safety.
 */

import { z } from "zod";

/**
 * Schema for a single theme mapping.
 */
export const ThemeMappingSchema = z.object({
	mainThemeId: z.string().describe("ID of the main theme"),

	miniThemeId: z
		.string()
		.describe("ID of the mini-theme within the main theme"),

	relevanceScore: z
		.number()
		.min(0)
		.max(1)
		.describe("Relevance score from 0 to 1 (only include >= 0.5)"),

	reasoning: z
		.string()
		.optional()
		.describe("Brief explanation for this classification"),
});

export type ThemeMapping = z.infer<typeof ThemeMappingSchema>;

/**
 * Schema for classification of a single content item.
 */
export const ContentClassificationSchema = z.object({
	contentId: z.string().describe("ID of the content being classified"),

	mappings: z
		.array(ThemeMappingSchema)
		.describe("Theme mappings for this content"),

	isMultiTheme: z.boolean().describe("True if content applies to 3+ themes"),

	primaryTheme: z
		.object({
			mainThemeId: z.string(),
			miniThemeId: z.string(),
		})
		.optional()
		.describe("The most relevant theme (highest score)"),

	// Accept both field names since LLM may return either
	classificationConfidence: z
		.enum(["high", "medium", "low"])
		.optional()
		.describe("Confidence in the classification"),

	confidence: z
		.enum(["high", "medium", "low"])
		.optional()
		.describe("Alternative field name for confidence"),

	notes: z
		.string()
		.optional()
		.describe("Additional notes about the classification"),
});

export type ContentClassification = z.infer<typeof ContentClassificationSchema>;

/**
 * Schema for batch classification result.
 */
export const BatchClassificationResultSchema = z.object({
	classifications: z
		.array(ContentClassificationSchema)
		.describe("Classifications for all content items"),

	totalItems: z.number().describe("Total items classified"),

	multiThemeCount: z.number().describe("Number of items applying to 3+ themes"),

	averageMappingsPerItem: z
		.number()
		.describe("Average number of theme mappings per item"),

	processingNotes: z
		.string()
		.optional()
		.describe("Notes about the classification process"),
});

export type BatchClassificationResult = z.infer<
	typeof BatchClassificationResultSchema
>;

/**
 * Schema for single-item classification result.
 * Used when classifying one content item at a time.
 * All fields except mappings are optional since we only use mappings.
 */
export const SingleClassificationResultSchema = z.object({
	mappings: z
		.array(ThemeMappingSchema)
		.describe("Theme mappings for the content"),

	isMultiTheme: z
		.boolean()
		.optional()
		.describe("True if content applies to 3+ themes"),

	primaryTheme: z
		.object({
			mainThemeId: z.string(),
			miniThemeId: z.string(),
		})
		.optional()
		.describe("The most relevant theme"),

	confidence: z
		.enum(["high", "medium", "low"])
		.optional()
		.describe("Classification confidence"),

	// Allow LLM to use alternative field names
	classificationConfidence: z
		.enum(["high", "medium", "low"])
		.optional()
		.describe("Alternative field name for confidence"),
});

export type SingleClassificationResult = z.infer<
	typeof SingleClassificationResultSchema
>;

/**
 * Schema for theme coverage statistics.
 */
export const ThemeCoverageStatsSchema = z.object({
	mainThemeId: z.string(),
	mainThemeTitle: z.string(),
	miniThemeId: z.string(),
	miniThemeTitle: z.string(),

	contentCount: z.number().describe("Number of content items mapped here"),

	bySourceType: z.object({
		topper: z.number(),
		user: z.number(),
	}),

	byContentType: z
		.record(z.string(), z.number())
		.describe("Count by content type (example, quote, etc.)"),

	averageRelevance: z.number().describe("Average relevance score"),

	highQualityCount: z.number().describe("Count of high-quality items"),
});

export type ThemeCoverageStats = z.infer<typeof ThemeCoverageStatsSchema>;

/**
 * Helper to validate a single classification result.
 */
export function validateSingleClassification(data: unknown): {
	success: boolean;
	data?: SingleClassificationResult;
	error?: string;
} {
	const result = SingleClassificationResultSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}

/**
 * Helper to validate batch classification result.
 */
export function validateBatchClassification(data: unknown): {
	success: boolean;
	data?: BatchClassificationResult;
	error?: string;
} {
	const result = BatchClassificationResultSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}

/**
 * Filters mappings to only those meeting minimum relevance threshold.
 */
export function filterByRelevance(
	mappings: ThemeMapping[],
	minRelevance = 0.5
): ThemeMapping[] {
	return mappings.filter((m) => m.relevanceScore >= minRelevance);
}

/**
 * Gets the primary (highest relevance) theme from mappings.
 */
export function getPrimaryTheme(
	mappings: ThemeMapping[]
): ThemeMapping | undefined {
	if (mappings.length === 0) {
		return undefined;
	}

	return mappings.reduce((max, current) =>
		current.relevanceScore > max.relevanceScore ? current : max
	);
}

/**
 * Checks if mappings qualify as multi-theme (3+ themes).
 */
export function isMultiTheme(
	mappings: ThemeMapping[],
	minRelevance = 0.5
): boolean {
	const validMappings = filterByRelevance(mappings, minRelevance);
	return validMappings.length >= 3;
}
