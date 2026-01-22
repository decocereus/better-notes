/**
 * Types for comparison and gap analysis between user and topper content.
 * Used to identify what content the user is missing compared to toppers.
 */

import type {
	ContentType,
	ExampleCategory,
	ExtractedContent,
} from "./extraction";

/**
 * Severity level of a content gap.
 */
export type GapSeverity = "high" | "medium" | "low";

/**
 * Type of suggestion for improvement.
 */
export type SuggestionType = "add" | "improve" | "diversify";

/**
 * Coverage statistics for a specific content type.
 * Compares what user has vs what toppers have.
 */
export interface CoverageStat {
	/** Content type being measured */
	contentType: ContentType;

	/** Number of items user has */
	userCount: number;

	/** Number of items toppers have */
	topperCount: number;

	/** IDs of content user has */
	userContentIds: string[];

	/** IDs of topper content user is missing */
	topperUniqueIds: string[];

	/** Number of overlapping/similar items (semantic matches) */
	overlapCount: number;

	/** Coverage percentage (0-100) */
	coveragePercent: number;
}

/**
 * Coverage statistics grouped by example category.
 * Only applicable for content type "example".
 */
export interface ExampleCategoryCoverage {
	/** Example category */
	category: ExampleCategory;

	/** Number of user examples in this category */
	userCount: number;

	/** Number of topper examples in this category */
	topperCount: number;

	/** IDs of user examples */
	userContentIds: string[];

	/** IDs of topper examples user is missing */
	topperUniqueIds: string[];

	/** Coverage percentage (0-100) */
	coveragePercent: number;
}

/**
 * An identified gap in user's content compared to toppers.
 */
export interface ContentGap {
	/** Unique ID for this gap */
	id: string;

	/** Content type where gap exists */
	contentType: ContentType;

	/** Example category (only for example type) */
	exampleCategory?: ExampleCategory;

	/** Human-readable description of the gap */
	description: string;

	/** How critical this gap is */
	severity: GapSeverity;

	/** Specific topper content that illustrates this gap */
	topperContentIds: string[];

	/** Why this gap matters for essay preparation */
	reasoning: string;

	/** Number of topper items illustrating this gap */
	count: number;
}

/**
 * An actionable suggestion for improvement.
 */
export interface ComparisonSuggestion {
	/** Unique ID for this suggestion */
	id: string;

	/** Type of action recommended */
	type: SuggestionType;

	/** Human-readable suggestion */
	description: string;

	/** Priority level (matches gap severity) */
	priority: GapSeverity;

	/** Content type this suggestion relates to */
	contentType: ContentType;

	/** Example category (if applicable) */
	exampleCategory?: ExampleCategory;

	/** Topper content to reference for inspiration */
	referenceContentIds: string[];

	/** Specific action items */
	actionItems: string[];
}

/**
 * Quality comparison between user and topper content.
 */
export interface QualityComparison {
	/** User's content quality distribution */
	userQuality: {
		high: number;
		medium: number;
		low: number;
	};

	/** Topper's content quality distribution */
	topperQuality: {
		high: number;
		medium: number;
		low: number;
	};

	/** User's average quality score (0-1, where high=1, medium=0.5, low=0) */
	userAverageScore: number;

	/** Topper's average quality score */
	topperAverageScore: number;

	/** User's overused content count */
	userOverusedCount: number;

	/** User's multi-use content count */
	userMultiUseCount: number;

	/** Topper's multi-use content count */
	topperMultiUseCount: number;
}

/**
 * Complete comparison result for a theme.
 */
export interface ThemeComparisonResult {
	/** Theme identifiers */
	mainThemeId: string;
	mainThemeName: string;
	miniThemeId: string;
	miniThemeName: string;

	/** When comparison was performed */
	comparedAt: string;

	/** Coverage statistics by content type */
	coverage: CoverageStat[];

	/** Coverage by example category (for examples) */
	exampleCoverage: ExampleCategoryCoverage[];

	/** Identified gaps */
	gaps: ContentGap[];

	/** Suggestions for improvement */
	suggestions: ComparisonSuggestion[];

	/** Quality comparison */
	quality: QualityComparison;

	/** Overall readiness score (0-100) */
	overallScore: number;

	/** Score breakdown */
	scoreBreakdown: {
		/** Coverage score contribution */
		coverageScore: number;
		/** Quality score contribution */
		qualityScore: number;
		/** Diversity score contribution */
		diversityScore: number;
	};

	/** Summary statistics */
	summary: {
		/** Total user content items */
		userContentCount: number;
		/** Total topper content items */
		topperContentCount: number;
		/** Number of high severity gaps */
		highSeverityGaps: number;
		/** Number of medium severity gaps */
		mediumSeverityGaps: number;
		/** Number of low severity gaps */
		lowSeverityGaps: number;
		/** Number of suggestions */
		suggestionCount: number;
	};
}

/**
 * Summary of comparison across all themes.
 */
export interface ComparisonSummary {
	/** When summary was generated */
	generatedAt: string;

	/** Total themes compared */
	themesCompared: number;

	/** Average overall score across themes */
	averageScore: number;

	/** Themes sorted by score (lowest first - needs most attention) */
	themesByScore: Array<{
		mainThemeId: string;
		miniThemeId: string;
		themeName: string;
		score: number;
	}>;

	/** Aggregated gaps across all themes */
	aggregatedGaps: {
		/** Total gaps by severity */
		bySeverity: Record<GapSeverity, number>;
		/** Total gaps by content type */
		byContentType: Record<ContentType, number>;
		/** Most common gap types */
		mostCommon: Array<{
			contentType: ContentType;
			exampleCategory?: ExampleCategory;
			count: number;
		}>;
	};

	/** Top priority suggestions across all themes */
	topSuggestions: ComparisonSuggestion[];

	/** Themes that need most attention */
	priorityThemes: Array<{
		mainThemeId: string;
		miniThemeId: string;
		themeName: string;
		score: number;
		highSeverityGaps: number;
	}>;
}

/**
 * Input for starting a comparison analysis.
 */
export interface StartComparisonInput {
	/** Theme to compare */
	mainThemeId: string;
	miniThemeId: string;

	/** User content IDs to include (or 'all' for all user content in theme) */
	userContentIds?: string[] | "all";

	/** Topper content IDs to compare against (or 'all' for all topper content in theme) */
	topperContentIds?: string[] | "all";

	/** Optional: Custom scoring weights */
	scoringWeights?: {
		coverage: number;
		quality: number;
		diversity: number;
	};
}

/**
 * Helper type for content grouped by source type.
 */
export interface SourceGroupedContent {
	user: ExtractedContent[];
	topper: ExtractedContent[];
}

/**
 * Helper type for scoring configuration.
 */
export interface ScoringConfig {
	/** Weight for coverage in overall score (0-1) */
	coverageWeight: number;
	/** Weight for quality in overall score (0-1) */
	qualityWeight: number;
	/** Weight for diversity in overall score (0-1) */
	diversityWeight: number;

	/** Minimum items for "good" coverage per type */
	minGoodCoverage: Record<ContentType, number>;

	/** Severity thresholds */
	severityThresholds: {
		/** Coverage below this is high severity gap */
		highSeverity: number;
		/** Coverage below this is medium severity gap */
		mediumSeverity: number;
	};
}

/**
 * Default scoring configuration.
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
	coverageWeight: 0.4,
	qualityWeight: 0.35,
	diversityWeight: 0.25,

	minGoodCoverage: {
		introduction: 3,
		conclusion: 3,
		example: 5,
		quote: 4,
		thinker: 3,
		argument: 4,
		book_poem: 2,
		keyword_phrase: 5,
	},

	severityThresholds: {
		highSeverity: 0.3, // Below 30% coverage = high severity
		mediumSeverity: 0.6, // Below 60% coverage = medium severity
	},
};
