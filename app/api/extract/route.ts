/**
 * Extraction API Route
 * Starts and manages content extraction jobs from OCR results.
 *
 * POST: Start a new extraction job
 *   - With assetId: Uses new per-page OCR format from R2
 *   - With ocrJobId: Uses legacy OCR job results format
 * GET: Get job status and results
 */

import { type NextRequest, NextResponse } from "next/server";
import { getModel, validateAIConfig } from "@/lib/ai";
import { getFreshModel } from "@/lib/ai/client";
import {
	detectEssayBoundaries,
	extractContentBatch,
	getEssayText,
	getExtractionStats,
	processEssaysInChunks,
	validateBoundaries,
	validateLargePdfBoundaries,
} from "@/lib/extraction";
import { getModelForTask } from "@/lib/llm/provider";
import {
	addJobError,
	addJobResult,
	completeJob,
	createJob,
	failJob,
	getJob,
	updateJobProgress,
} from "@/lib/processing";
import {
	downloadFromR2,
	loadEssayBoundaries,
	storeEssayBoundaries,
	uploadToR2,
	validateR2Config,
} from "@/lib/storage";
import type {
	EssayBoundary,
	EssayExtractionResult,
	ExtractedContent,
	ExtractionParameters,
} from "@/types/extraction";
import { DEFAULT_EXTRACTION_PARAMETERS } from "@/types/extraction";
import type { PageOcrResult } from "@/types/ocr";
import type {
	OcrJobResults,
	OcrPageResult,
	StartExtractionJobInput,
} from "@/types/processing";

/**
 * Results stored for an extraction job.
 */
interface ExtractionJobResults {
	jobId: string;
	ocrJobId?: string;
	assetId?: string;
	sourceKey: string;
	totalEssays: number;
	essays: EssayExtractionResult[];
	allItems: ExtractedContent[];
	stats: ReturnType<typeof getExtractionStats>;
	parameters: ExtractionParameters;
	processedAt: string;
}

/**
 * Converts new PageOcrResult format to legacy OcrPageResult format.
 * The formats are mostly compatible, just need to add hasHandwriting field.
 */
function convertToLegacyOcrFormat(pages: PageOcrResult[]): OcrPageResult[] {
	return pages.map((page) => ({
		pageNumber: page.pageNumber,
		text: page.text,
		confidence: page.confidence,
		wordCount: page.wordCount,
		hasHandwriting: true, // Assume handwritten for UPSC essays
		processingTimeMs: page.processingTimeMs,
	}));
}

/**
 * Validates that required services are configured.
 */
function validateRequiredConfigs():
	| { valid: true }
	| { valid: false; response: NextResponse } {
	const r2Config = validateR2Config();
	if (!r2Config.valid) {
		return {
			valid: false,
			response: NextResponse.json(
				{
					error: "R2 storage not configured",
					details: `Missing: ${r2Config.missing.join(", ")}`,
				},
				{ status: 503 }
			),
		};
	}

	const aiConfig = validateAIConfig();
	if (!aiConfig.valid) {
		return {
			valid: false,
			response: NextResponse.json(
				{ error: aiConfig.error || "AI not configured" },
				{ status: 503 }
			),
		};
	}

	return { valid: true };
}

/**
 * Updates asset status in Convex when starting extraction.
 */
async function updateAssetExtractionStatus(
	assetId: string,
	jobId: string
): Promise<void> {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return;
	}

	const { ConvexHttpClient } = await import("convex/browser");
	const { api } = await import("@/convex/_generated/api");
	const convex = new ConvexHttpClient(convexUrl);

	await convex.mutation(api.assets.updateStatus, {
		id: assetId as never,
		status: "extraction_processing",
		extractionJobId: jobId,
		lastError: "",
	});
}

async function updateAssetExtractionFailure(
	assetId: string,
	errorMessage: string
): Promise<void> {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return;
	}

	const { ConvexHttpClient } = await import("convex/browser");
	const { api } = await import("@/convex/_generated/api");
	const convex = new ConvexHttpClient(convexUrl);

	await convex.mutation(api.assets.updateStatus, {
		id: assetId as never,
		status: "extraction_failed",
		lastError: errorMessage,
	});
}

/**
 * POST /api/extract
 * Starts a new extraction job from OCR results.
 *
 * Supports two modes:
 * - assetId only: Uses new per-page OCR format from R2
 * - ocrJobId: Uses legacy OCR job results format
 */
type ValidStartExtractionRequest = Pick<
	StartExtractionJobInput,
	| "ocrJobId"
	| "parameters"
	| "assetId"
	| "modelConfig"
	| "force"
	| "onlyMissingEssays"
	| "essayIndices"
	| "recomputeBoundaries"
> & { hasPartialRequest: boolean };

function validateStartExtractionRequest(
	body: StartExtractionJobInput
):
	| { valid: true; value: ValidStartExtractionRequest }
	| { valid: false; response: NextResponse } {
	const {
		ocrJobId,
		parameters,
		assetId,
		modelConfig,
		force,
		onlyMissingEssays,
		essayIndices,
		recomputeBoundaries,
	} = body;

	if (!(assetId || ocrJobId)) {
		return {
			valid: false,
			response: NextResponse.json(
				{ error: "Either assetId or ocrJobId is required" },
				{ status: 400 }
			),
		};
	}

	const hasPartialRequest =
		onlyMissingEssays === true || (essayIndices?.length ?? 0) > 0;

	if (hasPartialRequest && !assetId) {
		return {
			valid: false,
			response: NextResponse.json(
				{ error: "Partial re-extraction requires assetId" },
				{ status: 400 }
			),
		};
	}

	if (hasPartialRequest && recomputeBoundaries) {
		return {
			valid: false,
			response: NextResponse.json(
				{
					error:
						"recomputeBoundaries is not supported for partial re-extraction. Run a full re-extract if you need to recompute boundaries.",
				},
				{ status: 400 }
			),
		};
	}

	return {
		valid: true,
		value: {
			ocrJobId,
			parameters,
			assetId,
			modelConfig,
			force,
			onlyMissingEssays,
			essayIndices,
			recomputeBoundaries,
			hasPartialRequest,
		},
	};
}

function startExtractionWithErrorHandling({
	assetId,
	jobId,
	sourceKey,
	loadAssetId,
	loadOcrJobId,
	metadataOcrJobId,
	parameters,
	modelId,
	onlyMissingEssays,
	essayIndices,
	recomputeBoundaries,
}: {
	jobId: string;
	sourceKey: string;
	loadAssetId?: string;
	loadOcrJobId?: string;
	metadataOcrJobId?: string;
	parameters: ExtractionParameters;
	assetId?: string;
	modelId?: string;
	onlyMissingEssays?: boolean;
	essayIndices?: number[];
	recomputeBoundaries?: boolean;
}): void {
	startExtractionInBackground({
		jobId,
		sourceKey,
		loadAssetId,
		loadOcrJobId,
		metadataOcrJobId,
		parameters,
		assetId,
		modelId,
		onlyMissingEssays,
		essayIndices,
		recomputeBoundaries,
	}).catch((error) => {
		console.error(`Extraction job ${jobId} failed:`, error);
		failJob(jobId, error instanceof Error ? error.message : "Unknown error");
		if (assetId) {
			updateAssetExtractionFailure(
				assetId,
				error instanceof Error ? error.message : "Unknown error"
			).catch(() => {
				// Silently ignore failure update errors
			});
		}
	});
}

export async function POST(request: NextRequest) {
	try {
		// Validate configurations
		const configCheck = validateRequiredConfigs();
		if (!configCheck.valid) {
			return configCheck.response;
		}

		// Parse request
		const body = (await request.json()) as StartExtractionJobInput;
		const validation = validateStartExtractionRequest(body);
		if (!validation.valid) {
			return validation.response;
		}
		const {
			ocrJobId,
			parameters,
			assetId,
			modelConfig,
			force,
			onlyMissingEssays,
			essayIndices,
			recomputeBoundaries,
		} = validation.value;

		const resolution = assetId
			? await resolveAssetExtractionStart(assetId, force)
			: await resolveLegacyExtractionStart(ocrJobId);

		if (resolution.kind === "response") {
			return resolution.response;
		}

		const { sourceKey, projectId, metadataOcrJobId } = resolution;

		// Merge with default parameters
		const extractionParams: ExtractionParameters = {
			...DEFAULT_EXTRACTION_PARAMETERS,
			...parameters,
		};

		// Create the extraction job
		const job = await createJob("extraction", sourceKey, projectId, 1);

		// Update asset status if provided
		if (assetId) {
			await updateAssetExtractionStatus(assetId, job.id);
		}

		// Start processing in the background
		const modelId = getModelForTask("pattern_extraction", modelConfig);

		startExtractionWithErrorHandling({
			assetId,
			jobId: job.id,
			sourceKey,
			loadAssetId: assetId,
			loadOcrJobId: ocrJobId,
			metadataOcrJobId,
			parameters: extractionParams,
			modelId,
			onlyMissingEssays,
			essayIndices,
			recomputeBoundaries,
		});

		return NextResponse.json(
			{
				jobId: job.id,
				status: job.status,
				ocrJobId: ocrJobId || undefined,
				assetId: assetId || undefined,
				sourceKey,
			},
			{ status: 202 }
		);
	} catch (error) {
		console.error("Failed to start extraction job:", error);
		return NextResponse.json(
			{
				error: "Failed to start extraction job",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

type StartResolution =
	| {
			kind: "start";
			sourceKey: string;
			projectId?: string;
			metadataOcrJobId?: string;
	  }
	| { kind: "response"; response: NextResponse };

async function resolveAssetExtractionStart(
	assetId: string,
	force?: boolean
): Promise<StartResolution> {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return {
			kind: "response",
			response: NextResponse.json(
				{ error: "Convex not configured" },
				{ status: 503 }
			),
		};
	}

	const { ConvexHttpClient } = await import("convex/browser");
	const { api } = await import("@/convex/_generated/api");
	const convex = new ConvexHttpClient(convexUrl);

	const asset = await convex.query(api.assets.get, { id: assetId as never });
	if (!asset) {
		return {
			kind: "response",
			response: NextResponse.json(
				{ error: "Asset not found" },
				{ status: 404 }
			),
		};
	}

	// Idempotency guard: if already processing, return the active job id
	if (
		!force &&
		asset.processingStatus === "extraction_processing" &&
		asset.extractionJobId
	) {
		return {
			kind: "response",
			response: NextResponse.json(
				{
					jobId: asset.extractionJobId,
					status: "processing",
					assetId,
					sourceKey: asset.key,
				},
				{ status: 202 }
			),
		};
	}

	const ocrCompletedStatuses: string[] = [
		"ocr_completed",
		"extraction_queued",
		"extraction_processing",
		"extraction_completed",
		"extraction_failed",
	];

	if (!ocrCompletedStatuses.includes(asset.processingStatus)) {
		return {
			kind: "response",
			response: NextResponse.json(
				{
					error: `OCR not completed. Current status: ${asset.processingStatus}`,
				},
				{ status: 400 }
			),
		};
	}

	return {
		kind: "start",
		sourceKey: asset.key,
		projectId: asset.projectId as string | undefined,
		metadataOcrJobId: asset.ocrJobId as string | undefined,
	};
}

async function resolveLegacyExtractionStart(
	ocrJobId: string | undefined
): Promise<StartResolution> {
	if (!ocrJobId) {
		return {
			kind: "response",
			response: NextResponse.json(
				{ error: "ocrJobId is required" },
				{ status: 400 }
			),
		};
	}

	const ocrJob = await getJob(ocrJobId);
	if (!ocrJob) {
		return {
			kind: "response",
			response: NextResponse.json(
				{ error: "OCR job not found" },
				{ status: 404 }
			),
		};
	}

	if (ocrJob.status !== "completed") {
		return {
			kind: "response",
			response: NextResponse.json(
				{
					error: "OCR job not completed",
					status: ocrJob.status,
				},
				{ status: 400 }
			),
		};
	}

	return {
		kind: "start",
		sourceKey: ocrJob.sourceKey,
		projectId: ocrJob.projectId,
		metadataOcrJobId: ocrJobId,
	};
}

interface PartialReextractPlan {
	essayIndices: number[];
}

function buildBoundariesFromEssayResults(
	essays: EssayExtractionResult[]
): EssayBoundary[] {
	return essays.map((essay) => ({
		startPage: essay.startPage,
		endPage: essay.endPage,
		title: essay.essayTitle,
		wordCount: essay.wordCount,
	}));
}

function normalizeEssayResultItemsForIndex(
	result: EssayExtractionResult,
	essayIndex: number
): EssayExtractionResult {
	return {
		...result,
		items: result.items.map((item) => ({
			...item,
			essayIndex,
		})),
	};
}

function buildPartialPlan({
	existingResults,
	onlyMissingEssays,
	explicitEssayIndices,
}: {
	existingResults: ExtractionJobResults;
	onlyMissingEssays: boolean;
	explicitEssayIndices: number[] | undefined;
}): PartialReextractPlan {
	const selected = new Set<number>();

	if (onlyMissingEssays) {
		for (let i = 0; i < existingResults.essays.length; i++) {
			const essay = existingResults.essays[i];
			const eligible = essay.items.length === 0 && essay.wordCount >= 100;
			if (eligible) {
				selected.add(i + 1);
			}
		}
	}

	for (const index of explicitEssayIndices ?? []) {
		if (Number.isFinite(index)) {
			selected.add(Math.trunc(index));
		}
	}

	return { essayIndices: [...selected].sort((a, b) => a - b) };
}

async function loadExistingExtractionResultsForAsset(
	assetId: string
): Promise<{ resultsKey: string; results: ExtractionJobResults } | null> {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return null;
	}

	const { ConvexHttpClient } = await import("convex/browser");
	const { api } = await import("@/convex/_generated/api");
	const convex = new ConvexHttpClient(convexUrl);

	const metadata = await convex.query(api.extractionResults.getByAsset, {
		assetId: assetId as never,
	});

	if (!metadata?.resultsKey) {
		return null;
	}

	try {
		const { body } = await downloadFromR2(metadata.resultsKey);
		const text = await streamToString(body);
		const results = JSON.parse(text) as ExtractionJobResults;
		return { resultsKey: metadata.resultsKey, results };
	} catch (error) {
		console.error(
			`Failed to load existing extraction results for asset ${assetId}:`,
			error
		);
		return null;
	}
}

function selectBoundariesForPartialReextract({
	stored,
	existing,
}: {
	stored: EssayBoundary[] | null;
	existing: ExtractionJobResults;
}): EssayBoundary[] {
	if (!stored || stored.length === 0) {
		return buildBoundariesFromEssayResults(existing.essays);
	}

	if (stored.length !== existing.essays.length) {
		return buildBoundariesFromEssayResults(existing.essays);
	}

	for (let i = 0; i < stored.length; i++) {
		const boundary = stored[i];
		const essay = existing.essays[i];
		if (
			boundary.startPage !== essay.startPage ||
			boundary.endPage !== essay.endPage
		) {
			return buildBoundariesFromEssayResults(existing.essays);
		}
	}

	return stored;
}

function buildPageNumbersForIndices(
	boundaries: EssayBoundary[],
	essayIndices: number[]
): number[] {
	const pages = new Set<number>();

	for (const index of essayIndices) {
		const boundary = boundaries[index - 1];
		if (!boundary) {
			continue;
		}
		for (let page = boundary.startPage; page <= boundary.endPage; page++) {
			pages.add(page);
		}
	}

	return [...pages].sort((a, b) => a - b);
}

async function processPartialAssetReextract({
	jobId,
	assetId,
	sourceKey,
	metadataOcrJobId,
	parameters,
	modelId,
	onlyMissingEssays,
	essayIndices,
}: {
	jobId: string;
	assetId: string;
	sourceKey: string;
	metadataOcrJobId?: string;
	parameters: ExtractionParameters;
	modelId?: string;
	onlyMissingEssays: boolean;
	essayIndices: number[] | undefined;
}): Promise<void> {
	console.log(`[ExtractionJob ${jobId}] Starting partial re-extraction`, {
		assetId,
		onlyMissingEssays,
		explicitEssayCount: essayIndices?.length ?? 0,
	});

	const existing = await loadExistingExtractionResultsForAsset(assetId);
	if (!existing) {
		throw new Error(
			"No existing extraction results found for this asset. Run a full extraction first."
		);
	}

	const storedBoundaries = await loadEssayBoundaries(assetId);
	const boundaries = selectBoundariesForPartialReextract({
		stored: storedBoundaries?.boundaries ?? null,
		existing: existing.results,
	});

	const plan = buildPartialPlan({
		existingResults: existing.results,
		onlyMissingEssays,
		explicitEssayIndices: essayIndices,
	});

	const validIndices = plan.essayIndices.filter(
		(index) => index >= 1 && index <= boundaries.length
	);

	console.log(`[ExtractionJob ${jobId}] Partial re-extract plan`, {
		selectedEssayCount: plan.essayIndices.length,
		validEssayCount: validIndices.length,
		totalEssays: boundaries.length,
	});

	if (validIndices.length === 0) {
		const mergedEssays = existing.results.essays.map((essay, index) =>
			normalizeEssayResultItemsForIndex(essay, index + 1)
		);
		const allItems = mergedEssays.flatMap((essay) => essay.items);
		const stats = getExtractionStats(mergedEssays);

		const fullResults: ExtractionJobResults = {
			jobId,
			ocrJobId: metadataOcrJobId,
			assetId,
			sourceKey,
			totalEssays: mergedEssays.length,
			essays: mergedEssays,
			allItems,
			stats,
			parameters,
			processedAt: new Date().toISOString(),
		};

		const resultsKey = `processing/${jobId}/extraction-results.json`;
		await uploadToR2(
			resultsKey,
			Buffer.from(JSON.stringify(fullResults, null, 2)),
			"application/json"
		);

		storeEssayBoundaries({
			assetId,
			totalPages:
				storedBoundaries?.totalPages ??
				boundaries.reduce(
					(max, boundary) => Math.max(max, boundary.endPage),
					1
				),
			sourceKey,
			boundaries,
		}).catch((error) => {
			console.error(
				`Failed to store essay boundaries for asset ${assetId}:`,
				error
			);
		});

		await completeJob(jobId);
		await updateAssetAfterExtraction({
			assetId,
			jobId,
			ocrJobId: metadataOcrJobId,
			extractionResults: mergedEssays,
			allItems,
			stats,
			resultsKey,
		});
		return;
	}

	await updateJobProgress(jobId, 0, validIndices.length);

	const pageNumbers = buildPageNumbersForIndices(boundaries, validIndices);
	console.log(
		`[ExtractionJob ${jobId}] Loading OCR pages for partial re-extract`,
		{
			pageCount: pageNumbers.length,
		}
	);

	const { getOcrResultsForPages } = await import("@/lib/storage/ocr-results");
	const pageResults = await getOcrResultsForPages(assetId, pageNumbers);
	const ocrPages = convertToLegacyOcrFormat(pageResults);

	const essaysToExtract = validIndices.map((index) => {
		const boundary = boundaries[index - 1];
		return {
			essayIndex: index,
			text: getEssayText(ocrPages, boundary),
			startPage: boundary.startPage,
			endPage: boundary.endPage,
			title: boundary.title,
		};
	});

	const modelFactory = modelId
		? () => getFreshModel("EXTRACTION", `partial-${jobId}`, modelId)
		: undefined;

	const extracted = await extractContentBatch(
		essaysToExtract,
		parameters,
		sourceKey,
		async (processed, total) => {
			await updateJobProgress(jobId, processed, total);
		},
		undefined,
		modelFactory
	);

	const mergedEssays: EssayExtractionResult[] = new Array(boundaries.length);
	const extractedByIndex = new Map<number, EssayExtractionResult>();

	for (let i = 0; i < extracted.length; i++) {
		const { essayIndex } = essaysToExtract[i];
		extractedByIndex.set(
			essayIndex,
			normalizeEssayResultItemsForIndex(extracted[i], essayIndex)
		);
	}

	for (let i = 0; i < boundaries.length; i++) {
		const index = i + 1;
		const updated = extractedByIndex.get(index);
		if (updated) {
			mergedEssays[i] = updated;
			continue;
		}

		const existingEssay = existing.results.essays[i];
		mergedEssays[i] = existingEssay
			? normalizeEssayResultItemsForIndex(existingEssay, index)
			: {
					essayTitle: boundaries[i].title,
					startPage: boundaries[i].startPage,
					endPage: boundaries[i].endPage,
					items: [],
					sections: [],
					overallQuality: "low",
					wordCount: boundaries[i].wordCount,
				};
	}

	const allItems = mergedEssays.flatMap((essay) => essay.items);
	const stats = getExtractionStats(mergedEssays);

	const fullResults: ExtractionJobResults = {
		jobId,
		ocrJobId: metadataOcrJobId,
		assetId,
		sourceKey,
		totalEssays: mergedEssays.length,
		essays: mergedEssays,
		allItems,
		stats,
		parameters,
		processedAt: new Date().toISOString(),
	};

	const resultsKey = `processing/${jobId}/extraction-results.json`;
	await uploadToR2(
		resultsKey,
		Buffer.from(JSON.stringify(fullResults, null, 2)),
		"application/json"
	);

	storeEssayBoundaries({
		assetId,
		totalPages:
			storedBoundaries?.totalPages ??
			boundaries.reduce((max, boundary) => Math.max(max, boundary.endPage), 1),
		sourceKey,
		boundaries,
	}).catch((error) => {
		console.error(
			`Failed to store essay boundaries for asset ${assetId}:`,
			error
		);
	});

	await completeJob(jobId);

	await updateAssetAfterExtraction({
		assetId,
		jobId,
		ocrJobId: metadataOcrJobId,
		extractionResults: mergedEssays,
		allItems,
		stats,
		resultsKey,
	});
}

async function startExtractionInBackground({
	jobId,
	sourceKey,
	loadAssetId,
	loadOcrJobId,
	metadataOcrJobId,
	parameters,
	assetId,
	modelId,
	onlyMissingEssays,
	essayIndices,
	recomputeBoundaries,
}: {
	jobId: string;
	sourceKey: string;
	loadAssetId?: string;
	loadOcrJobId?: string;
	metadataOcrJobId?: string;
	parameters: ExtractionParameters;
	assetId?: string;
	modelId?: string;
	onlyMissingEssays?: boolean;
	essayIndices?: number[];
	recomputeBoundaries?: boolean;
}): Promise<void> {
	const hasPartialRequest =
		onlyMissingEssays === true || (essayIndices?.length ?? 0) > 0;

	if (hasPartialRequest && assetId) {
		await processPartialAssetReextract({
			jobId,
			assetId,
			sourceKey,
			metadataOcrJobId,
			parameters,
			modelId,
			onlyMissingEssays: onlyMissingEssays === true,
			essayIndices,
		});
		return;
	}

	const ocrData = await loadOcrResults(loadAssetId, loadOcrJobId);
	if (!ocrData.success) {
		const jobStatus = ocrData.jobStatus
			? ` (status: ${ocrData.jobStatus})`
			: "";
		throw new Error(`Failed to load OCR results${jobStatus}: ${ocrData.error}`);
	}

	const storedBoundaries =
		assetId && !recomputeBoundaries ? await loadEssayBoundaries(assetId) : null;
	const boundariesOverride =
		storedBoundaries &&
		storedBoundaries.totalPages === ocrData.results.totalPages
			? storedBoundaries.boundaries
			: undefined;

	await processExtractionJob(
		jobId,
		metadataOcrJobId,
		ocrData.results,
		parameters,
		assetId,
		modelId,
		boundariesOverride
	);
}

/**
 * Loads OCR results from either asset (new format) or job (legacy format).
 */
function loadOcrResults(
	assetId: string | undefined,
	ocrJobId: string | undefined
): Promise<
	| {
			success: true;
			results: OcrJobResults;
			sourceKey: string;
			projectId?: string;
	  }
	| { success: false; error: string; status: number; jobStatus?: string }
> {
	if (assetId && !ocrJobId) {
		return loadOcrResultsFromAsset(assetId);
	}
	if (ocrJobId) {
		return loadLegacyOcrResults(ocrJobId);
	}
	return Promise.resolve({
		success: false,
		error: "Invalid request",
		status: 400,
	});
}

/**
 * Loads OCR results from the new per-page format for an asset.
 */
async function loadOcrResultsFromAsset(assetId: string): Promise<
	| {
			success: true;
			results: OcrJobResults;
			sourceKey: string;
			projectId?: string;
	  }
	| { success: false; error: string; status: number }
> {
	// Import dynamically to avoid loading at module level
	const { getAllOcrResults } = await import("@/lib/storage/ocr-results");

	// Get asset info from Convex
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return { success: false, error: "Convex not configured", status: 503 };
	}

	const { ConvexHttpClient } = await import("convex/browser");
	const { api } = await import("@/convex/_generated/api");
	const convex = new ConvexHttpClient(convexUrl);

	const asset = await convex.query(api.assets.get, { id: assetId as never });
	if (!asset) {
		return { success: false, error: "Asset not found", status: 404 };
	}

	// Check if OCR is completed
	const ocrCompletedStatuses = [
		"ocr_completed",
		"extraction_queued",
		"extraction_processing",
		"extraction_completed",
		"extraction_failed",
	];
	if (!ocrCompletedStatuses.includes(asset.processingStatus)) {
		return {
			success: false,
			error: `OCR not completed. Current status: ${asset.processingStatus}`,
			status: 400,
		};
	}

	// Load per-page OCR results
	const pageResults = await getAllOcrResults(assetId);
	if (pageResults.length === 0) {
		return {
			success: false,
			error: "No OCR results found for asset",
			status: 404,
		};
	}

	// Convert to legacy format
	const legacyPages = convertToLegacyOcrFormat(pageResults);
	const totalWordCount = legacyPages.reduce((sum, p) => sum + p.wordCount, 0);
	const avgConfidence =
		legacyPages.reduce((sum, p) => sum + p.confidence, 0) / legacyPages.length;
	const combinedText = legacyPages
		.sort((a, b) => a.pageNumber - b.pageNumber)
		.map((p) => p.text)
		.join("\n\n---\n\n");

	const results: OcrJobResults = {
		jobId: assetId, // Use assetId as pseudo-jobId
		sourceKey: asset.key,
		totalPages: pageResults.length,
		pages: legacyPages,
		combinedText,
		totalWordCount,
		averageConfidence: avgConfidence,
		processedAt: new Date().toISOString(),
	};

	return {
		success: true,
		results,
		sourceKey: asset.key,
		projectId: asset.projectId as string | undefined,
	};
}

/**
 * Loads OCR results from the legacy job format.
 */
async function loadLegacyOcrResults(ocrJobId: string): Promise<
	| {
			success: true;
			results: OcrJobResults;
			sourceKey: string;
			projectId?: string;
	  }
	| { success: false; error: string; status: number; jobStatus?: string }
> {
	// Get the OCR job to verify it's completed
	const ocrJob = await getJob(ocrJobId);
	if (!ocrJob) {
		return { success: false, error: "OCR job not found", status: 404 };
	}

	if (ocrJob.status !== "completed") {
		return {
			success: false,
			error: "OCR job not completed",
			status: 400,
			jobStatus: ocrJob.status,
		};
	}

	// Load OCR results
	const ocrResultsKey = `processing/${ocrJobId}/ocr-results.json`;

	try {
		const { body: stream } = await downloadFromR2(ocrResultsKey);
		const text = await streamToString(stream);
		const results = JSON.parse(text) as OcrJobResults;

		return {
			success: true,
			results,
			sourceKey: ocrJob.sourceKey,
			projectId: ocrJob.projectId,
		};
	} catch {
		return { success: false, error: "Failed to load OCR results", status: 500 };
	}
}

/**
 * GET /api/extract?jobId=xxx
 * Gets the status and results of an extraction job.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const jobId = searchParams.get("jobId");

	if (!jobId) {
		return NextResponse.json({ error: "jobId is required" }, { status: 400 });
	}

	const job = await getJob(jobId);

	if (!job) {
		return NextResponse.json({ error: "Job not found" }, { status: 404 });
	}

	// If completed, load and return full results
	if (job.status === "completed") {
		const resultsKey = `processing/${jobId}/extraction-results.json`;

		try {
			const { body: stream } = await downloadFromR2(resultsKey);
			const text = await streamToString(stream);
			const results = JSON.parse(text) as ExtractionJobResults;

			return NextResponse.json({
				job: {
					id: job.id,
					status: job.status,
					progress: job.progress,
					totalItems: job.totalItems,
					processedItems: job.processedItems,
					errors: job.errors,
					createdAt: job.createdAt,
					completedAt: job.completedAt,
				},
				results,
			});
		} catch {
			// Results not available yet, return job status only
			return NextResponse.json({
				job: {
					id: job.id,
					status: job.status,
					progress: job.progress,
					totalItems: job.totalItems,
					processedItems: job.processedItems,
					errors: job.errors,
					createdAt: job.createdAt,
					completedAt: job.completedAt,
				},
			});
		}
	}

	// For pending/processing jobs, return status only
	return NextResponse.json({
		job: {
			id: job.id,
			status: job.status,
			progress: job.progress,
			totalItems: job.totalItems,
			processedItems: job.processedItems,
			errors: job.errors,
			createdAt: job.createdAt,
		},
	});
}

/**
 * Threshold for using chunked processing (pages).
 * PDFs larger than this use chunked processor with enhanced error handling.
 */
const CHUNKED_PROCESSING_THRESHOLD = 500;

interface ExtractionProcessingStats {
	totalEssays: number;
	successful: number;
	failed: number;
	retried: number;
	chunksProcessed: number;
	chunksFailed: number;
	totalPages: number;
	pagesCovered: number;
	gaps: Array<{ start: number; end: number }>;
	errors: Array<{
		chunkIndex: number;
		essayIndices: number[];
		error: string;
	}>;
}

interface ExtractionProcessResult {
	extractionResults: EssayExtractionResult[];
	processingStats: ExtractionProcessingStats | null;
	isLargePdf: boolean;
}

async function logChunkProcessingIssues(
	jobId: string,
	stats: ExtractionProcessingStats
): Promise<void> {
	if (stats.errors.length > 0) {
		for (const error of stats.errors) {
			await addJobError(
				jobId,
				`Chunk ${error.chunkIndex + 1} failed: ${error.error}`,
				error.essayIndices[0],
				"CHUNK_FAILED"
			);
		}
	}

	if (stats.gaps.length > 0) {
		for (const gap of stats.gaps) {
			await addJobError(
				jobId,
				`Page gap detected: pages ${gap.start}-${gap.end} not covered by any essay`,
				undefined,
				"PAGE_GAP"
			);
		}
	}
}

async function processLargePdfExtraction(
	jobId: string,
	ocrResults: OcrJobResults,
	parameters: ExtractionParameters,
	modelId?: string,
	boundariesOverride?: EssayBoundary[]
): Promise<ExtractionProcessResult> {
	console.log(
		`[ExtractionJob ${jobId}] Large PDF detected (${ocrResults.totalPages} pages), using chunked processing`
	);

	const { results, stats } = await processEssaysInChunks(
		ocrResults.pages,
		parameters,
		ocrResults.sourceKey,
		{
			essaysPerChunk: 15,
			maxRetries: 2,
			continueOnFailure: true,
			enableLogging: true,
		},
		async (_processedChunks, _totalChunks, currentEssay, totalEssays) => {
			await updateJobProgress(jobId, currentEssay, totalEssays);
		},
		modelId,
		boundariesOverride
	);

	await logChunkProcessingIssues(jobId, stats);

	console.log(`[ExtractionJob ${jobId}] Chunked processing complete:`, {
		totalEssays: stats.totalEssays,
		successful: stats.successful,
		failed: stats.failed,
		gaps: stats.gaps.length,
	});

	return {
		extractionResults: results,
		processingStats: stats,
		isLargePdf: true,
	};
}

async function processStandardExtraction(
	jobId: string,
	ocrResults: OcrJobResults,
	parameters: ExtractionParameters,
	modelId?: string,
	boundariesOverride?: EssayBoundary[]
): Promise<ExtractionProcessResult> {
	console.log(
		`[ExtractionJob ${jobId}] Standard processing for ${ocrResults.totalPages} pages`
	);

	const boundaries =
		boundariesOverride ??
		(await detectEssayBoundaries(ocrResults.pages, undefined, modelId));

	const validation = validateBoundaries(boundaries, ocrResults.totalPages);
	if (!validation.valid) {
		for (const issue of validation.issues) {
			await addJobError(jobId, issue);
		}
	}

	if (ocrResults.totalPages > 100) {
		const largePdfValidation = validateLargePdfBoundaries(
			boundaries,
			ocrResults.totalPages
		);
		if (!largePdfValidation.valid) {
			for (const warning of largePdfValidation.warnings) {
				await addJobError(
					jobId,
					`Validation warning: ${warning}`,
					undefined,
					"VALIDATION_WARNING"
				);
			}
		}
	}

	await updateJobProgress(jobId, 0, boundaries.length);

	const essays = boundaries.map((boundary) => ({
		text: getEssayText(ocrResults.pages, boundary),
		startPage: boundary.startPage,
		endPage: boundary.endPage,
		title: boundary.title,
	}));

	const modelFactory = modelId
		? () => getModel("EXTRACTION", modelId)
		: undefined;

	const extractionResults = modelFactory
		? await extractContentBatch(
				essays,
				parameters,
				ocrResults.sourceKey,
				async (processed, total) => {
					await updateJobProgress(jobId, processed, total);
				},
				undefined,
				modelFactory
			)
		: await extractContentBatch(
				essays,
				parameters,
				ocrResults.sourceKey,
				async (processed, total) => {
					await updateJobProgress(jobId, processed, total);
				}
			);

	return {
		extractionResults,
		processingStats: null,
		isLargePdf: false,
	};
}

async function updateAssetAfterExtraction({
	assetId,
	jobId,
	ocrJobId,
	extractionResults,
	allItems,
	stats,
	resultsKey,
}: {
	assetId: string;
	jobId: string;
	ocrJobId?: string;
	extractionResults: EssayExtractionResult[];
	allItems: ExtractedContent[];
	stats: ReturnType<typeof getExtractionStats>;
	resultsKey: string;
}): Promise<void> {
	try {
		const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (!convexUrl) {
			return;
		}

		const { ConvexHttpClient } = await import("convex/browser");
		const { api } = await import("@/convex/_generated/api");
		const convex = new ConvexHttpClient(convexUrl);

		await convex.mutation(api.assets.updateStatus, {
			id: assetId as never,
			status: "extraction_completed",
			extractedItemCount: allItems.length,
		});

		await convex.mutation(api.extractionResults.create, {
			assetId: assetId as never,
			ocrJobId,
			extractionJobId: jobId,
			totalEssays: extractionResults.length,
			totalItems: allItems.length,
			stats,
			resultsKey,
		});

		console.log(
			`Asset ${assetId} extraction completed: ${allItems.length} items`
		);
	} catch (err) {
		console.error(`Failed to update asset ${assetId}:`, err);
	}
}

/**
 * Background function to process extraction job.
 * Uses chunked processing for large PDFs to ensure no essays are missed.
 */
async function processExtractionJob(
	jobId: string,
	ocrJobId: string | undefined,
	ocrResults: OcrJobResults,
	parameters: ExtractionParameters,
	assetId?: string,
	modelId?: string,
	boundariesOverride?: EssayBoundary[]
) {
	const isLargePdf = ocrResults.totalPages > CHUNKED_PROCESSING_THRESHOLD;
	const { extractionResults, processingStats } = isLargePdf
		? await processLargePdfExtraction(
				jobId,
				ocrResults,
				parameters,
				modelId,
				boundariesOverride
			)
		: await processStandardExtraction(
				jobId,
				ocrResults,
				parameters,
				modelId,
				boundariesOverride
			);

	// Collect all items
	const allItems = extractionResults.flatMap((r) => r.items);

	// Calculate stats
	const stats = getExtractionStats(extractionResults);

	// Save each essay result
	for (let i = 0; i < extractionResults.length; i++) {
		await addJobResult(jobId, extractionResults[i], i);
	}

	// Save complete results to R2
	const fullResults: ExtractionJobResults & {
		processingStats?: typeof processingStats;
		isLargePdf?: boolean;
	} = {
		jobId,
		ocrJobId,
		sourceKey: ocrResults.sourceKey,
		totalEssays: extractionResults.length,
		essays: extractionResults,
		allItems,
		stats,
		parameters,
		processedAt: new Date().toISOString(),
		isLargePdf,
		processingStats,
	};

	const resultsKey = `processing/${jobId}/extraction-results.json`;
	await uploadToR2(
		resultsKey,
		Buffer.from(JSON.stringify(fullResults, null, 2)),
		"application/json"
	);

	if (assetId) {
		storeEssayBoundaries({
			assetId,
			totalPages: ocrResults.totalPages,
			sourceKey: ocrResults.sourceKey,
			boundaries: extractionResults.map((essay) => ({
				startPage: essay.startPage,
				endPage: essay.endPage,
				title: essay.essayTitle,
				wordCount: essay.wordCount,
			})),
		}).catch((error) => {
			console.error(
				`Failed to store essay boundaries for asset ${assetId}:`,
				error
			);
		});
	}

	await completeJob(jobId);

	// Update asset status and save extraction results if assetId provided
	if (assetId) {
		await updateAssetAfterExtraction({
			assetId,
			jobId,
			ocrJobId,
			extractionResults,
			allItems,
			stats,
			resultsKey,
		});
	}
}

/**
 * Converts a ReadableStream to string.
 */
async function streamToString(stream: ReadableStream): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	let done = false;
	while (!done) {
		const result = await reader.read();
		done = result.done;
		if (result.value) {
			chunks.push(result.value);
		}
	}

	const combined = new Uint8Array(
		chunks.reduce((acc, chunk) => acc + chunk.length, 0)
	);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}

	return new TextDecoder().decode(combined);
}
