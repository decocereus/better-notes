/**
 * Comparison API Route
 * Compares user content vs topper content for a theme.
 * Identifies gaps and generates improvement suggestions.
 *
 * POST: Start a new comparison
 * GET: Get comparison results
 */

import { type NextRequest, NextResponse } from "next/server";
import { validateAIConfig } from "@/lib/ai";
import {
	analyzeGaps,
	generateSuggestions,
	getReadinessAssessment,
} from "@/lib/comparison";
import { getModelForTask } from "@/lib/llm/provider";
import {
	completeJob,
	createJob,
	failJob,
	getJob,
	updateJobProgress,
} from "@/lib/processing";
import { downloadFromR2, uploadToR2, validateR2Config } from "@/lib/storage";
import type {
	ComparisonSuggestion,
	StartComparisonInput,
	ThemeComparisonResult,
} from "@/types/comparison";
import type { ExtractedContent } from "@/types/extraction";
import type { MainTheme, MiniTheme } from "@/types/theme";

/**
 * Request body for comparison.
 */
interface CompareRequestBody extends StartComparisonInput {
	/** Classification job ID to get content from */
	classificationJobId: string;
	/** Optional model configuration per task */
	modelConfig?: Record<string, string>;
}

/**
 * Results stored for a comparison job.
 */
interface ComparisonJobResults {
	jobId: string;
	classificationJobId: string;
	mainThemeId: string;
	miniThemeId: string;
	result: ThemeComparisonResult;
	readinessAssessment: {
		overallScore: number;
		scoreBreakdown: {
			coverageScore: number;
			qualityScore: number;
			diversityScore: number;
		};
		justification: string;
		strengths: string[];
		criticalImprovements: string[];
		recommendedFocus: string;
	};
	processedAt: string;
}

/**
 * Classification job results structure.
 */
interface ClassificationJobResults {
	themes: MainTheme[];
	classifiedContent: ExtractedContent[];
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

	return null;
}

/**
 * Validates the request body.
 */
function validateRequestBody(body: CompareRequestBody): {
	error: NextResponse | null;
	classificationJobId: string;
	mainThemeId: string;
	miniThemeId: string;
	userContentIds?: string[] | "all";
	topperContentIds?: string[] | "all";
	modelConfig?: Record<string, string>;
} {
	const {
		classificationJobId,
		mainThemeId,
		miniThemeId,
		userContentIds,
		topperContentIds,
		modelConfig,
	} = body;

	if (!classificationJobId) {
		return {
			error: NextResponse.json(
				{ error: "classificationJobId is required" },
				{ status: 400 }
			),
			classificationJobId: "",
			mainThemeId: "",
			miniThemeId: "",
			modelConfig,
		};
	}

	if (!mainThemeId) {
		return {
			error: NextResponse.json(
				{ error: "mainThemeId is required" },
				{ status: 400 }
			),
			classificationJobId,
			mainThemeId: "",
			miniThemeId: "",
			modelConfig,
		};
	}

	if (!miniThemeId) {
		return {
			error: NextResponse.json(
				{ error: "miniThemeId is required" },
				{ status: 400 }
			),
			classificationJobId,
			mainThemeId,
			miniThemeId: "",
			modelConfig,
		};
	}

	return {
		error: null,
		classificationJobId,
		mainThemeId,
		miniThemeId,
		userContentIds,
		topperContentIds,
		modelConfig,
	};
}

/**
 * Loads classification results from R2.
 */
async function loadClassificationResults(classificationJobId: string): Promise<{
	data: ClassificationJobResults | null;
	error: NextResponse | null;
}> {
	const resultsKey = `processing/${classificationJobId}/classification-results.json`;

	try {
		const { body: stream } = await downloadFromR2(resultsKey);
		const text = await streamToString(stream);
		const results = JSON.parse(text) as ClassificationJobResults;
		return { data: results, error: null };
	} catch {
		return {
			data: null,
			error: NextResponse.json(
				{ error: "Failed to load classification results" },
				{ status: 500 }
			),
		};
	}
}

/**
 * Filters content by theme and source type.
 */
function filterContentByTheme(
	content: ExtractedContent[],
	mainThemeId: string,
	miniThemeId: string,
	sourceType: "user" | "topper",
	contentIds?: string[] | "all"
): ExtractedContent[] {
	return content.filter((c) => {
		// Check source type
		if (c.sourceType !== sourceType) {
			return false;
		}

		// Check theme mapping
		const hasTheme = c.themes.some(
			(t) => t.mainThemeId === mainThemeId && t.miniThemeId === miniThemeId
		);
		if (!hasTheme) {
			return false;
		}

		// Check content IDs if specified
		if (contentIds && contentIds !== "all") {
			return contentIds.includes(c.id);
		}

		return true;
	});
}

/**
 * Finds theme info from themes array.
 */
function findThemeInfo(
	themes: MainTheme[],
	mainThemeId: string,
	miniThemeId: string
): { mainTheme: MainTheme | null; miniTheme: MiniTheme | null } {
	const mainTheme = themes.find((t) => t.id === mainThemeId) || null;
	const miniTheme =
		mainTheme?.miniThemes.find((m) => m.id === miniThemeId) || null;

	return { mainTheme, miniTheme };
}

/**
 * POST /api/compare
 * Starts a new comparison analysis.
 */
export async function POST(request: NextRequest) {
	try {
		// Validate configurations
		const configError = validateConfigurations();
		if (configError) {
			return configError;
		}

		// Parse and validate request
		const body = (await request.json()) as CompareRequestBody;
		const validation = validateRequestBody(body);
		if (validation.error) {
			return validation.error;
		}

		const {
			classificationJobId,
			mainThemeId,
			miniThemeId,
			userContentIds,
			topperContentIds,
			modelConfig,
		} = validation;

		// Verify classification job is completed
		const classificationJob = await getJob(classificationJobId);
		if (!classificationJob) {
			return NextResponse.json(
				{ error: "Classification job not found" },
				{ status: 404 }
			);
		}

		if (classificationJob.status !== "completed") {
			return NextResponse.json(
				{
					error: "Classification job not completed",
					status: classificationJob.status,
					progress: classificationJob.progress,
				},
				{ status: 400 }
			);
		}

		// Load classification results
		const classificationResult =
			await loadClassificationResults(classificationJobId);
		if (classificationResult.error || !classificationResult.data) {
			return (
				classificationResult.error ??
				NextResponse.json(
					{ error: "Failed to load classification results" },
					{ status: 500 }
				)
			);
		}

		const { themes, classifiedContent } = classificationResult.data;

		// Find theme info
		const { mainTheme, miniTheme } = findThemeInfo(
			themes,
			mainThemeId,
			miniThemeId
		);

		if (!(mainTheme && miniTheme)) {
			return NextResponse.json(
				{
					error: "Theme not found",
					mainThemeId,
					miniThemeId,
					availableThemes: themes.map((t) => ({
						id: t.id,
						title: t.title,
						miniThemes: t.miniThemes.map((m) => ({ id: m.id, title: m.title })),
					})),
				},
				{ status: 404 }
			);
		}

		// Filter content by theme and source type
		const userContent = filterContentByTheme(
			classifiedContent,
			mainThemeId,
			miniThemeId,
			"user",
			userContentIds
		);

		const topperContent = filterContentByTheme(
			classifiedContent,
			mainThemeId,
			miniThemeId,
			"topper",
			topperContentIds
		);

		// Create the comparison job
		const job = await createJob(
			"comparison",
			classificationJob.sourceKey,
			classificationJob.projectId,
			3 // 3 steps: gap analysis, suggestions, readiness
		);

		// Start processing in background
		const modelId = getModelForTask("comparison", modelConfig);

		processComparisonJob(
			job.id,
			classificationJobId,
			userContent,
			topperContent,
			mainTheme,
			miniTheme,
			modelId
		).catch((error) => {
			console.error(`Comparison job ${job.id} failed:`, error);
			failJob(job.id, error instanceof Error ? error.message : "Unknown error");
		});

		return NextResponse.json(
			{
				jobId: job.id,
				status: job.status,
				classificationJobId,
				mainThemeId,
				miniThemeId,
				userContentCount: userContent.length,
				topperContentCount: topperContent.length,
			},
			{ status: 202 }
		);
	} catch (error) {
		console.error("Failed to start comparison job:", error);
		return NextResponse.json(
			{
				error: "Failed to start comparison job",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

/**
 * GET /api/compare?jobId=xxx
 * Gets the status and results of a comparison job.
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
		const resultsKey = `processing/${jobId}/comparison-results.json`;

		try {
			const { body: stream } = await downloadFromR2(resultsKey);
			const text = await streamToString(stream);
			const results = JSON.parse(text) as ComparisonJobResults;

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
 * Background function to process comparison job.
 */
async function processComparisonJob(
	jobId: string,
	classificationJobId: string,
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[],
	mainTheme: MainTheme,
	miniTheme: MiniTheme,
	modelId?: string
) {
	// Step 1: Analyze gaps
	await updateJobProgress(jobId, 0, 3);
	const gapResult = await analyzeGaps(
		userContent,
		topperContent,
		mainTheme,
		miniTheme,
		undefined,
		modelId
	);

	// Step 2: Generate suggestions
	await updateJobProgress(jobId, 1, 3);
	let suggestions: ComparisonSuggestion[] = [];
	if (gapResult.gaps.length > 0) {
		suggestions = await generateSuggestions(
			gapResult.gaps,
			topperContent,
			mainTheme,
			miniTheme,
			modelId
		);
	}

	// Update result with suggestions
	const comparisonResult: ThemeComparisonResult = {
		...gapResult,
		suggestions,
		summary: {
			...gapResult.summary,
			suggestionCount: suggestions.length,
		},
	};

	// Step 3: Get readiness assessment
	await updateJobProgress(jobId, 2, 3);
	const readinessAssessment = await getReadinessAssessment(
		userContent,
		topperContent,
		mainTheme,
		miniTheme,
		comparisonResult.gaps.length,
		suggestions.length,
		modelId
	);

	// Build full results
	const fullResults: ComparisonJobResults = {
		jobId,
		classificationJobId,
		mainThemeId: mainTheme.id,
		miniThemeId: miniTheme.id,
		result: comparisonResult,
		readinessAssessment,
		processedAt: new Date().toISOString(),
	};

	// Save results to R2
	const resultsKey = `processing/${jobId}/comparison-results.json`;
	await uploadToR2(
		resultsKey,
		Buffer.from(JSON.stringify(fullResults, null, 2)),
		"application/json"
	);

	await updateJobProgress(jobId, 3, 3);
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
