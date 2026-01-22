/**
 * Zod Schemas for Comparison Analysis
 * Validates LLM comparison output for type safety.
 */

import { z } from "zod";

/**
 * Schema for gap severity.
 */
export const GapSeveritySchema = z.enum(["high", "medium", "low"]);
export type GapSeverity = z.infer<typeof GapSeveritySchema>;

/**
 * Schema for suggestion type.
 */
export const SuggestionTypeSchema = z.enum(["add", "improve", "diversify"]);
export type SuggestionType = z.infer<typeof SuggestionTypeSchema>;

/**
 * Schema for content type enum.
 */
export const ContentTypeSchema = z.enum([
	"introduction",
	"conclusion",
	"example",
	"quote",
	"thinker",
	"argument",
	"book_poem",
	"keyword_phrase",
]);

/**
 * Schema for example category enum.
 */
export const ExampleCategorySchema = z.enum([
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
]);

/**
 * Schema for an identified content gap.
 */
export const ContentGapSchema = z.object({
	contentType: ContentTypeSchema.describe("Content type where gap exists"),

	exampleCategory: ExampleCategorySchema.optional().describe(
		"Example category (only for example type)"
	),

	description: z.string().describe("Human-readable description of the gap"),

	severity: GapSeveritySchema.describe("How critical this gap is"),

	topperContentIds: z
		.array(z.string())
		.describe("IDs of topper content illustrating this gap"),

	reasoning: z.string().describe("Why this gap matters for essay preparation"),

	count: z.number().describe("Number of topper items illustrating this gap"),
});

export type ContentGap = z.infer<typeof ContentGapSchema>;

/**
 * Schema for gap analysis result from LLM.
 */
export const GapAnalysisResultSchema = z.object({
	gaps: z.array(ContentGapSchema).describe("Identified gaps"),

	summary: z.string().describe("Overall summary of gaps found"),

	criticalMissing: z
		.array(z.string())
		.describe("Content types completely missing"),

	totalGaps: z.number().describe("Total number of gaps identified"),

	highPriorityGapCount: z.number().describe("Number of high severity gaps"),
});

export type GapAnalysisResult = z.infer<typeof GapAnalysisResultSchema>;

/**
 * Schema for an improvement suggestion.
 */
export const SuggestionSchema = z.object({
	type: SuggestionTypeSchema.describe("Type of action recommended"),

	description: z.string().describe("Human-readable suggestion"),

	priority: GapSeveritySchema.describe("Priority level"),

	contentType: ContentTypeSchema.describe("Content type this relates to"),

	exampleCategory: ExampleCategorySchema.optional().describe(
		"Example category (if applicable)"
	),

	referenceContentIds: z
		.array(z.string())
		.describe("Topper content IDs to reference for inspiration"),

	actionItems: z
		.array(z.string())
		.describe("Specific action items to implement"),
});

export type Suggestion = z.infer<typeof SuggestionSchema>;

/**
 * Schema for suggestion generation result from LLM.
 */
export const SuggestionResultSchema = z.object({
	suggestions: z.array(SuggestionSchema).describe("Generated suggestions"),

	highPrioritySuggestions: z
		.number()
		.describe("Count of high priority suggestions"),

	totalActionItems: z
		.number()
		.describe("Total action items across all suggestions"),

	focusArea: z.string().describe("Primary area the user should focus on"),
});

export type SuggestionResult = z.infer<typeof SuggestionResultSchema>;

/**
 * Schema for readiness assessment result from LLM.
 */
export const ReadinessAssessmentSchema = z.object({
	overallScore: z
		.number()
		.min(0)
		.max(100)
		.describe("Overall readiness score (0-100)"),

	scoreBreakdown: z.object({
		coverageScore: z
			.number()
			.min(0)
			.max(100)
			.describe("Score for content coverage"),
		qualityScore: z
			.number()
			.min(0)
			.max(100)
			.describe("Score for content quality"),
		diversityScore: z
			.number()
			.min(0)
			.max(100)
			.describe("Score for content diversity"),
	}),

	justification: z.string().describe("Explanation for the overall score"),

	strengths: z.array(z.string()).describe("What the user is doing well"),

	criticalImprovements: z
		.array(z.string())
		.describe("Top areas needing improvement"),

	recommendedFocus: z.string().describe("What the user should focus on next"),
});

export type ReadinessAssessment = z.infer<typeof ReadinessAssessmentSchema>;

/**
 * Schema for example diversity analysis result.
 */
export const ExampleDiversityAnalysisSchema = z.object({
	categoriesBelow: z
		.array(
			z.object({
				category: ExampleCategorySchema,
				userCount: z.number(),
				topperCount: z.number(),
				gap: z.number(),
			})
		)
		.describe("Categories where user is significantly behind"),

	missingCategories: z
		.array(ExampleCategorySchema)
		.describe("Categories completely missing from user content"),

	overReliance: z
		.array(
			z.object({
				category: ExampleCategorySchema,
				percentage: z.number(),
			})
		)
		.optional()
		.describe("Categories user is over-relying on"),

	recommendations: z
		.array(z.string())
		.describe("Recommendations for diversification"),

	diversityScore: z
		.number()
		.min(0)
		.max(100)
		.describe("Diversity score (0-100)"),
});

export type ExampleDiversityAnalysis = z.infer<
	typeof ExampleDiversityAnalysisSchema
>;

/**
 * Helper to validate gap analysis result.
 */
export function validateGapAnalysis(data: unknown): {
	success: boolean;
	data?: GapAnalysisResult;
	error?: string;
} {
	const result = GapAnalysisResultSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}

/**
 * Helper to validate suggestion result.
 */
export function validateSuggestionResult(data: unknown): {
	success: boolean;
	data?: SuggestionResult;
	error?: string;
} {
	const result = SuggestionResultSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}

/**
 * Helper to validate readiness assessment.
 */
export function validateReadinessAssessment(data: unknown): {
	success: boolean;
	data?: ReadinessAssessment;
	error?: string;
} {
	const result = ReadinessAssessmentSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}

/**
 * Filters suggestions by priority.
 */
export function filterSuggestionsByPriority(
	suggestions: Suggestion[],
	minPriority: GapSeverity
): Suggestion[] {
	const priorityOrder: Record<GapSeverity, number> = {
		high: 3,
		medium: 2,
		low: 1,
	};

	const minOrder = priorityOrder[minPriority];

	return suggestions.filter((s) => priorityOrder[s.priority] >= minOrder);
}

/**
 * Sorts gaps by severity (high first).
 */
export function sortGapsBySeverity(gaps: ContentGap[]): ContentGap[] {
	const severityOrder: Record<GapSeverity, number> = {
		high: 3,
		medium: 2,
		low: 1,
	};

	return [...gaps].sort(
		(a, b) => severityOrder[b.severity] - severityOrder[a.severity]
	);
}

/**
 * Groups gaps by content type.
 */
export function groupGapsByContentType(
	gaps: ContentGap[]
): Map<string, ContentGap[]> {
	const grouped = new Map<string, ContentGap[]>();

	for (const gap of gaps) {
		const key = gap.contentType;
		const existing = grouped.get(key) || [];
		existing.push(gap);
		grouped.set(key, existing);
	}

	return grouped;
}
