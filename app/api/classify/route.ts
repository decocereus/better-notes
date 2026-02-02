/**
 * Classification API Route
 * Classifies extracted content into theme hierarchy.
 *
 * POST: Start classification job
 * GET: Get classification results
 */

import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { validateAIConfig } from "@/lib/ai";
import {
	classifyContentBatch,
	getClassificationStats,
} from "@/lib/classification";
import {
	aggregateContentByTheme,
	getAggregationSummary,
} from "@/lib/classification/aggregator";
import {
	analyzeCrossThemeContent,
	updateMultiUseFlags,
} from "@/lib/classification/cross-theme";
import { getModelForTask } from "@/lib/llm/provider";
import {
	completeJob,
	createJob,
	failJob,
	getJob,
	updateJobProgress,
} from "@/lib/processing";
import { downloadFromR2, uploadToR2, validateR2Config } from "@/lib/storage";
import type { ExtractedContent } from "@/types/extraction";
import type { MainTheme } from "@/types/theme";

/**
 * Request body for classification.
 */
interface ClassifyRequestBody {
	/** Extraction job ID to get content from */
	extractionJobId?: string;
	/** Convex theme page ID (from themePages table) */
	themePageId: string;
	/** Project ID to aggregate all completed assets */
	projectId?: string;
	/** Optional model configuration per task */
	modelConfig?: Record<string, string>;
}

/**
 * Results stored for a classification job.
 */
interface ClassificationJobResults {
	jobId: string;
	extractionJobId: string;
	extractionJobIds?: string[];
	projectId?: string;
	themePageId: string;
	themes: MainTheme[];
	classifiedContent: ExtractedContent[];
	stats: {
		classification: ReturnType<typeof getClassificationStats>;
		aggregation: ReturnType<typeof getAggregationSummary>;
		crossTheme: ReturnType<typeof analyzeCrossThemeContent>["stats"];
	};
	processedAt: string;
}

/**
 * Gets the Convex HTTP client.
 */
function getConvexClient(): ConvexHttpClient {
	const url = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!url) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable not set");
	}
	return new ConvexHttpClient(url);
}

/**
 * Validates that all required configurations are present.
 */
function validateConfigurations(): NextResponse | null {
	const r2Config = validateR2Config();
	if (!r2Config.valid) {
		return NextResponse.json(
			{
				error: "R2 storage not configured",
				details: `Missing: ${r2Config.missing.join(", ")}`,
			},
			{ status: 503 }
		);
	}

	const aiConfig = validateAIConfig();
	if (!aiConfig.valid) {
		return NextResponse.json(
			{ error: aiConfig.error || "AI not configured" },
			{ status: 503 }
		);
	}

	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		return NextResponse.json(
			{ error: "Convex not configured" },
			{ status: 503 }
		);
	}

	return null;
}

/**
 * Validates the request body and returns error response if invalid.
 */
function validateRequestBody(body: ClassifyRequestBody): {
	error: NextResponse | null;
	extractionJobId?: string;
	themePageId: string;
	projectId?: string;
	modelConfig?: Record<string, string>;
} {
	const { extractionJobId, themePageId, projectId, modelConfig } = body;

	if (!themePageId) {
		return {
			error: NextResponse.json(
				{ error: "themePageId is required" },
				{ status: 400 }
			),
			extractionJobId,
			themePageId: "",
			projectId,
			modelConfig,
		};
	}

	if (!(extractionJobId || projectId)) {
		return {
			error: NextResponse.json(
				{ error: "extractionJobId or projectId is required" },
				{ status: 400 }
			),
			extractionJobId,
			themePageId,
			projectId,
			modelConfig,
		};
	}

	return { error: null, extractionJobId, themePageId, projectId, modelConfig };
}

/**
 * Loads extracted content from R2 storage.
 */
async function loadExtractionResults(
	extractionJobId: string
): Promise<{ content: ExtractedContent[] | null; error: NextResponse | null }> {
	const resultsKey = `processing/${extractionJobId}/extraction-results.json`;

	try {
		const { body: stream } = await downloadFromR2(resultsKey);
		const text = await streamToString(stream);
		const results = JSON.parse(text) as { allItems: ExtractedContent[] };
		return { content: results.allItems, error: null };
	} catch {
		return {
			content: null,
			error: NextResponse.json(
				{ error: "Failed to load extraction results" },
				{ status: 500 }
			),
		};
	}
}

/**
 * Loads themes from Convex database.
 */
async function loadThemesFromConvex(
	themePageId: string
): Promise<{ themes: MainTheme[] | null; error: NextResponse | null }> {
	try {
		const convex = getConvexClient();
		const themePage = await convex.query(api.themePages.get, {
			id: themePageId as Id<"themePages">,
		});

		if (!themePage) {
			return {
				themes: null,
				error: NextResponse.json(
					{ error: "Theme page not found" },
					{ status: 404 }
				),
			};
		}

		const themes = themePage.themes as MainTheme[];
		if (themes.length === 0) {
			return {
				themes: null,
				error: NextResponse.json(
					{ error: "No themes found in the theme page" },
					{ status: 400 }
				),
			};
		}

		return { themes, error: null };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to load themes";
		return {
			themes: null,
			error: NextResponse.json({ error: message }, { status: 500 }),
		};
	}
}

/**
 * Loads and aggregates extraction results for all completed assets in a project.
 */
function getNotionExtractionItems(
	metadata: unknown
): ExtractedContent[] | null {
	if (!metadata || typeof metadata !== "object") {
		return null;
	}

	const extraction = (metadata as { extraction?: unknown }).extraction;
	if (!extraction || typeof extraction !== "object") {
		return null;
	}

	const items = (extraction as { items?: unknown }).items;
	if (!Array.isArray(items)) {
		return null;
	}

	return items as ExtractedContent[];
}

interface AssetExtractionAggregate {
	content: ExtractedContent[];
	extractionJobIds: string[];
	missingJobIds: string[];
}

async function loadAssetExtractionResults(
	assets: Array<{
		processingStatus: string;
		extractionJobId?: string;
	}>
): Promise<AssetExtractionAggregate> {
	const completedAssets = assets.filter(
		(asset) =>
			asset.processingStatus === "extraction_completed" && asset.extractionJobId
	);

	const extractionJobIds = completedAssets
		.map((asset) => asset.extractionJobId)
		.filter((id): id is string => Boolean(id));

	const missingJobIds: string[] = [];
	const aggregatedContent: ExtractedContent[] = [];

	for (const jobId of extractionJobIds) {
		const result = await loadExtractionResults(jobId);
		if (result.content) {
			aggregatedContent.push(...result.content);
		} else {
			missingJobIds.push(jobId);
		}
	}

	return {
		content: aggregatedContent,
		extractionJobIds,
		missingJobIds,
	};
}

interface NotionExtractionAggregate {
	content: ExtractedContent[];
	missingExtractionIds: string[];
}

function loadNotionExtractionResults(
	sources: Array<{
		id: string;
		type: string;
		status: string;
		metadata?: unknown;
	}>
): NotionExtractionAggregate {
	const aggregatedContent: ExtractedContent[] = [];
	const missingExtractionIds: string[] = [];

	for (const source of sources) {
		if (source.type !== "notion" || source.status !== "completed") {
			continue;
		}

		const extractedItems = getNotionExtractionItems(source.metadata);
		if (!extractedItems) {
			missingExtractionIds.push(source.id);
			continue;
		}

		if (extractedItems.length > 0) {
			aggregatedContent.push(...extractedItems);
		}
	}

	return { content: aggregatedContent, missingExtractionIds };
}

async function loadProjectExtractionResults(projectId: string): Promise<{
	content: ExtractedContent[] | null;
	extractionJobIds: string[];
	error: NextResponse | null;
}> {
	try {
		const convex = getConvexClient();
		const [assets, project] = await Promise.all([
			convex.query(api.assets.listByProject, {
				projectId: projectId as Id<"projects">,
			}),
			convex.query(api.projects.get, {
				id: projectId as Id<"projects">,
			}),
		]);

		if (!project) {
			return {
				content: null,
				extractionJobIds: [],
				error: NextResponse.json(
					{ error: "Project not found" },
					{ status: 404 }
				),
			};
		}

		const assetAggregate = await loadAssetExtractionResults(assets);
		const notionAggregate = loadNotionExtractionResults(project.sources);
		const aggregatedContent = [
			...assetAggregate.content,
			...notionAggregate.content,
		];

		if (assetAggregate.missingJobIds.length > 0) {
			return {
				content: null,
				extractionJobIds: assetAggregate.extractionJobIds,
				error: NextResponse.json(
					{
						error: "Failed to load extraction results for some assets",
						missingJobIds: assetAggregate.missingJobIds,
					},
					{ status: 500 }
				),
			};
		}

		if (notionAggregate.missingExtractionIds.length > 0) {
			return {
				content: null,
				extractionJobIds: assetAggregate.extractionJobIds,
				error: NextResponse.json(
					{
						error:
							"Some Notion sources are missing extracted content. Re-process those sources before classification.",
						missingSourceIds: notionAggregate.missingExtractionIds,
					},
					{ status: 400 }
				),
			};
		}

		if (aggregatedContent.length === 0) {
			return {
				content: null,
				extractionJobIds: assetAggregate.extractionJobIds,
				error: NextResponse.json(
					{
						error:
							"No extracted content found for this project. Process at least one source first.",
					},
					{ status: 400 }
				),
			};
		}

		return {
			content: aggregatedContent,
			extractionJobIds: assetAggregate.extractionJobIds,
			error: null,
		};
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Failed to load project extraction results";
		return {
			content: null,
			extractionJobIds: [],
			error: NextResponse.json({ error: message }, { status: 500 }),
		};
	}
}

/**
 * Asset info returned from Convex.
 */
interface AssetInfo {
	id: string;
	key: string;
	projectId?: string;
	processingStatus: string;
	extractionJobId?: string;
}

/**
 * Gets extraction status by checking both the job and the asset record.
 * Returns true if extraction is complete based on either source.
 * Also returns asset info needed for creating the classification job.
 */
async function isExtractionComplete(extractionJobId: string): Promise<{
	complete: boolean;
	job: Awaited<ReturnType<typeof getJob>>;
	asset?: AssetInfo;
}> {
	const job = await getJob(extractionJobId);

	// If job exists and is completed, we're done
	if (job?.status === "completed") {
		return { complete: true, job };
	}

	// Otherwise, check if any asset has this extraction job ID and is completed
	// This handles cases where the job status may have been lost from cache
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (convexUrl) {
		try {
			const convex = getConvexClient();
			const assets = await convex.query(api.assets.list, {});

			for (const asset of assets) {
				if (asset.extractionJobId === extractionJobId) {
					const isAssetCompleted =
						asset.processingStatus === "extraction_completed";
					return {
						complete: isAssetCompleted,
						job,
						asset: {
							id: asset.id,
							key: asset.key,
							projectId: asset.projectId,
							processingStatus: asset.processingStatus,
							extractionJobId: asset.extractionJobId,
						},
					};
				}
			}
		} catch {
			// Fall through to job-only check
		}
	}

	return { complete: false, job };
}

interface ExtractionContext {
	extractedContent: ExtractedContent[];
	extractionJobIds: string[];
	sourceKey: string;
	projectId?: string;
}

interface ExtractionContextResult {
	context: ExtractionContext | null;
	error: NextResponse | null;
}

async function loadProjectExtractionContext(
	projectId: string
): Promise<ExtractionContextResult> {
	const projectResults = await loadProjectExtractionResults(projectId);
	if (projectResults.error || !projectResults.content) {
		return {
			context: null,
			error:
				projectResults.error ??
				NextResponse.json(
					{ error: "Failed to load project extraction results" },
					{ status: 500 }
				),
		};
	}

	return {
		context: {
			extractedContent: projectResults.content,
			extractionJobIds: projectResults.extractionJobIds,
			sourceKey: `project:${projectId}`,
			projectId,
		},
		error: null,
	};
}

async function loadJobExtractionContext(
	extractionJobId: string
): Promise<ExtractionContextResult> {
	const extractionCheck = await isExtractionComplete(extractionJobId);

	if (!extractionCheck.complete) {
		if (!extractionCheck.job) {
			return {
				context: null,
				error: NextResponse.json(
					{ error: "Extraction job not found" },
					{ status: 404 }
				),
			};
		}

		return {
			context: null,
			error: NextResponse.json(
				{
					error: "Extraction job not completed",
					status:
						extractionCheck.asset?.processingStatus ||
						extractionCheck.job.status,
					progress: extractionCheck.job.progress,
				},
				{ status: 400 }
			),
		};
	}

	const extractionResult = await loadExtractionResults(extractionJobId);
	if (extractionResult.error || !extractionResult.content) {
		return {
			context: null,
			error:
				extractionResult.error ??
				NextResponse.json(
					{ error: "Failed to load extraction results" },
					{ status: 500 }
				),
		};
	}

	const sourceKey =
		extractionCheck.job?.sourceKey ?? extractionCheck.asset?.key;
	if (!sourceKey) {
		return {
			context: null,
			error: NextResponse.json(
				{ error: "Cannot determine source key for classification" },
				{ status: 500 }
			),
		};
	}

	return {
		context: {
			extractedContent: extractionResult.content,
			extractionJobIds: [extractionJobId],
			sourceKey,
			projectId:
				extractionCheck.job?.projectId ?? extractionCheck.asset?.projectId,
		},
		error: null,
	};
}

async function resolveExtractionContext({
	projectId,
	extractionJobId,
}: {
	projectId?: string;
	extractionJobId?: string;
}): Promise<ExtractionContextResult> {
	if (projectId) {
		return await loadProjectExtractionContext(projectId);
	}

	if (extractionJobId) {
		return await loadJobExtractionContext(extractionJobId);
	}

	return {
		context: null,
		error: NextResponse.json(
			{ error: "extractionJobId or projectId is required" },
			{ status: 400 }
		),
	};
}

/**
 * POST /api/classify
 * Starts a new classification job.
 */
export async function POST(request: NextRequest) {
	try {
		// Validate configurations
		const configError = validateConfigurations();
		if (configError) {
			return configError;
		}

		// Parse and validate request
		const body = (await request.json()) as ClassifyRequestBody;
		const validation = validateRequestBody(body);
		if (validation.error) {
			return validation.error;
		}

		const { extractionJobId, themePageId, projectId, modelConfig } = validation;

		const extractionContext = await resolveExtractionContext({
			projectId,
			extractionJobId,
		});
		if (extractionContext.error || !extractionContext.context) {
			return (
				extractionContext.error ??
				NextResponse.json(
					{ error: "Failed to resolve extraction context" },
					{ status: 500 }
				)
			);
		}

		const {
			extractedContent,
			extractionJobIds,
			sourceKey,
			projectId: resolvedProjectId,
		} = extractionContext.context;

		// Load themes from Convex
		const themesResult = await loadThemesFromConvex(themePageId);
		if (themesResult.error || !themesResult.themes) {
			return (
				themesResult.error ??
				NextResponse.json({ error: "Failed to load themes" }, { status: 500 })
			);
		}
		const themes = themesResult.themes;

		// Create the classification job
		const job = await createJob(
			"classification",
			sourceKey,
			resolvedProjectId,
			extractedContent.length
		);

		// Start processing in the background
		const modelId = getModelForTask("classification", modelConfig);

		processClassificationJob(
			job.id,
			extractionJobIds,
			themePageId,
			extractedContent,
			themes,
			resolvedProjectId,
			modelId
		).catch((error) => {
			console.error(`Classification job ${job.id} failed:`, error);
			failJob(job.id, error instanceof Error ? error.message : "Unknown error");
		});

		return NextResponse.json(
			{
				jobId: job.id,
				status: job.status,
				extractionJobId: extractionJobIds[0] ?? "notion",
				extractionJobIds,
				themePageId,
				projectId: resolvedProjectId,
				totalItems: extractedContent.length,
				totalThemes: themes.length,
			},
			{ status: 202 }
		);
	} catch (error) {
		console.error("Failed to start classification job:", error);
		return NextResponse.json(
			{
				error: "Failed to start classification job",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

/**
 * GET /api/classify?jobId=xxx
 * Gets the status and results of a classification job.
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
		const resultsKey = `processing/${jobId}/classification-results.json`;

		try {
			const { body: stream } = await downloadFromR2(resultsKey);
			const text = await streamToString(stream);
			const results = JSON.parse(text) as ClassificationJobResults;

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
 * Background function to process classification job.
 */
async function processClassificationJob(
	jobId: string,
	extractionJobIds: string[],
	themePageId: string,
	content: ExtractedContent[],
	themes: MainTheme[],
	projectId?: string,
	modelId?: string
) {
	// Classify content in batches
	const classifiedContent = await classifyContentBatch(
		content,
		themes,
		async (processed, total) => {
			await updateJobProgress(jobId, processed, total);
		},
		modelId
	);

	// Update multi-use flags based on theme count
	const contentWithMultiUse = updateMultiUseFlags(classifiedContent);

	// Calculate statistics
	const classificationStats = getClassificationStats(contentWithMultiUse);
	const aggregated = aggregateContentByTheme(contentWithMultiUse, themes);
	const aggregationSummary = getAggregationSummary(aggregated);
	const crossThemeAnalysis = analyzeCrossThemeContent(contentWithMultiUse);

	// Build full results
	const fullResults: ClassificationJobResults = {
		jobId,
		extractionJobId: extractionJobIds[0] ?? "notion",
		extractionJobIds,
		projectId,
		themePageId,
		themes,
		classifiedContent: contentWithMultiUse,
		stats: {
			classification: classificationStats,
			aggregation: aggregationSummary,
			crossTheme: crossThemeAnalysis.stats,
		},
		processedAt: new Date().toISOString(),
	};

	// Save results to R2
	const resultsKey = `processing/${jobId}/classification-results.json`;
	await uploadToR2(
		resultsKey,
		Buffer.from(JSON.stringify(fullResults, null, 2)),
		"application/json"
	);

	await completeJob(jobId);
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
