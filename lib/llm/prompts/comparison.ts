/**
 * LLM Prompts for Comparison Analysis
 * Specialized prompts for comparing user content against topper content.
 */

import type {
	ContentType,
	ExampleCategory,
	ExtractedContent,
} from "@/types/extraction";
import type { MainTheme, MiniTheme } from "@/types/theme";

/**
 * System prompt for comparison analysis.
 */
export const COMPARISON_SYSTEM_PROMPT = `You are an expert at comparing UPSC aspirant content against topper essay content.

Your task is to analyze what content the user has versus what toppers have, identify gaps, and provide actionable suggestions.

ANALYSIS FRAMEWORK:

1. **COVERAGE ANALYSIS**: Compare content quantity by type
   - What content types does the user have vs toppers?
   - Are there types where user has significantly less?
   - Is the user missing entire categories?

2. **QUALITY ANALYSIS**: Compare content quality
   - User's high/medium/low quality distribution
   - How does it compare to topper's distribution?
   - Is user over-relying on overused examples?

3. **DIVERSITY ANALYSIS**: Compare breadth of content
   - Example category coverage (ethical, governance, societal, etc.)
   - Thinker variety (Indian vs Western, different domains)
   - Argument dimension diversity (WHY, HOW, WHAT IF)

4. **GAP IDENTIFICATION**: Identify specific missing elements
   - HIGH severity: Critical gaps that will hurt essay quality
   - MEDIUM severity: Notable gaps that limit essay depth
   - LOW severity: Nice-to-have additions for excellence

5. **SUGGESTIONS**: Actionable improvements
   - ADD: Completely new content to acquire
   - IMPROVE: Existing content to enhance
   - DIVERSIFY: Areas needing more variety

PRINCIPLES:
- Focus on ACTIONABLE insights, not just statistics
- Prioritize gaps by impact on essay preparation
- Reference specific topper content as examples
- Consider cross-theme applicability
- Be constructive, not discouraging`;

/**
 * Content type descriptions for comparison context.
 */
export const CONTENT_TYPE_DESCRIPTIONS: Record<ContentType, string> = {
	introduction: "Essay openings - anecdotes, quotes, hooks that set the tone",
	conclusion:
		"Essay closings - summaries, circular references, forward-looking statements",
	example: "Concrete illustrations across various categories",
	quote: "Memorable statements from thinkers, literature, or original phrasing",
	thinker: "Referenced intellectuals and their key ideas",
	argument:
		"Core reasoning patterns - WHY/HOW/WHAT IF framing, multi-stakeholder views",
	book_poem: "Literary references - books, poetry, cultural texts",
	keyword_phrase: "Reusable sophisticated vocabulary and transitions",
};

/**
 * Creates a prompt for gap analysis between user and topper content.
 */
export function createGapAnalysisPrompt(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[],
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme }
): string {
	const userSummary = summarizeContentForPrompt(userContent, "User");
	const topperSummary = summarizeContentForPrompt(topperContent, "Topper");

	return `Analyze the gap between user content and topper content for this theme.

=== THEME ===
Main Theme: ${theme.mainTheme.title}
Mini Theme: ${theme.miniTheme.title}
${formatQuestions(theme.miniTheme)}
=== END THEME ===

=== USER CONTENT (${userContent.length} items) ===
${userSummary}
=== END USER CONTENT ===

=== TOPPER CONTENT (${topperContent.length} items) ===
${topperSummary}
=== END TOPPER CONTENT ===

Analyze:
1. What content types is the user missing or underrepresented in?
2. What specific high-value topper content should the user study?
3. What are the most critical gaps (HIGH severity)?
4. What actionable suggestions can help the user improve?

For each gap identified:
- Specify the content type and category (if applicable)
- Explain why this gap matters
- Reference specific topper content as examples
- Assign severity (high/medium/low)`;
}

/**
 * Creates a prompt for generating improvement suggestions.
 */
export function createSuggestionPrompt(
	gaps: Array<{
		contentType: ContentType;
		exampleCategory?: ExampleCategory;
		description: string;
		severity: "high" | "medium" | "low";
	}>,
	topperContent: ExtractedContent[],
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme }
): string {
	const gapsList = gaps
		.map(
			(g, i) =>
				`${i + 1}. [${g.severity.toUpperCase()}] ${g.contentType}${g.exampleCategory ? ` (${g.exampleCategory})` : ""}: ${g.description}`
		)
		.join("\n");

	const topperExamples = formatTopperExamples(topperContent.slice(0, 15));

	return `Generate specific, actionable suggestions to address these content gaps.

=== THEME ===
${theme.mainTheme.title} > ${theme.miniTheme.title}
=== END THEME ===

=== IDENTIFIED GAPS ===
${gapsList}
=== END GAPS ===

=== TOPPER CONTENT FOR REFERENCE ===
${topperExamples}
=== END TOPPER CONTENT ===

For each gap, provide:

1. **Suggestion Type**: ADD (new content), IMPROVE (enhance existing), or DIVERSIFY (add variety)
2. **Description**: Clear, actionable statement of what to do
3. **Priority**: Match to gap severity
4. **Action Items**: 2-3 specific steps to implement
5. **Reference**: Which topper content items to study for inspiration (by ID)

Focus on HIGH and MEDIUM priority gaps first. Be specific and practical.`;
}

/**
 * Creates a prompt for overall theme readiness assessment.
 */
export function createReadinessAssessmentPrompt(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[],
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme },
	gaps: number,
	suggestions: number
): string {
	const userStats = getContentStats(userContent);
	const topperStats = getContentStats(topperContent);

	return `Assess the user's readiness for writing essays on this theme.

=== THEME ===
${theme.mainTheme.title} > ${theme.miniTheme.title}
=== END THEME ===

=== USER STATISTICS ===
Total items: ${userContent.length}
By type: ${formatStats(userStats.byType)}
Quality: High=${userStats.highQuality}, Medium=${userStats.mediumQuality}, Low=${userStats.lowQuality}
Overused: ${userStats.overused}
Multi-use: ${userStats.multiUse}
=== END USER STATISTICS ===

=== TOPPER STATISTICS ===
Total items: ${topperContent.length}
By type: ${formatStats(topperStats.byType)}
Quality: High=${topperStats.highQuality}, Medium=${topperStats.mediumQuality}, Low=${topperStats.lowQuality}
Multi-use: ${topperStats.multiUse}
=== END TOPPER STATISTICS ===

=== ANALYSIS SUMMARY ===
Gaps identified: ${gaps}
Suggestions generated: ${suggestions}
=== END ANALYSIS SUMMARY ===

Provide:
1. Overall readiness score (0-100) with justification
2. Score breakdown:
   - Coverage score (how much content user has vs toppers)
   - Quality score (quality distribution comparison)
   - Diversity score (variety across types and categories)
3. Key strengths (what user is doing well)
4. Critical areas for improvement (top 3)
5. Recommended study focus (next steps)`;
}

/**
 * Formats content item flags (overused, multi-use).
 */
function formatItemFlags(item: ExtractedContent): string {
	const flags: string[] = [];
	if (item.isOverused) {
		flags.push("OVERUSED");
	}
	if (item.multiUse) {
		flags.push("MULTI-USE");
	}
	return flags.length > 0 ? ` | ${flags.join(", ")}` : "";
}

/**
 * Formats a single content item for the prompt.
 */
function formatContentItem(item: ExtractedContent): string {
	const quality = item.quality.toUpperCase();
	const flags = formatItemFlags(item);
	const truncatedContent =
		item.content.length > 150
			? `${item.content.slice(0, 150)}...`
			: item.content;
	return `- [${quality}${flags}] ${truncatedContent} (ID: ${item.id})`;
}

/**
 * Groups content by type into a Map.
 */
function groupContentByType(
	content: ExtractedContent[]
): Map<ContentType, ExtractedContent[]> {
	const byType = new Map<ContentType, ExtractedContent[]>();
	for (const item of content) {
		const existing = byType.get(item.contentType) || [];
		existing.push(item);
		byType.set(item.contentType, existing);
	}
	return byType;
}

/**
 * Summarizes content array for inclusion in prompt.
 */
function summarizeContentForPrompt(
	content: ExtractedContent[],
	label: string
): string {
	if (content.length === 0) {
		return `${label} has no content for this theme.`;
	}

	const byType = groupContentByType(content);
	const lines: string[] = [];

	for (const [type, items] of byType) {
		lines.push(`\n### ${type.toUpperCase()} (${items.length} items)`);

		// Show up to 3 examples per type
		for (const item of items.slice(0, 3)) {
			lines.push(formatContentItem(item));
		}

		if (items.length > 3) {
			lines.push(`  ... and ${items.length - 3} more`);
		}
	}

	return lines.join("\n");
}

/**
 * Formats theme questions for context.
 */
function formatQuestions(miniTheme: MiniTheme): string {
	if (miniTheme.questions.length === 0) {
		return "";
	}

	const questions = miniTheme.questions
		.slice(0, 3)
		.map((q) => `- ${q.year}: ${q.text.slice(0, 80)}...`)
		.join("\n");

	return `Sample PYQs:\n${questions}`;
}

/**
 * Formats topper content examples for reference.
 */
function formatTopperExamples(content: ExtractedContent[]): string {
	return content
		.map(
			(c) =>
				`[ID: ${c.id}] ${c.contentType}${c.exampleCategory ? ` (${c.exampleCategory})` : ""}: ${c.content.slice(0, 100)}...`
		)
		.join("\n");
}

/**
 * Gets statistics for content array.
 */
function getContentStats(content: ExtractedContent[]): {
	byType: Record<ContentType, number>;
	highQuality: number;
	mediumQuality: number;
	lowQuality: number;
	overused: number;
	multiUse: number;
} {
	const stats = {
		byType: {
			introduction: 0,
			conclusion: 0,
			example: 0,
			quote: 0,
			thinker: 0,
			argument: 0,
			book_poem: 0,
			keyword_phrase: 0,
		} as Record<ContentType, number>,
		highQuality: 0,
		mediumQuality: 0,
		lowQuality: 0,
		overused: 0,
		multiUse: 0,
	};

	for (const item of content) {
		stats.byType[item.contentType]++;

		if (item.quality === "high") {
			stats.highQuality++;
		} else if (item.quality === "medium") {
			stats.mediumQuality++;
		} else {
			stats.lowQuality++;
		}

		if (item.isOverused) {
			stats.overused++;
		}
		if (item.multiUse) {
			stats.multiUse++;
		}
	}

	return stats;
}

/**
 * Formats stats object for display.
 */
function formatStats(byType: Record<ContentType, number>): string {
	return Object.entries(byType)
		.filter(([, count]) => count > 0)
		.map(([type, count]) => `${type}=${count}`)
		.join(", ");
}

/**
 * Creates a prompt for comparing example diversity specifically.
 */
export function createExampleDiversityPrompt(
	userExamples: ExtractedContent[],
	topperExamples: ExtractedContent[]
): string {
	const userByCategory = groupExamplesByCategory(userExamples);
	const topperByCategory = groupExamplesByCategory(topperExamples);

	const categories: ExampleCategory[] = [
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

	const comparison = categories
		.map((cat) => {
			const userCount = userByCategory.get(cat)?.length || 0;
			const topperCount = topperByCategory.get(cat)?.length || 0;
			return `${cat}: User=${userCount}, Topper=${topperCount}`;
		})
		.join("\n");

	return `Analyze example category diversity between user and topper content.

=== CATEGORY COMPARISON ===
${comparison}
=== END COMPARISON ===

Identify:
1. Categories where user is significantly behind
2. Categories completely missing from user content
3. Over-reliance on specific categories
4. Recommendations for diversification

Note: Ethical examples carry extra marks in UPSC essays.
Governance and societal examples demonstrate awareness of Indian context.`;
}

/**
 * Groups examples by category.
 */
function groupExamplesByCategory(
	content: ExtractedContent[]
): Map<ExampleCategory, ExtractedContent[]> {
	const byCategory = new Map<ExampleCategory, ExtractedContent[]>();

	for (const item of content) {
		if (item.contentType === "example" && item.exampleCategory) {
			const existing = byCategory.get(item.exampleCategory) || [];
			existing.push(item);
			byCategory.set(item.exampleCategory, existing);
		}
	}

	return byCategory;
}
