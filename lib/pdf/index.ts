/**
 * PDF processing module.
 * Handles PDF streaming, parsing, and rendering for OCR.
 */

export type {
	PageRenderResult,
	PageTextContent,
	RenderOptions,
} from "./renderer";
export {
	analyzePagesForOcr,
	createProcessingPlan,
	extractPagesText,
	extractPageText,
	isHandwrittenPdf,
	preparePagesForOcr,
} from "./renderer";
export type {
	PageRange,
	PdfLoadOptions,
	PdfLoadResult,
	PdfMetadata,
} from "./stream";
export {
	calculateOptimalBatchSize,
	createPageRanges,
	estimateProcessingTime,
	getPdfMetadata,
	loadPdfFromR2,
} from "./stream";
