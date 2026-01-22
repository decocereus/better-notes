/**
 * PDF Page Renderer
 * Handles rendering PDF pages for OCR processing.
 * Supports both text extraction and image rendering for handwritten content.
 */

import type {
	PDFDocumentProxy,
	PDFPageProxy,
	TextItem,
} from "pdfjs-dist/types/src/display/api";
import type { PageRange, PdfLoadResult } from "./stream";

/**
 * Extracted text from a PDF page.
 */
export interface PageTextContent {
	/** Page number (1-indexed) */
	pageNumber: number;
	/** Extracted text content */
	text: string;
	/** Number of text items found */
	itemCount: number;
	/** Whether the page appears to have significant text */
	hasText: boolean;
	/** Page dimensions */
	dimensions: {
		width: number;
		height: number;
	};
}

/**
 * Result of rendering a page for OCR.
 */
export interface PageRenderResult {
	/** Page number (1-indexed) */
	pageNumber: number;
	/** Whether the page needs OCR (low text content detected) */
	needsOcr: boolean;
	/** Extracted text (if available) */
	text?: string;
	/** Page dimensions */
	dimensions: {
		width: number;
		height: number;
	};
}

/**
 * Options for page rendering.
 */
export interface RenderOptions {
	/** Minimum text characters to consider a page as having text */
	minTextThreshold?: number;
	/** Scale factor for rendering (default: 2 for good OCR quality) */
	scale?: number;
}

const DEFAULT_RENDER_OPTIONS: Required<RenderOptions> = {
	minTextThreshold: 50, // Pages with less than 50 chars likely need OCR
	scale: 2,
};

/**
 * Extracts text content from a single PDF page.
 */
export async function extractPageText(
	page: PDFPageProxy
): Promise<PageTextContent> {
	const textContent = await page.getTextContent();
	const viewport = page.getViewport({ scale: 1 });

	// Combine all text items
	const textItems = textContent.items.filter(
		(item): item is TextItem => "str" in item
	);
	const text = textItems.map((item) => item.str).join(" ");

	return {
		pageNumber: page.pageNumber,
		text: text.trim(),
		itemCount: textItems.length,
		hasText: text.trim().length > 50,
		dimensions: {
			width: viewport.width,
			height: viewport.height,
		},
	};
}

/**
 * Extracts text from multiple pages.
 */
export async function extractPagesText(
	document: PDFDocumentProxy,
	range: PageRange
): Promise<PageTextContent[]> {
	const results: PageTextContent[] = [];

	for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
		const page = await document.getPage(pageNum);
		const textContent = await extractPageText(page);
		results.push(textContent);
	}

	return results;
}

/**
 * Analyzes pages to determine which need OCR.
 * Handwritten PDFs will have very little extractable text.
 */
export async function analyzePagesForOcr(
	document: PDFDocumentProxy,
	options: RenderOptions = {}
): Promise<PageRenderResult[]> {
	const opts = { ...DEFAULT_RENDER_OPTIONS, ...options };
	const results: PageRenderResult[] = [];

	for (let pageNum = 1; pageNum <= document.numPages; pageNum++) {
		const page = await document.getPage(pageNum);
		const textContent = await extractPageText(page);

		results.push({
			pageNumber: pageNum,
			needsOcr: textContent.text.length < opts.minTextThreshold,
			text: textContent.hasText ? textContent.text : undefined,
			dimensions: textContent.dimensions,
		});
	}

	return results;
}

/**
 * Quick check to determine if a PDF is mostly handwritten.
 * Samples a few pages to make the determination.
 */
export async function isHandwrittenPdf(
	document: PDFDocumentProxy,
	sampleSize = 5
): Promise<{
	isHandwritten: boolean;
	confidence: number;
	sampledPages: number;
	pagesWithText: number;
}> {
	const totalPages = document.numPages;
	const pagesToSample = Math.min(sampleSize, totalPages);

	// Sample pages evenly distributed through the document
	const sampleIndices: number[] = [];
	for (let i = 0; i < pagesToSample; i++) {
		const index = Math.floor((i / pagesToSample) * totalPages) + 1;
		sampleIndices.push(Math.min(index, totalPages));
	}

	let pagesWithText = 0;

	for (const pageNum of sampleIndices) {
		const page = await document.getPage(pageNum);
		const textContent = await extractPageText(page);

		if (textContent.hasText) {
			pagesWithText++;
		}
	}

	const textRatio = pagesWithText / pagesToSample;
	const isHandwritten = textRatio < 0.3; // Less than 30% pages have extractable text

	return {
		isHandwritten,
		confidence: isHandwritten ? 1 - textRatio : textRatio,
		sampledPages: pagesToSample,
		pagesWithText,
	};
}

/**
 * Prepares pages for OCR processing by batching them.
 */
export function preparePagesForOcr(
	pdfResult: PdfLoadResult,
	analysisResults: PageRenderResult[]
): {
	pagesNeedingOcr: number[];
	pagesWithText: number[];
	totalPages: number;
	ocrPercentage: number;
} {
	const pagesNeedingOcr: number[] = [];
	const pagesWithText: number[] = [];

	for (const result of analysisResults) {
		if (result.needsOcr) {
			pagesNeedingOcr.push(result.pageNumber);
		} else {
			pagesWithText.push(result.pageNumber);
		}
	}

	return {
		pagesNeedingOcr,
		pagesWithText,
		totalPages: pdfResult.metadata.pageCount,
		ocrPercentage: (pagesNeedingOcr.length / analysisResults.length) * 100,
	};
}

/**
 * Creates a processing plan for a PDF.
 * Determines the optimal approach based on content analysis.
 */
export async function createProcessingPlan(pdfResult: PdfLoadResult): Promise<{
	approach: "ocr_all" | "ocr_partial" | "text_only";
	estimatedOcrPages: number;
	estimatedTextPages: number;
	recommendation: string;
}> {
	const { document } = pdfResult;

	// Quick handwritten check
	const handwrittenCheck = await isHandwrittenPdf(document);

	if (handwrittenCheck.isHandwritten && handwrittenCheck.confidence > 0.7) {
		// High confidence it's handwritten - OCR all pages
		return {
			approach: "ocr_all",
			estimatedOcrPages: document.numPages,
			estimatedTextPages: 0,
			recommendation:
				"PDF appears to be handwritten. All pages will be processed with OCR.",
		};
	}

	// Do a full analysis for mixed content
	const analysisResults = await analyzePagesForOcr(document);
	const ocrPages = analysisResults.filter((r) => r.needsOcr).length;
	const textPages = analysisResults.length - ocrPages;

	if (ocrPages === 0) {
		return {
			approach: "text_only",
			estimatedOcrPages: 0,
			estimatedTextPages: textPages,
			recommendation:
				"PDF has extractable text. No OCR needed - text will be extracted directly.",
		};
	}

	if (ocrPages > textPages * 2) {
		return {
			approach: "ocr_all",
			estimatedOcrPages: document.numPages,
			estimatedTextPages: 0,
			recommendation:
				"PDF is mostly images/handwritten. All pages will be processed with OCR for consistency.",
		};
	}

	return {
		approach: "ocr_partial",
		estimatedOcrPages: ocrPages,
		estimatedTextPages: textPages,
		recommendation: `Mixed content detected. ${ocrPages} pages need OCR, ${textPages} pages have extractable text.`,
	};
}
