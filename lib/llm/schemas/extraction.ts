/**
 * Zod Schemas for Content Extraction
 * Validates LLM extraction output for type safety.
 */

import { z } from "zod";

/**
 * Content type enum matching types/extraction.ts
 */
export const ContentTypeSchema = z.enum([
	"introduction",
	"conclusion",
	"example",
	"quote",
	"thinker",
	"argument",
	"book_poem",
	"keyword_phrase",
]);

/**
 * Example category enum matching types/extraction.ts
 */
export const ExampleCategorySchema = z.enum([
	"individual",
	"ethical",
	"governance",
	"societal",
	"environment",
	"mythological",
	"sports",
	"religion",
	"business",
	"international_relations",
	"science_tech",
]);

/**
 * Quality level enum
 */
export const QualitySchema = z.enum(["high", "medium", "low"]);

/**
 * Schema for a single extracted content item.
 */
export const ExtractedItemSchema = z.object({
	contentType: ContentTypeSchema.describe("Type of content extracted"),

	exampleCategory: ExampleCategorySchema.optional().describe(
		"Category for examples only"
	),

	content: z
		.string()
		.min(5)
		.describe("One-line summary of the extracted content"),

	verbatimText: z
		.string()
		.min(10)
		.optional()
		.describe("Exact OCR excerpt copied verbatim from the essay text"),

	context: z
		.string()
		.optional()
		.describe("Surrounding context for understanding"),

	detailsMarkdown: z
		.string()
		.optional()
		.describe("Expanded explanation/usage in markdown"),

	quality: QualitySchema.describe("Quality assessment of the content"),

	isOverused: z
		.boolean()
		.describe("Whether this is a commonly overused example"),

	multiUse: z.boolean().describe("Whether this applies across multiple themes"),

	reasoning: z
		.string()
		.optional()
		.describe("Brief reasoning for quality/flags"),

	thinkerName: z
		.string()
		.optional()
		.describe("Name of thinker (for thinker content type)"),

	thinkerOrigin: z
		.enum(["indian", "western", "other"])
		.optional()
		.describe("Origin of the thinker"),

	bookOrPoemTitle: z
		.string()
		.optional()
		.describe("Title (for book_poem content type)"),

	bookOrPoemAuthor: z
		.string()
		.optional()
		.describe("Author (for book_poem content type)"),

	argumentType: z
		.enum(["why", "how", "what_if", "multi_stakeholder"])
		.optional()
		.describe("Type of argument framing"),

	sourcePageStart: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("Start page for the verbatim excerpt"),

	sourcePageEnd: z
		.number()
		.int()
		.positive()
		.optional()
		.describe("End page for the verbatim excerpt"),

	attribution: z
		.object({
			name: z.string().optional().describe("Speaker or author name"),
			role: z.string().optional().describe("Role (thinker/poet/leader/etc.)"),
			work: z.string().optional().describe("Source work (book/poem/etc.)"),
			year: z.string().optional().describe("Year if present in text"),
		})
		.optional()
		.describe("Attribution metadata for quotes or references"),
});

export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

/**
 * Schema for markdown summaries per content type.
 */
export const ExtractionSectionSchema = z.object({
	type: ContentTypeSchema.describe("Content type for this section"),
	markdown: z
		.string()
		.min(1)
		.describe("Markdown list summarizing the strongest items for this type"),
	itemCount: z
		.number()
		.optional()
		.describe("Optional item count represented in this section"),
});

export type ExtractionSection = z.infer<typeof ExtractionSectionSchema>;

/**
 * Schema for the complete extraction result from an essay.
 */
export const ExtractionResultSchema = z.object({
	items: z.array(ExtractedItemSchema).describe("All extracted content items"),
	sections: z
		.array(ExtractionSectionSchema)
		.optional()
		.describe("Markdown summaries grouped by content type"),

	essayTitle: z.string().optional().describe("Inferred or stated essay title"),

	overallQuality: QualitySchema.describe("Overall quality of the essay"),

	totalItemsExtracted: z.number().describe("Total number of items extracted"),

	extractionNotes: z
		.string()
		.optional()
		.describe("Notes about the extraction process"),

	summary: z
		.object({
			introductions: z.number().describe("Count of introductions extracted"),
			conclusions: z.number().describe("Count of conclusions extracted"),
			examples: z.number().describe("Count of examples extracted"),
			quotes: z.number().describe("Count of quotes extracted"),
			thinkers: z.number().describe("Count of thinkers referenced"),
			arguments: z.number().describe("Count of arguments extracted"),
			booksPoems: z.number().describe("Count of books/poems referenced"),
			keywords: z.number().describe("Count of keywords/phrases extracted"),
		})
		.describe("Summary counts by content type"),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/**
 * Schema for extraction parameters validation.
 */
export const ExtractionParametersSchema = z.object({
	enabledCategories: z
		.array(ExampleCategorySchema)
		.min(1)
		.describe("At least one category must be enabled"),

	thinkerPriority: z
		.enum(["indian", "western", "balanced"])
		.describe("Priority for thinker extraction"),

	quoteStyle: z
		.enum(["multi_use_preferred", "theme_specific"])
		.describe("Style preference for quotes"),

	overusedExamples: z
		.array(z.string())
		.describe("List of overused examples to flag"),

	minQualityThreshold: QualitySchema.describe("Minimum quality for inclusion"),

	extractCrossThemeRefs: z
		.boolean()
		.describe("Whether to extract cross-theme references"),
});

/**
 * Schema for bulk extraction (multiple essays).
 */
export const BulkExtractionResultSchema = z.object({
	essays: z.array(
		z.object({
			essayIndex: z.number().describe("Index of the essay (0-based)"),
			startPage: z.number().describe("Start page of the essay"),
			endPage: z.number().describe("End page of the essay"),
			extraction: ExtractionResultSchema.describe("Extraction results"),
		})
	),

	totalEssays: z.number().describe("Total essays processed"),
	totalItems: z.number().describe("Total items extracted across all essays"),
	processingTimeMs: z.number().optional().describe("Total processing time"),
});

export type BulkExtractionResult = z.infer<typeof BulkExtractionResultSchema>;

/**
 * Helper to validate an extraction result.
 */
export function validateExtractionResult(data: unknown): {
	success: boolean;
	data?: ExtractionResult;
	error?: string;
} {
	const result = ExtractionResultSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}

/**
 * Helper to validate a single extracted item.
 */
export function validateExtractedItem(data: unknown): {
	success: boolean;
	data?: ExtractedItem;
	error?: string;
} {
	const result = ExtractedItemSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}
