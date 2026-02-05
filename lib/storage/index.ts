/**
 * Storage module for R2 file operations.
 * @module lib/storage
 */

export {
	getEssayBoundariesKey,
	loadEssayBoundaries,
	storeEssayBoundaries,
} from "./essay-boundaries";
export {
	buildNoteStorageKey,
	listNoteKeys,
	loadNote,
	storeNote,
} from "./notes";
// OCR results storage helpers
export {
	getAllOcrResults,
	getCombinedOcrResults,
	getOcrResultsForPages,
	getOcrStatus,
	getPageOcrResult,
	isOcrComplete,
	listOcrResults,
	storeOcrStatus,
	storePageOcrResult,
	streamCombinedText,
} from "./ocr-results";
// Page images storage helpers
export {
	getAllPageImageUrls,
	getAssetMetadata,
	getConversionStatus,
	getPageCount,
	getPageImageKey,
	getPageImageUrl,
	isConversionComplete,
	listPageImages,
} from "./page-images";
export {
	deleteFromR2,
	downloadFromR2,
	generateProcessingResultKey,
	generateProjectFileKey,
	getR2BucketName,
	getR2Client,
	getR2FileInfo,
	listR2Files,
	uploadToR2,
	validateR2Config,
} from "./r2-client";
export type {
	ReadUrlOptions,
	ReadUrlResult,
	UploadUrlOptions,
	UploadUrlResult,
} from "./signed-urls";
export {
	getBatchReadUrls,
	getDownloadUrl,
	getInlineViewUrl,
	getReadUrl,
	getUploadUrl,
} from "./signed-urls";
