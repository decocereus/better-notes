/**
 * Content classification and extraction types.
 * Used for mapping content to themes and storing processed data.
 */

/**
 * Classification result mapping content to themes
 */
export interface ContentClassification {
	id: string;
	sourceId: string;
	/** Main theme ID */
	themeId: string;
	/** Mini theme ID (optional, for more specific classification) */
	miniThemeId?: string;
	/** Relevance score from 0 to 1 */
	relevanceScore: number;
	/** Extracted content snippet relevant to this theme */
	snippet: string;
	/** Cross-reference to other applicable themes */
	crossReferences: string[];
	classifiedAt: string;
}

/**
 * Extracted pattern from topper essays
 */
export interface TopperPattern {
	id: string;
	sourceId: string;
	/** Pattern category */
	type: PatternType;
	/** Pattern description/content */
	content: string;
	/** Examples from the essay */
	examples: string[];
	extractedAt: string;
}

export type PatternType =
	| "intro_technique"
	| "body_structure"
	| "example_type"
	| "conclusion_style"
	| "transition"
	| "argument_style";

/**
 * Overused example that should be flagged
 */
export interface OverusedExample {
	name: string;
	count: number;
	contexts: string[];
}

/**
 * Generated notes for a theme (dual-section structure)
 */
export interface ThemeNotes {
	id: string;
	themeId: string;
	themeName: string;
	/** User's classified content - concise and revision-ready */
	userNotes: string;
	/** Topper insights - enriches user content */
	topperInsights: string;
	generatedAt: string;
	/** Source content IDs used for generation */
	sourceIds: string[];
}

/**
 * Comparison result between user and topper content
 */
export interface ComparisonResult {
	id: string;
	themeId: string;
	/** What user has covered */
	userCoverage: string[];
	/** What toppers have that user is missing */
	gaps: string[];
	/** Suggestions for improvement */
	suggestions: string[];
	comparedAt: string;
}
