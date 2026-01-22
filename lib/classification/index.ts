/**
 * Classification Module
 * Exports all classification-related functionality.
 */

export {
	type AggregationSummary,
	aggregateContentByTheme,
	compareSourcesForTheme,
	findUndercoveredThemes,
	getAggregationSummary,
	getThemeContent,
	getUniqueContent,
	type ThemeContent,
} from "./aggregator";
export {
	classifyContent,
	classifyContentBatch,
	findContentByTheme,
	getClassificationStats,
	getContentByRelevance,
	reclassifyContent,
} from "./classifier";
export {
	analyzeCrossThemeContent,
	type CrossThemeAnalysis,
	type CrossThemeRef,
	createCrossThemeRefs,
	findCommonThemes,
	findCrossThemeContent,
	findHighValueCrossTheme,
	findRelatedContent,
	getCrossThemeStatsByType,
	groupByThemeCount,
	updateMultiUseFlags,
} from "./cross-theme";
