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
	extractionJobId: string;
	/** Convex theme page ID (from themePages table) */
	themePageId: string;
}

/**
 * Results stored for a classification job.
 */
interface ClassificationJobResults {
	jobId: string;
	extractionJobId: string;
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
	extractionJobId: string;
	themePageId: string;
} {
	const { extractionJobId, themePageId } = body;

	if (!extractionJobId) {
		return {
			error: NextResponse.json(
				{ error: "extractionJobId is required" },
				{ status: 400 }
			),
			extractionJobId: "",
			themePageId: "",
		};
	}

	if (!themePageId) {
		return {
			error: NextResponse.json(
				{ error: "themePageId is required" },
				{ status: 400 }
			),
			extractionJobId,
			themePageId: "",
		};
	}

	return { error: null, extractionJobId, themePageId };
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

		const { extractionJobId, themePageId } = validation;

		// Verify extraction is completed (check both job and asset status)
		const extractionCheck = await isExtractionComplete(extractionJobId);

		if (!extractionCheck.complete) {
			// Not complete - return appropriate error
			if (!extractionCheck.job) {
				return NextResponse.json(
					{ error: "Extraction job not found" },
					{ status: 404 }
				);
			}

			return NextResponse.json(
				{
					error: "Extraction job not completed",
					status:
						extractionCheck.asset?.processingStatus ||
						extractionCheck.job.status,
					progress: extractionCheck.job.progress,
				},
				{ status: 400 }
			);
		}

		// Load extraction results
		const extractionResult = await loadExtractionResults(extractionJobId);
		if (extractionResult.error || !extractionResult.content) {
			return (
				extractionResult.error ??
				NextResponse.json(
					{ error: "Failed to load extraction results" },
					{ status: 500 }
				)
			);
		}
		const extractedContent = extractionResult.content;

		// Load themes from Convex
		const themesResult = await loadThemesFromConvex(themePageId);
		if (themesResult.error || !themesResult.themes) {
			return (
				themesResult.error ??
				NextResponse.json({ error: "Failed to load themes" }, { status: 500 })
			);
		}
		const themes = themesResult.themes;

		// Get source key and project ID from job or asset
		const sourceKey =
			extractionCheck.job?.sourceKey ?? extractionCheck.asset?.key;
		const projectId =
			extractionCheck.job?.projectId ?? extractionCheck.asset?.projectId;

		if (!sourceKey) {
			return NextResponse.json(
				{ error: "Cannot determine source key for classification" },
				{ status: 500 }
			);
		}

		// Create the classification job
		const job = await createJob(
			"classification",
			sourceKey,
			projectId,
			extractedContent.length
		);

		// Start processing in the background
		processClassificationJob(
			job.id,
			extractionJobId,
			themePageId,
			extractedContent,
			themes
		).catch((error) => {
			console.error(`Classification job ${job.id} failed:`, error);
			failJob(job.id, error instanceof Error ? error.message : "Unknown error");
		});

		return NextResponse.json(
			{
				jobId: job.id,
				status: job.status,
				extractionJobId,
				themePageId,
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
	extractionJobId: string,
	themePageId: string,
	content: ExtractedContent[],
	themes: MainTheme[]
) {
	// Classify content in batches
	const classifiedContent = await classifyContentBatch(
		content,
		themes,
		async (processed, total) => {
			await updateJobProgress(jobId, processed, total);
		}
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
		extractionJobId,
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
