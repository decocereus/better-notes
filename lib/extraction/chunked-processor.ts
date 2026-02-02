/**
 * Chunked Essay Processor
 * Processes essays from large PDFs in chunks with robust error handling,
 * retry logic, and comprehensive logging to ensure no essays are missed.
 */

import { getFreshModel } from "@/lib/ai/client";
import type {
	EssayBoundary,
	EssayExtractionResult,
	ExtractionParameters,
} from "@/types/extraction";
import type { OcrPageResult } from "@/types/processing";
import { extractContentBatch } from "./content-extractor";
import { detectEssayBoundaries, getEssayText } from "./essay-detector";

/**
 * Regex for splitting text into words.
 */
const WORD_SPLIT_REGEX = /\s+/;

/**
 * Configuration for chunked processing.
 */
export interface ChunkedProcessingConfig {
	/** Number of essays to process in one batch (default: 15) */
	essaysPerChunk: number;
	/** Maximum retries for failed chunks (default: 2) */
	maxRetries: number;
	/** Whether to continue on chunk failure (default: true) */
	continueOnFailure: boolean;
	/** Enable detailed logging (default: true) */
	enableLogging: boolean;
}

export const DEFAULT_CONFIG: ChunkedProcessingConfig = {
	essaysPerChunk: 15,
	maxRetries: 2,
	continueOnFailure: true,
	enableLogging: true,
};

/**
 * Processing statistics for monitoring and debugging.
 */
export interface ProcessingStats {
	totalEssays: number;
	successful: number;
	failed: number;
	retried: number;
	chunksProcessed: number;
	chunksFailed: number;
	totalPages: number;
	pagesCovered: number;
	gaps: Array<{ start: number; end: number }>;
	errors: Array<{ chunkIndex: number; essayIndices: number[]; error: string }>;
}

/**
 * Splits essays into chunks for sequential processing.
 * Each chunk is processed as a unit to maintain context and simplify error handling.
 */
function splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < items.length; i += chunkSize) {
		chunks.push(items.slice(i, i + chunkSize));
	}
	return chunks;
}

interface ChunkOutcomeSuccess {
	success: true;
	results: EssayExtractionResult[];
	globalIndices: number[];
}

interface ChunkOutcomeFailure {
	success: false;
	error: Error;
	globalIndices: number[];
}

type ChunkOutcome = ChunkOutcomeSuccess | ChunkOutcomeFailure;

type ChunkProgressCallback = (
	processedChunks: number,
	totalChunks: number,
	currentEssay: number,
	totalEssays: number
) => void;

interface EssayChunkItem {
	text: string;
	startPage: number;
	endPage: number;
	title?: string;
}

function createEmptyStats(totalPages: number): ProcessingStats {
	return {
		totalEssays: 0,
		successful: 0,
		failed: 0,
		retried: 0,
		chunksProcessed: 0,
		chunksFailed: 0,
		totalPages,
		pagesCovered: 0,
		gaps: [],
		errors: [],
	};
}

function createProcessingStats(
	totalEssays: number,
	totalPages: number
): ProcessingStats {
	return {
		totalEssays,
		successful: 0,
		failed: 0,
		retried: 0,
		chunksProcessed: 0,
		chunksFailed: 0,
		totalPages,
		pagesCovered: 0,
		gaps: [],
		errors: [],
	};
}

async function delayRetry(attempt: number): Promise<void> {
	if (attempt <= 0) {
		return;
	}

	await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
}

function runChunkAttempt({
	chunk,
	chunkIndex,
	retryCount,
	parameters,
	sourceRef,
	startIndex,
	totalChunks,
	totalEssays,
	onProgress,
	log,
}: {
	chunk: EssayChunkItem[];
	chunkIndex: number;
	retryCount: number;
	parameters: ExtractionParameters;
	sourceRef: string;
	startIndex: number;
	totalChunks: number;
	totalEssays: number;
	onProgress?: ChunkProgressCallback;
	log: (message: string, ...args: unknown[]) => void;
}): Promise<EssayExtractionResult[]> {
	const chunkModelFactory = () =>
		getFreshModel("EXTRACTION", `${chunkIndex}-${retryCount}`);

	log(`Creating fresh model instance for chunk ${chunkIndex + 1}`);

	return extractContentBatch(
		chunk,
		parameters,
		sourceRef,
		(processed, _total) => {
			const globalProcessed = startIndex + processed;
			onProgress?.(chunkIndex, totalChunks, globalProcessed, totalEssays);
		},
		Math.min(5, chunk.length),
		chunkModelFactory
	);
}

async function processChunkWithRetries({
	chunk,
	chunkIndex,
	startIndex,
	totalChunks,
	totalEssays,
	parameters,
	sourceRef,
	fullConfig,
	stats,
	onProgress,
	log,
}: {
	chunk: EssayChunkItem[];
	chunkIndex: number;
	startIndex: number;
	totalChunks: number;
	totalEssays: number;
	parameters: ExtractionParameters;
	sourceRef: string;
	fullConfig: ChunkedProcessingConfig;
	stats: ProcessingStats;
	onProgress?: ChunkProgressCallback;
	log: (message: string, ...args: unknown[]) => void;
}): Promise<ChunkOutcome> {
	const globalIndices = chunk.map((_, i) => startIndex + i);
	let lastError: Error | null = null;

	for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
		if (attempt > 0) {
			log(
				`Retrying chunk ${chunkIndex + 1}, attempt ${attempt + 1}/${fullConfig.maxRetries + 1}`
			);
			stats.retried++;
			await delayRetry(attempt);
		}

		try {
			const chunkResults = await runChunkAttempt({
				chunk,
				chunkIndex,
				retryCount: attempt,
				parameters,
				sourceRef,
				startIndex,
				totalChunks,
				totalEssays,
				onProgress,
				log,
			});

			return { success: true, results: chunkResults, globalIndices };
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			log(
				`Chunk ${chunkIndex + 1} failed (attempt ${attempt + 1}/${fullConfig.maxRetries + 1}):`,
				lastError.message
			);
		}
	}

	const failure = lastError ?? new Error("Chunk failed with unknown error");
	stats.chunksFailed++;
	stats.errors.push({
		chunkIndex,
		essayIndices: globalIndices,
		error: failure.message,
	});

	return { success: false, error: failure, globalIndices };
}

function applyChunkResults({
	chunkResults,
	startIndex,
	allResults,
	processedEssays,
	stats,
}: {
	chunkResults: EssayExtractionResult[];
	startIndex: number;
	allResults: EssayExtractionResult[];
	processedEssays: Set<number>;
	stats: ProcessingStats;
}): void {
	for (let i = 0; i < chunkResults.length; i++) {
		const globalIndex = startIndex + i;
		allResults[globalIndex] = chunkResults[i];
		processedEssays.add(globalIndex);

		if (chunkResults[i].items.length > 0) {
			stats.successful++;
		}
	}

	stats.chunksProcessed++;
}

function recordChunkFailure({
	chunk,
	startIndex,
	allResults,
	processedEssays,
	stats,
}: {
	chunk: EssayChunkItem[];
	startIndex: number;
	allResults: EssayExtractionResult[];
	processedEssays: Set<number>;
	stats: ProcessingStats;
}): void {
	for (let i = 0; i < chunk.length; i++) {
		const globalIndex = startIndex + i;
		if (!processedEssays.has(globalIndex)) {
			allResults[globalIndex] = createFailedResult(chunk[i]);
			stats.failed++;
		}
	}
}

/**
 * Processes essays from a large PDF in chunks with retry logic.
 *
 * This approach:
 * 1. First detects all essay boundaries from the full OCR text
 * 2. Splits essays into chunks (default: 15 essays per chunk)
 * 3. Processes each chunk with retry logic
 * 4. Validates that all pages are covered
 * 5. Returns combined results with detailed statistics
 *
 * @param ocrResults - OCR results for all pages
 * @param parameters - Extraction parameters
 * @param sourceRef - Source reference for tracking
 * @param config - Processing configuration
 * @param onProgress - Progress callback (chunk-based, not essay-based)
 * @returns Extraction results and processing statistics
 */
export async function processEssaysInChunks(
	ocrResults: OcrPageResult[],
	parameters: ExtractionParameters,
	sourceRef: string,
	config: Partial<ChunkedProcessingConfig> = {},
	onProgress?: (
		processedChunks: number,
		totalChunks: number,
		currentEssay: number,
		totalEssays: number
	) => void
): Promise<{ results: EssayExtractionResult[]; stats: ProcessingStats }> {
	const fullConfig = { ...DEFAULT_CONFIG, ...config };
	const log = (message: string, ...args: unknown[]) => {
		if (fullConfig.enableLogging) {
			console.log(`[ChunkedProcessor] ${message}`, ...args);
		}
	};

	log("Starting chunked processing", {
		totalPages: ocrResults.length,
		essaysPerChunk: fullConfig.essaysPerChunk,
		maxRetries: fullConfig.maxRetries,
	});

	// Step 1: Detect all essay boundaries
	log("Step 1: Detecting essay boundaries...");
	const boundaries = await detectEssayBoundaries(
		ocrResults,
		(processed, total) => {
			log(`Boundary detection: ${processed}/${total} batches`);
		}
	);

	log(`Detected ${boundaries.length} essays`);

	if (boundaries.length === 0) {
		log("WARNING: No essays detected!");
		return {
			results: [],
			stats: createEmptyStats(ocrResults.length),
		};
	}

	// Step 2: Prepare essay data
	const essays = boundaries.map((boundary) => ({
		text: getEssayText(ocrResults, boundary),
		startPage: boundary.startPage,
		endPage: boundary.endPage,
		title: boundary.title,
	}));

	// Step 3: Split into chunks
	const chunks = splitIntoChunks(essays, fullConfig.essaysPerChunk);
	log(
		`Split into ${chunks.length} chunks of max ${fullConfig.essaysPerChunk} essays each`
	);

	// Step 4: Process each chunk with retry logic
	const allResults: EssayExtractionResult[] = new Array(essays.length);
	const stats = createProcessingStats(essays.length, ocrResults.length);

	// Track which essays have been processed
	const processedEssays = new Set<number>();

	for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
		const chunk = chunks[chunkIndex];
		const startIndex = chunkIndex * fullConfig.essaysPerChunk;

		log(
			`Processing chunk ${chunkIndex + 1}/${chunks.length} (essays ${startIndex + 1}-${startIndex + chunk.length})`
		);

		const outcome = await processChunkWithRetries({
			chunk,
			chunkIndex,
			startIndex,
			totalChunks: chunks.length,
			totalEssays: essays.length,
			parameters,
			sourceRef,
			fullConfig,
			stats,
			onProgress,
			log,
		});

		if (outcome.success) {
			applyChunkResults({
				chunkResults: outcome.results,
				startIndex,
				allResults,
				processedEssays,
				stats,
			});
			log(
				`Chunk ${chunkIndex + 1} completed successfully (${outcome.results.length} essays)`
			);
		} else {
			recordChunkFailure({
				chunk,
				startIndex,
				allResults,
				processedEssays,
				stats,
			});

			if (!fullConfig.continueOnFailure) {
				throw new Error(
					`Chunk ${chunkIndex + 1} failed after ${fullConfig.maxRetries} retries: ${outcome.error.message}`
				);
			}
		}

		// Report progress after each chunk
		onProgress?.(
			chunkIndex + 1,
			chunks.length,
			startIndex + chunk.length,
			essays.length
		);
	}

	// Step 5: Validate coverage
	log("Validating page coverage...");
	const coverage = calculatePageCoverage(boundaries, ocrResults.length);
	stats.pagesCovered = coverage.coveredPages;
	stats.gaps = coverage.gaps;

	log("Processing complete:", {
		totalEssays: stats.totalEssays,
		successful: stats.successful,
		failed: stats.failed,
		retried: stats.retried,
		chunksProcessed: stats.chunksProcessed,
		chunksFailed: stats.chunksFailed,
		pageCoverage: `${((stats.pagesCovered / stats.totalPages) * 100).toFixed(1)}%`,
		gapsFound: stats.gaps.length,
	});

	if (stats.gaps.length > 0) {
		log("WARNING: Page gaps detected:", stats.gaps);
	}

	if (stats.failed > 0) {
		log("WARNING: Failed essays:", stats.failed);
	}

	return { results: allResults, stats };
}

/**
 * Calculates page coverage from detected boundaries.
 */
function calculatePageCoverage(
	boundaries: EssayBoundary[],
	totalPages: number
): { coveredPages: number; gaps: Array<{ start: number; end: number }> } {
	if (boundaries.length === 0) {
		return { coveredPages: 0, gaps: [{ start: 1, end: totalPages }] };
	}

	// Sort by start page
	const sorted = [...boundaries].sort((a, b) => a.startPage - b.startPage);

	// Build coverage map
	const coveredPages = new Set<number>();
	for (const boundary of sorted) {
		for (let page = boundary.startPage; page <= boundary.endPage; page++) {
			coveredPages.add(page);
		}
	}

	// Find gaps
	const gaps: Array<{ start: number; end: number }> = [];
	let currentPage = 1;

	while (currentPage <= totalPages) {
		if (coveredPages.has(currentPage)) {
			currentPage++;
		} else {
			// Start of a gap
			const gapStart = currentPage;
			let gapEnd = currentPage;

			while (gapEnd < totalPages && !coveredPages.has(gapEnd + 1)) {
				gapEnd++;
			}

			gaps.push({ start: gapStart, end: gapEnd });
			currentPage = gapEnd + 1;
		}
	}

	return { coveredPages: coveredPages.size, gaps };
}

/**
 * Creates a failed result placeholder.
 */
function createFailedResult(essay: EssayChunkItem): EssayExtractionResult {
	const wordCount = essay.text.split(WORD_SPLIT_REGEX).filter(Boolean).length;

	return {
		essayTitle: essay.title,
		startPage: essay.startPage,
		endPage: essay.endPage,
		items: [],
		sections: [],
		overallQuality: "low",
		wordCount,
	};
}

/**
 * Validates that detected boundaries make sense for a large PDF.
 * Returns warnings if something looks off.
 */
export function validateLargePdfBoundaries(
	boundaries: EssayBoundary[],
	totalPages: number
): { valid: boolean; warnings: string[] } {
	const warnings: string[] = [];

	if (boundaries.length === 0) {
		return { valid: false, warnings: ["No essays detected"] };
	}

	// Check if essay count seems reasonable for page count
	const expectedEssays = Math.floor(totalPages / 4); // ~4 pages per essay on average
	if (boundaries.length < expectedEssays * 0.5) {
		warnings.push(
			`Detected only ${boundaries.length} essays for ${totalPages} pages (expected ~${expectedEssays})`
		);
	}

	// Check for very long essays (might indicate merged essays)
	const longEssays = boundaries.filter((b) => b.endPage - b.startPage > 10);
	if (longEssays.length > boundaries.length * 0.3) {
		warnings.push(
			`${longEssays.length} essays are very long (>10 pages), may indicate merged boundaries`
		);
	}

	// Check for very short essays
	const shortEssays = boundaries.filter((b) => b.endPage === b.startPage);
	if (shortEssays.length > boundaries.length * 0.3) {
		warnings.push(
			`${shortEssays.length} essays are only 1 page, may indicate fragmented boundaries`
		);
	}

	// Check coverage
	const { coveredPages } = calculatePageCoverage(boundaries, totalPages);
	const coverage = (coveredPages / totalPages) * 100;
	if (coverage < 90) {
		warnings.push(
			`Low page coverage: ${coverage.toFixed(1)}% (${coveredPages}/${totalPages} pages)`
		);
	}

	return { valid: warnings.length === 0, warnings };
}
