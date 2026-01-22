/**
 * Extraction Module
 * Exports all extraction-related functionality.
 * @module lib/extraction
 */

export {
	extractContentBatch,
	extractContentFromEssay,
	getExtractionStats,
	getHighValueContent,
	getMultiUseContent,
	groupByType,
} from "./content-extractor";
export {
	detectEssayBoundaries,
	getEssayText,
	validateBoundaries,
} from "./essay-detector";

export {
	assessMultiUse,
	calculateQuality,
	filterByQuality,
	getDefaultOverusedList,
	isOverusedExample,
} from "./quality";
