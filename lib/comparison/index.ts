/**
 * Comparison Module
 * Gap analysis and suggestion generation for user vs topper content.
 */

export {
	analyzeGaps,
	DEFAULT_SCORING_CONFIG,
	filterBySource,
	getReadinessAssessment,
	getTopperContentForGap,
} from "./gap-analyzer";

export {
	generateSuggestions,
	generateSuggestionsWithLLM,
	getTopSuggestionsAcrossThemes,
	groupSuggestionsByType,
	prioritizeSuggestions,
	summarizeSuggestions,
} from "./suggestions";
