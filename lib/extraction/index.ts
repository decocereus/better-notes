/**
 * Extraction Module
 * Exports all extraction-related functionality.
 * @module lib/extraction
 */

export type {
	ChunkedProcessingConfig,
	ProcessingStats,
} from "./chunked-processor";
export {
	DEFAULT_CONFIG as CHUNKED_PROCESSOR_DEFAULTS,
	processEssaysInChunks,
	validateLargePdfBoundaries,
} from "./chunked-processor";
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
