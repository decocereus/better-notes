/**
 * Types for content extraction from topper essays and user notes.
 * Based on strategy document parameters.
 */

/**
 * Types of content that can be extracted from essays.
 */
export type ContentType =
	| "introduction"
	| "conclusion"
	| "example"
	| "quote"
	| "thinker"
	| "argument"
	| "book_poem"
	| "keyword_phrase";

/**
 * Categories for examples based on strategy document.
 * Used for classification and gap analysis.
 */
export type ExampleCategory =
	| "individual"
	| "ethical"
	| "governance"
	| "societal"
	| "environment"
	| "mythological"
	| "sports"
	| "religion"
	| "business"
	| "international_relations"
	| "science_tech";

/**
 * Quality level of extracted content.
 */
export type ContentQuality = "high" | "medium" | "low";

/**
 * Source of the content (topper essay or user notes).
 */
export type ContentSourceType = "topper" | "user";

/**
 * Mapping of content to a theme with relevance score.
 */
export interface ThemeMapping {
	mainThemeId: string;
	miniThemeId: string;
	relevanceScore: number;
	reasoning?: string;
}

/**
 * Attribution metadata for quotes, thinkers, books, poems, or references.
 */
export interface ContentAttribution {
	name?: string;
	role?: string;
	work?: string;
	year?: string;
}

/**
 * A piece of extracted content from an essay or note.
 */
export interface ExtractedContent {
	id: string;
	sourceType: ContentSourceType;
	sourceRef: string; // R2 key or Notion page ID

	contentType: ContentType;
	exampleCategory?: ExampleCategory; // Only for examples

	content: string; // The actual extracted text
	context?: string; // Surrounding context for understanding
	verbatimText?: string; // Exact OCR excerpt
	detailsMarkdown?: string; // Expanded explanation/usage in markdown

	quality: ContentQuality;
	isOverused: boolean; // Flag for Gandhi, Buddha, etc.
	multiUse: boolean; // Applicable across multiple themes

	themes: ThemeMapping[];
	attribution?: ContentAttribution;
	sourcePageStart?: number;
	sourcePageEnd?: number;

	createdAt: string;
	updatedAt?: string;

	/** Optional essay metadata for better UI grouping */
	essayTitle?: string;
	essayIndex?: number;
	essayStartPage?: number;
	essayEndPage?: number;
}

/**
 * Markdown summary for a content type.
 */
export interface ExtractionSection {
	type: ContentType;
	markdown: string;
	itemCount?: number;
}

/**
 * Parameters for content extraction, configurable via UI.
 */
export interface ExtractionParameters {
	/** Which example categories to extract */
	enabledCategories: ExampleCategory[];

	/** Priority for thinker extraction */
	thinkerPriority: "indian" | "western" | "balanced";

	/** Style preference for quotes */
	quoteStyle: "multi_use_preferred" | "theme_specific";

	/** Custom list of overused examples to flag */
	overusedExamples: string[];

	/** Minimum quality threshold for inclusion */
	minQualityThreshold: ContentQuality;

	/** Whether to extract cross-theme references */
	extractCrossThemeRefs: boolean;
}

/**
 * Default extraction parameters.
 */
export const DEFAULT_EXTRACTION_PARAMETERS: ExtractionParameters = {
	enabledCategories: [
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
	],
	thinkerPriority: "balanced",
	quoteStyle: "multi_use_preferred",
	overusedExamples: [
		"gandhi",
		"buddha",
		"ashoka",
		"mandela",
		"vasudhaiva kutumbakam",
	],
	minQualityThreshold: "medium",
	extractCrossThemeRefs: true,
};

/**
 * Result of extracting content from a single essay.
 */
export interface EssayExtractionResult {
	essayTitle?: string;
	startPage: number;
	endPage: number;
	items: ExtractedContent[];
	sections?: ExtractionSection[];
	overallQuality: ContentQuality;
	wordCount: number;

	// Essay-level quality metadata for tracking extraction performance
	/** Confidence score 0-1 based on item quality and count */
	extractionConfidence?: number;
	/** Human-readable notes about extraction quality */
	extractionNotes?: string;
	/** Processing time in milliseconds */
	processingTimeMs?: number;
	/** Number of items actually extracted */
	itemsExtracted?: number;
}

/**
 * Boundary of an essay within a larger PDF.
 */
export interface EssayBoundary {
	startPage: number;
	endPage: number;
	title?: string;
	wordCount: number;
}
