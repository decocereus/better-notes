/**
 * Types for note generation and Notion sync.
 * Dual-section format: Your Notes + Topper Insights
 */

import type { ContentType } from "./extraction";

/**
 * Types of items that can appear in generated notes.
 */
export type NoteItemType =
	| "key_point"
	| "example"
	| "quote"
	| "argument"
	| "thinker"
	| "intro_hook"
	| "conclusion_technique";

/**
 * Status of note generation.
 */
export type GenerationStatus =
	| "pending"
	| "generating"
	| "completed"
	| "failed";

/**
 * Status of Notion sync.
 */
export type SyncStatus = "not_synced" | "syncing" | "synced" | "failed";

/**
 * A single item in a note section.
 */
export interface NoteItem {
	/** Unique ID for this item */
	id: string;

	/** Type of note item */
	type: NoteItemType;

	/** The actual content (formatted text) */
	content: string;

	/** Original content type it was derived from */
	sourceContentType?: ContentType;

	/** ID of the ExtractedContent this came from */
	sourceContentId?: string;

	/** Additional context or explanation */
	context?: string;

	/** Whether this item is cross-applicable to other themes */
	isCrossTheme?: boolean;
}

/**
 * A section of a generated note (Your Notes or Topper Insights).
 */
export interface NoteSection {
	/** Full markdown-formatted content */
	content: string;

	/** Structured items that make up this section */
	items: NoteItem[];

	/** Word count for conciseness tracking */
	wordCount: number;

	/** Number of items in this section */
	itemCount: number;
}

/**
 * Reference to content applicable across multiple themes.
 */
export interface CrossThemeRef {
	/** The content that is cross-applicable */
	content: string;

	/** IDs of other themes where this content can be used */
	applicableThemeIds: string[];

	/** Names of applicable themes for display */
	applicableThemeNames: string[];

	/** Source content ID */
	sourceContentId?: string;
}

/**
 * A complete generated note for a theme.
 * Dual-section format as specified in plan.md.
 */
export interface GeneratedNote {
	/** Unique ID for this note */
	id: string;

	/** Project identifier for storage and retrieval */
	projectId?: string;

	/** Main theme identifiers */
	mainThemeId: string;
	mainThemeName: string;

	/** Mini theme identifiers */
	miniThemeId: string;
	miniThemeName: string;

	/** User's notes section - distilled from their content */
	yourNotes: NoteSection;

	/** Topper insights section - unique additions from toppers */
	topperInsights: NoteSection;

	/** Cross-theme references for revision */
	crossThemeRefs: CrossThemeRef[];

	/** Generation metadata */
	generatedAt: string;
	generationStatus: GenerationStatus;

	/** Generation job ID (if generated async) */
	generationJobId?: string;

	/** Notion sync metadata */
	syncStatus: SyncStatus;
	syncedAt?: string;
	notionPageId?: string;
	notionBlockIds?: string[]; // IDs of created Notion blocks

	/** Error information if generation or sync failed */
	error?: string;

	/** Version for tracking updates */
	version: number;
}

/**
 * Summary of a generated note for list display.
 */
export interface GeneratedNoteSummary {
	id: string;
	projectId?: string;
	mainThemeId: string;
	mainThemeName: string;
	miniThemeId: string;
	miniThemeName: string;
	yourNotesWordCount: number;
	topperInsightsWordCount: number;
	crossThemeCount: number;
	generatedAt: string;
	syncStatus: SyncStatus;
	syncedAt?: string;
}

/**
 * Input for generating notes for a theme.
 */
export interface GenerateNotesInput {
	/** Theme to generate notes for */
	mainThemeId: string;
	miniThemeId: string;

	/** Optional: Specific user content IDs (defaults to all user content for theme) */
	userContentIds?: string[];

	/** Optional: Specific topper content IDs (defaults to all topper content for theme) */
	topperContentIds?: string[];

	/** Optional: Classification job ID to get content from */
	classificationJobId?: string;

	/** Optional: Custom word limits */
	wordLimits?: {
		yourNotes: number;
		topperInsights: number;
	};
}

/**
 * Configuration for note generation.
 */
export interface GenerationConfig {
	/** Maximum words for "Your Notes" section */
	maxYourNotesWords: number;

	/** Maximum words for "Topper Insights" section */
	maxTopperInsightsWords: number;

	/** Minimum relevance score for cross-theme references */
	crossThemeMinRelevance: number;

	/** Whether to include source references */
	includeSourceRefs: boolean;

	/** Whether to include cross-theme section */
	includeCrossThemeSection: boolean;

	/** Format style for output */
	formatStyle: "bullet" | "numbered" | "mixed";
}

/**
 * Default generation configuration.
 */
export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
	maxYourNotesWords: 350,
	maxTopperInsightsWords: 300,
	crossThemeMinRelevance: 0.5,
	includeSourceRefs: false,
	includeCrossThemeSection: true,
	formatStyle: "bullet",
};

/**
 * Input for syncing notes to Notion.
 */
export interface SyncNotesToNotionInput {
	/** Note ID to sync */
	noteId: string;

	/** Notion page ID to sync to (destination) */
	destinationPageId: string;

	/** Optional: API key (uses env var if not provided) */
	apiKey?: string;

	/** Whether to append to existing content or replace */
	mode: "append" | "replace";
}

/**
 * Result of syncing notes to Notion.
 */
export interface SyncResult {
	success: boolean;
	noteId: string;
	notionPageId: string;
	blockIds: string[];
	syncedAt: string;
	error?: string;
}

/**
 * Notion destination configuration.
 */
export interface NotionDestination {
	/** Notion page ID for output */
	pageId: string;

	/** Page title for display */
	pageTitle: string;

	/** Parent page/database info */
	parentType: "page" | "database";
	parentId?: string;

	/** Last verified timestamp */
	verifiedAt?: string;
}

/**
 * Statistics about generated notes.
 */
export interface NotesStats {
	/** Total notes generated */
	totalNotes: number;

	/** Notes synced to Notion */
	syncedNotes: number;

	/** Notes pending sync */
	pendingSyncNotes: number;

	/** Total word count across all notes */
	totalWordCount: number;

	/** Average word count per note */
	averageWordCount: number;

	/** Themes covered */
	themesCovered: number;

	/** Last generation timestamp */
	lastGeneratedAt?: string;

	/** Last sync timestamp */
	lastSyncedAt?: string;
}

/**
 * Processing job type for generation.
 */
export type GenerationJobType = "generation";

/**
 * Generation job for tracking background note generation.
 */
export interface GenerationJob {
	id: string;
	type: GenerationJobType;
	status: GenerationStatus;

	/** Theme being generated */
	mainThemeId: string;
	miniThemeId: string;

	/** Progress (0-100) */
	progress: number;

	/** Generated note ID (when completed) */
	noteId?: string;

	/** Error message if failed */
	error?: string;

	createdAt: string;
	updatedAt: string;
	completedAt?: string;
}
