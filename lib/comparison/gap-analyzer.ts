/**
 * Gap Analyzer
 * Analyzes gaps between user content and topper content per theme.
 * Identifies what the user is missing compared to toppers.
 */

import { generateText, Output } from "ai";
import { getModel } from "@/lib/ai/client";
import {
	COMPARISON_SYSTEM_PROMPT,
	createGapAnalysisPrompt,
	createReadinessAssessmentPrompt,
} from "@/lib/llm/prompts/comparison";
import {
	type ContentGap,
	GapAnalysisResultSchema,
	ReadinessAssessmentSchema,
	sortGapsBySeverity,
} from "@/lib/llm/schemas/comparison";
import {
	type CoverageStat,
	DEFAULT_SCORING_CONFIG,
	type ExampleCategoryCoverage,
	type GapSeverity,
	type QualityComparison,
	type ScoringConfig,
	type ThemeComparisonResult,
	type ContentGap as TypedContentGap,
} from "@/types/comparison";
import type {
	ContentQuality,
	ContentType,
	ExampleCategory,
	ExtractedContent,
} from "@/types/extraction";
import type { MainTheme, MiniTheme } from "@/types/theme";

// Re-export for external use
export { DEFAULT_SCORING_CONFIG } from "@/types/comparison";

/**
 * Calculates coverage percentage based on user and topper counts.
 */
function calculateCoveragePercent(
	userCount: number,
	topperCount: number
): number {
	if (topperCount > 0) {
		return Math.round((Math.min(userCount, topperCount) / topperCount) * 100);
	}
	if (userCount > 0) {
		return 100;
	}
	return 0;
}

/**
 * All content types for iteration.
 */
const ALL_CONTENT_TYPES: ContentType[] = [
	"introduction",
	"conclusion",
	"example",
	"quote",
	"thinker",
	"argument",
	"book_poem",
	"keyword_phrase",
];

/**
 * All example categories for iteration.
 */
const ALL_EXAMPLE_CATEGORIES: ExampleCategory[] = [
	"individual",
	"ethical",
	"governance",
	"societal",
	"environment",
	"mythological",
	"sports",
	"religion",
	"business",
	"international_relations",
	"science_tech",
];

/**
 * Analyzes gaps between user and topper content for a theme.
 *
 * @param userContent - User's classified content for the theme
 * @param topperContent - Topper's classified content for the theme
 * @param mainTheme - Main theme info
 * @param miniTheme - Mini theme info
 * @param config - Scoring configuration
 * @returns Complete comparison result
 */
export async function analyzeGaps(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[],
	mainTheme: MainTheme,
	miniTheme: MiniTheme,
	config: ScoringConfig = DEFAULT_SCORING_CONFIG,
	modelId?: string
): Promise<ThemeComparisonResult> {
	// Calculate coverage statistics
	const coverage = calculateCoverageStats(userContent, topperContent);
	const exampleCoverage = calculateExampleCategoryCoverage(
		userContent,
		topperContent
	);
	const quality = calculateQualityComparison(userContent, topperContent);

	// Use LLM to identify meaningful gaps
	const llmGaps = await identifyGapsWithLLM(
		userContent,
		topperContent,
		mainTheme,
		miniTheme,
		modelId
	);

	// Convert LLM gaps to typed gaps with IDs
	const gaps = llmGaps.map((gap, index) => ({
		id: `gap-${Date.now()}-${index}`,
		...gap,
	}));

	// Calculate scores
	const coverageScore = calculateCoverageScore(coverage, config);
	const qualityScore = calculateQualityScore(quality);
	const diversityScore = calculateDiversityScore(exampleCoverage);

	const overallScore =
		coverageScore * config.coverageWeight +
		qualityScore * config.qualityWeight +
		diversityScore * config.diversityWeight;

	// Count gaps by severity
	const highSeverityGaps = gaps.filter((g) => g.severity === "high").length;
	const mediumSeverityGaps = gaps.filter((g) => g.severity === "medium").length;
	const lowSeverityGaps = gaps.filter((g) => g.severity === "low").length;

	return {
		mainThemeId: mainTheme.id,
		mainThemeName: mainTheme.title,
		miniThemeId: miniTheme.id,
		miniThemeName: miniTheme.title,
		comparedAt: new Date().toISOString(),
		coverage,
		exampleCoverage,
		gaps,
		suggestions: [], // Will be populated by suggestion generator
		quality,
		overallScore: Math.round(overallScore),
		scoreBreakdown: {
			coverageScore: Math.round(coverageScore),
			qualityScore: Math.round(qualityScore),
			diversityScore: Math.round(diversityScore),
		},
		summary: {
			userContentCount: userContent.length,
			topperContentCount: topperContent.length,
			highSeverityGaps,
			mediumSeverityGaps,
			lowSeverityGaps,
			suggestionCount: 0, // Updated after suggestions generated
		},
	};
}

/**
 * Calculates coverage statistics for each content type.
 */
function calculateCoverageStats(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[]
): CoverageStat[] {
	const stats: CoverageStat[] = [];

	for (const contentType of ALL_CONTENT_TYPES) {
		const userItems = userContent.filter((c) => c.contentType === contentType);
		const topperItems = topperContent.filter(
			(c) => c.contentType === contentType
		);

		const userCount = userItems.length;
		const topperCount = topperItems.length;

		// Calculate overlap (content IDs that appear in both - simplified)
		// In practice, this would use semantic similarity
		const overlapCount = 0; // TODO: Implement semantic similarity

		// Coverage is what percentage of topper content user has
		const coveragePercent = calculateCoveragePercent(userCount, topperCount);

		stats.push({
			contentType,
			userCount,
			topperCount,
			userContentIds: userItems.map((c) => c.id),
			topperUniqueIds: topperItems.map((c) => c.id),
			overlapCount,
			coveragePercent,
		});
	}

	return stats;
}

/**
 * Calculates coverage statistics for example categories.
 */
function calculateExampleCategoryCoverage(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[]
): ExampleCategoryCoverage[] {
	const stats: ExampleCategoryCoverage[] = [];

	// Filter to examples only
	const userExamples = userContent.filter((c) => c.contentType === "example");
	const topperExamples = topperContent.filter(
		(c) => c.contentType === "example"
	);

	for (const category of ALL_EXAMPLE_CATEGORIES) {
		const userItems = userExamples.filter(
			(c) => c.exampleCategory === category
		);
		const topperItems = topperExamples.filter(
			(c) => c.exampleCategory === category
		);

		const userCount = userItems.length;
		const topperCount = topperItems.length;

		const coveragePercent = calculateCoveragePercent(userCount, topperCount);

		stats.push({
			category,
			userCount,
			topperCount,
			userContentIds: userItems.map((c) => c.id),
			topperUniqueIds: topperItems.map((c) => c.id),
			coveragePercent,
		});
	}

	return stats;
}

/**
 * Calculates quality comparison between user and topper content.
 */
function calculateQualityComparison(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[]
): QualityComparison {
	const countByQuality = (
		content: ExtractedContent[],
		quality: ContentQuality
	) => content.filter((c) => c.quality === quality).length;

	const userHigh = countByQuality(userContent, "high");
	const userMedium = countByQuality(userContent, "medium");
	const userLow = countByQuality(userContent, "low");

	const topperHigh = countByQuality(topperContent, "high");
	const topperMedium = countByQuality(topperContent, "medium");
	const topperLow = countByQuality(topperContent, "low");

	// Calculate average quality score (high=1, medium=0.5, low=0)
	const calculateAverage = (high: number, medium: number, low: number) => {
		const total = high + medium + low;
		if (total === 0) {
			return 0;
		}
		return (high * 1 + medium * 0.5 + low * 0) / total;
	};

	return {
		userQuality: {
			high: userHigh,
			medium: userMedium,
			low: userLow,
		},
		topperQuality: {
			high: topperHigh,
			medium: topperMedium,
			low: topperLow,
		},
		userAverageScore: calculateAverage(userHigh, userMedium, userLow),
		topperAverageScore: calculateAverage(topperHigh, topperMedium, topperLow),
		userOverusedCount: userContent.filter((c) => c.isOverused).length,
		userMultiUseCount: userContent.filter((c) => c.multiUse).length,
		topperMultiUseCount: topperContent.filter((c) => c.multiUse).length,
	};
}

/**
 * Uses LLM to identify meaningful gaps beyond statistics.
 */
async function identifyGapsWithLLM(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[],
	mainTheme: MainTheme,
	miniTheme: MiniTheme,
	modelId?: string
): Promise<ContentGap[]> {
	// If no topper content, no gaps to identify via LLM
	if (topperContent.length === 0) {
		return [];
	}

	const model = getModel("COMPARISON", modelId);
	const prompt = createGapAnalysisPrompt(userContent, topperContent, {
		mainTheme,
		miniTheme,
	});

	try {
		const { output } = await generateText({
			model,
			output: Output.object({
				schema: GapAnalysisResultSchema,
			}),
			system: COMPARISON_SYSTEM_PROMPT,
			prompt,
		});

		if (!output) {
			return identifyStatisticalGaps(userContent, topperContent);
		}

		return sortGapsBySeverity(output.gaps);
	} catch (error) {
		console.error("LLM gap analysis failed:", error);
		// Fall back to statistical gap analysis
		return identifyStatisticalGaps(userContent, topperContent);
	}
}

/**
 * Fallback statistical gap identification without LLM.
 */
function identifyStatisticalGaps(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[]
): ContentGap[] {
	const gaps: ContentGap[] = [];

	// Check each content type for significant gaps
	for (const contentType of ALL_CONTENT_TYPES) {
		const userCount = userContent.filter(
			(c) => c.contentType === contentType
		).length;
		const topperItems = topperContent.filter(
			(c) => c.contentType === contentType
		);
		const topperCount = topperItems.length;

		if (topperCount > 0 && userCount < topperCount * 0.5) {
			const severity: GapSeverity = determineSeverity(userCount, topperCount);

			gaps.push({
				contentType,
				description: `User has ${userCount} ${contentType}(s) vs ${topperCount} from toppers`,
				severity,
				topperContentIds: topperItems.slice(0, 5).map((c) => c.id),
				reasoning: `Coverage is below 50% for ${contentType}`,
				count: topperCount - userCount,
			});
		}
	}

	// Check example categories
	const userExamples = userContent.filter((c) => c.contentType === "example");
	const topperExamples = topperContent.filter(
		(c) => c.contentType === "example"
	);

	for (const category of ALL_EXAMPLE_CATEGORIES) {
		const userCatCount = userExamples.filter(
			(c) => c.exampleCategory === category
		).length;
		const topperCatItems = topperExamples.filter(
			(c) => c.exampleCategory === category
		);
		const topperCatCount = topperCatItems.length;

		// Flag if user has 0 but topper has 2+
		if (userCatCount === 0 && topperCatCount >= 2) {
			gaps.push({
				contentType: "example",
				exampleCategory: category,
				description: `No ${category} examples - toppers have ${topperCatCount}`,
				severity: category === "ethical" ? "high" : "medium", // Ethical is extra important
				topperContentIds: topperCatItems.slice(0, 3).map((c) => c.id),
				reasoning: `Missing entire ${category} example category`,
				count: topperCatCount,
			});
		}
	}

	return sortGapsBySeverity(gaps);
}

/**
 * Determines severity based on coverage ratio.
 */
function determineSeverity(
	userCount: number,
	topperCount: number
): GapSeverity {
	if (topperCount === 0) {
		return "low";
	}
	const ratio = userCount / topperCount;
	if (ratio < 0.3) {
		return "high";
	}
	if (ratio < 0.6) {
		return "medium";
	}
	return "low";
}

/**
 * Calculates overall coverage score (0-100).
 */
function calculateCoverageScore(
	coverage: CoverageStat[],
	config: ScoringConfig
): number {
	let totalWeight = 0;
	let weightedScore = 0;

	for (const stat of coverage) {
		// Weight by importance (more important types get higher weight)
		const weight = config.minGoodCoverage[stat.contentType] || 3;
		totalWeight += weight;

		// Score is based on coverage percentage, capped at 100
		weightedScore += Math.min(stat.coveragePercent, 100) * weight;
	}

	return totalWeight > 0 ? weightedScore / totalWeight : 0;
}

/**
 * Calculates quality score (0-100).
 */
function calculateQualityScore(quality: QualityComparison): number {
	// Penalize for overused content
	const overusedPenalty = quality.userOverusedCount * 5;

	// Bonus for multi-use content
	const multiUseBonus = Math.min(quality.userMultiUseCount * 3, 15);

	// Base score from average quality (0-1 -> 0-100)
	const baseScore = quality.userAverageScore * 100;

	return Math.max(
		0,
		Math.min(100, baseScore - overusedPenalty + multiUseBonus)
	);
}

/**
 * Calculates diversity score for examples (0-100).
 */
function calculateDiversityScore(
	exampleCoverage: ExampleCategoryCoverage[]
): number {
	const categoriesWithContent = exampleCoverage.filter(
		(c) => c.userCount > 0
	).length;

	const totalCategories = exampleCoverage.length;

	// Base score from category coverage
	const coverageRatio = categoriesWithContent / totalCategories;
	let score = coverageRatio * 100;

	// Bonus for having ethical examples (important for UPSC)
	const ethicalCoverage = exampleCoverage.find((c) => c.category === "ethical");
	if (ethicalCoverage && ethicalCoverage.userCount > 0) {
		score += 10;
	}

	// Bonus for having governance examples (shows Indian context awareness)
	const govCoverage = exampleCoverage.find((c) => c.category === "governance");
	if (govCoverage && govCoverage.userCount > 0) {
		score += 5;
	}

	return Math.min(100, score);
}

/**
 * Gets a readiness assessment using LLM.
 */
export async function getReadinessAssessment(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[],
	mainTheme: MainTheme,
	miniTheme: MiniTheme,
	gapCount: number,
	suggestionCount: number,
	modelId?: string
): Promise<{
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
}> {
	const model = getModel("COMPARISON", modelId);
	const prompt = createReadinessAssessmentPrompt(
		userContent,
		topperContent,
		{ mainTheme, miniTheme },
		gapCount,
		suggestionCount
	);

	try {
		const { output } = await generateText({
			model,
			output: Output.object({
				schema: ReadinessAssessmentSchema,
			}),
			system: COMPARISON_SYSTEM_PROMPT,
			prompt,
		});

		if (!output) {
			throw new Error("Readiness assessment returned null");
		}

		return output;
	} catch (error) {
		console.error("Readiness assessment failed:", error);
		// Return a default assessment
		return {
			overallScore: 50,
			scoreBreakdown: {
				coverageScore: 50,
				qualityScore: 50,
				diversityScore: 50,
			},
			justification: "Unable to generate detailed assessment",
			strengths: [],
			criticalImprovements: ["Review your content and compare with toppers"],
			recommendedFocus: "Focus on gaps identified in the comparison",
		};
	}
}

/**
 * Filters content by source type.
 */
export function filterBySource(
	content: ExtractedContent[],
	sourceType: "user" | "topper"
): ExtractedContent[] {
	return content.filter((c) => c.sourceType === sourceType);
}

/**
 * Gets high-value topper content for a specific gap.
 */
export function getTopperContentForGap(
	topperContent: ExtractedContent[],
	gap: TypedContentGap
): ExtractedContent[] {
	return topperContent.filter(
		(c) =>
			c.contentType === gap.contentType &&
			(!gap.exampleCategory || c.exampleCategory === gap.exampleCategory) &&
			c.quality !== "low"
	);
}
