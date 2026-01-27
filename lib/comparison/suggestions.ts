/**
 * Suggestion Generator
 * Generates actionable suggestions based on identified gaps.
 * Helps users understand what specific actions to take.
 */

import { generateText, Output } from "ai";
import { getModel } from "@/lib/ai/client";
import {
	COMPARISON_SYSTEM_PROMPT,
	createSuggestionPrompt,
} from "@/lib/llm/prompts/comparison";
import {
	type Suggestion,
	SuggestionResultSchema,
} from "@/lib/llm/schemas/comparison";
import type {
	ComparisonSuggestion,
	ContentGap,
	GapSeverity,
	SuggestionType,
} from "@/types/comparison";
import type { ExtractedContent } from "@/types/extraction";
import type { MainTheme, MiniTheme } from "@/types/theme";

/**
 * Maximum suggestions to generate per comparison.
 */
const MAX_SUGGESTIONS = 10;

/**
 * Generates suggestions based on identified gaps.
 *
 * @param gaps - Identified content gaps
 * @param topperContent - Topper content to reference
 * @param mainTheme - Main theme info
 * @param miniTheme - Mini theme info
 * @returns Array of actionable suggestions
 */
export async function generateSuggestions(
	gaps: ContentGap[],
	topperContent: ExtractedContent[],
	mainTheme: MainTheme,
	miniTheme: MiniTheme
): Promise<ComparisonSuggestion[]> {
	if (gaps.length === 0) {
		return [];
	}

	// Try LLM-generated suggestions first
	const llmSuggestions = await generateSuggestionsWithLLM(
		gaps,
		topperContent,
		mainTheme,
		miniTheme
	);

	if (llmSuggestions.length > 0) {
		return llmSuggestions;
	}

	// Fall back to rule-based suggestions
	return generateRuleBasedSuggestions(gaps, topperContent);
}

/**
 * Generates suggestions using LLM for more nuanced recommendations.
 */
export async function generateSuggestionsWithLLM(
	gaps: ContentGap[],
	topperContent: ExtractedContent[],
	mainTheme: MainTheme,
	miniTheme: MiniTheme
): Promise<ComparisonSuggestion[]> {
	const model = getModel("COMPARISON");

	// Prepare gap data for prompt
	const gapData = gaps.slice(0, 10).map((g) => ({
		contentType: g.contentType,
		exampleCategory: g.exampleCategory,
		description: g.description,
		severity: g.severity,
	}));

	const prompt = createSuggestionPrompt(gapData, topperContent, {
		mainTheme,
		miniTheme,
	});

	try {
		const { output } = await generateText({
			model,
			output: Output.object({
				schema: SuggestionResultSchema,
			}),
			system: COMPARISON_SYSTEM_PROMPT,
			prompt,
		});

		if (!output) {
			return [];
		}

		// Convert LLM suggestions to typed suggestions
		return output.suggestions
			.slice(0, MAX_SUGGESTIONS)
			.map((s, index) => convertToComparisonSuggestion(s, index));
	} catch (error) {
		console.error("LLM suggestion generation failed:", error);
		return [];
	}
}

/**
 * Converts LLM schema suggestion to ComparisonSuggestion type.
 */
function convertToComparisonSuggestion(
	suggestion: Suggestion,
	index: number
): ComparisonSuggestion {
	return {
		id: `suggestion-${Date.now()}-${index}`,
		type: suggestion.type as SuggestionType,
		description: suggestion.description,
		priority: suggestion.priority as GapSeverity,
		contentType: suggestion.contentType,
		exampleCategory: suggestion.exampleCategory,
		referenceContentIds: suggestion.referenceContentIds || [],
		actionItems: suggestion.actionItems || [],
	};
}

/**
 * Generates rule-based suggestions as fallback.
 */
function generateRuleBasedSuggestions(
	gaps: ContentGap[],
	topperContent: ExtractedContent[]
): ComparisonSuggestion[] {
	const suggestions: ComparisonSuggestion[] = [];
	let suggestionIndex = 0;

	// Sort gaps by severity
	const sortedGaps = [...gaps].sort((a, b) => {
		const severityOrder: Record<GapSeverity, number> = {
			high: 3,
			medium: 2,
			low: 1,
		};
		return severityOrder[b.severity] - severityOrder[a.severity];
	});

	for (const gap of sortedGaps.slice(0, MAX_SUGGESTIONS)) {
		const suggestion = createSuggestionForGap(
			gap,
			topperContent,
			suggestionIndex
		);
		suggestions.push(suggestion);
		suggestionIndex++;
	}

	return suggestions;
}

/**
 * Creates a suggestion for a specific gap.
 */
function createSuggestionForGap(
	gap: ContentGap,
	topperContent: ExtractedContent[],
	index: number
): ComparisonSuggestion {
	// Find relevant topper content for this gap
	const relevantContent = topperContent.filter(
		(c) =>
			c.contentType === gap.contentType &&
			(!gap.exampleCategory || c.exampleCategory === gap.exampleCategory)
	);

	const referenceIds = relevantContent.slice(0, 3).map((c) => c.id);
	const suggestionType = determineSuggestionType(gap);
	const actionItems = generateActionItems(gap);

	return {
		id: `suggestion-${Date.now()}-${index}`,
		type: suggestionType,
		description: generateSuggestionDescription(gap),
		priority: gap.severity,
		contentType: gap.contentType,
		exampleCategory: gap.exampleCategory,
		referenceContentIds: referenceIds,
		actionItems,
	};
}

/**
 * Determines the type of suggestion based on gap characteristics.
 */
function determineSuggestionType(gap: ContentGap): SuggestionType {
	// If user has 0 items in this area, it's an "add" suggestion
	if (gap.count === gap.topperContentIds.length) {
		return "add";
	}

	// If it's about category diversity, it's a "diversify" suggestion
	if (gap.exampleCategory) {
		return "diversify";
	}

	// Default to "improve" for partial coverage
	return "improve";
}

/**
 * Generates a human-readable suggestion description.
 */
function generateSuggestionDescription(gap: ContentGap): string {
	const contentTypeLabel = gap.contentType.replace("_", " ");

	switch (gap.severity) {
		case "high":
			if (gap.exampleCategory) {
				return `Add ${gap.exampleCategory} examples to strengthen your ${contentTypeLabel} coverage`;
			}
			return `Significantly expand your ${contentTypeLabel} content - toppers have ${gap.count} more items`;

		case "medium":
			if (gap.exampleCategory) {
				return `Consider adding more ${gap.exampleCategory} examples for better diversity`;
			}
			return `Improve your ${contentTypeLabel} content to match topper quality`;

		default:
			return `Optionally enhance your ${contentTypeLabel} content for excellence`;
	}
}

/**
 * Generates specific action items for a suggestion.
 */
function generateActionItems(gap: ContentGap): string[] {
	const items: string[] = [];
	const contentTypeLabel = gap.contentType.replace("_", " ");

	switch (gap.contentType) {
		case "introduction":
			items.push("Study topper openings to identify effective hooks");
			items.push("Collect anecdotes that can introduce multiple topics");
			items.push("Note memorable quotes that work as essay openers");
			break;

		case "conclusion":
			items.push("Analyze how toppers bring essays full circle");
			items.push("Collect forward-looking statements and calls to action");
			items.push("Note Sanskrit shlokas or wisdom quotes for closings");
			break;

		case "example":
			if (gap.exampleCategory) {
				items.push(
					`Research ${gap.exampleCategory} examples from current affairs`
				);
				items.push(
					`Find historical ${gap.exampleCategory} examples from Indian context`
				);
				items.push("Ensure examples illustrate core themes, not just decorate");
			} else {
				items.push("Diversify example categories across your content");
				items.push("Include contemporary and historical examples");
				items.push("Prioritize Indian context examples");
			}
			break;

		case "quote":
			items.push("Collect multi-use quotes applicable across themes");
			items.push("Note quotes from diverse thinkers (Indian and Western)");
			items.push("Find theme-specific quotes for depth");
			break;

		case "thinker":
			items.push("Research key ideas of important thinkers");
			items.push("Find specific examples/anecdotes from their lives");
			items.push("Balance Indian and Western thinkers");
			break;

		case "argument":
			items.push("Practice WHY/HOW/WHAT IF framing for arguments");
			items.push("Develop multi-stakeholder perspectives");
			items.push("Focus on breadth of reasoning over repetition");
			break;

		case "book_poem":
			items.push("Note relevant book titles and their key points");
			items.push("Collect poetry excerpts from Indian poets");
			items.push("Ensure literary references support arguments");
			break;

		case "keyword_phrase":
			items.push("Note sophisticated vocabulary from topper essays");
			items.push("Collect transition phrases for smooth flow");
			items.push("Practice using domain-specific terminology");
			break;

		default:
			items.push(`Study topper ${contentTypeLabel} for patterns`);
			items.push("Take structured notes while reading");
	}

	return items.slice(0, 3); // Return top 3 action items
}

/**
 * Prioritizes suggestions for a theme comparison.
 *
 * @param suggestions - All generated suggestions
 * @param maxSuggestions - Maximum suggestions to return
 * @returns Prioritized suggestions
 */
export function prioritizeSuggestions(
	suggestions: ComparisonSuggestion[],
	maxSuggestions: number = MAX_SUGGESTIONS
): ComparisonSuggestion[] {
	// Sort by priority (high first) and then by type (add > diversify > improve)
	const typeOrder: Record<SuggestionType, number> = {
		add: 3,
		diversify: 2,
		improve: 1,
	};

	const severityOrder: Record<GapSeverity, number> = {
		high: 3,
		medium: 2,
		low: 1,
	};

	return [...suggestions]
		.sort((a, b) => {
			// First sort by severity
			const severityDiff =
				severityOrder[b.priority] - severityOrder[a.priority];
			if (severityDiff !== 0) {
				return severityDiff;
			}
			// Then by type
			return typeOrder[b.type] - typeOrder[a.type];
		})
		.slice(0, maxSuggestions);
}

/**
 * Groups suggestions by content type for organized display.
 */
export function groupSuggestionsByType(
	suggestions: ComparisonSuggestion[]
): Map<string, ComparisonSuggestion[]> {
	const grouped = new Map<string, ComparisonSuggestion[]>();

	for (const suggestion of suggestions) {
		const key = suggestion.contentType;
		const existing = grouped.get(key) || [];
		existing.push(suggestion);
		grouped.set(key, existing);
	}

	return grouped;
}

/**
 * Gets the top suggestions across all themes.
 *
 * @param allSuggestions - Suggestions from multiple themes
 * @param maxTotal - Maximum total suggestions to return
 * @returns Top priority suggestions across themes
 */
export function getTopSuggestionsAcrossThemes(
	allSuggestions: Array<{
		themeName: string;
		suggestions: ComparisonSuggestion[];
	}>,
	maxTotal = 10
): ComparisonSuggestion[] {
	// Flatten all suggestions with theme info
	const flattened: ComparisonSuggestion[] = [];

	for (const { suggestions } of allSuggestions) {
		flattened.push(...suggestions);
	}

	// Prioritize and limit
	return prioritizeSuggestions(flattened, maxTotal);
}

/**
 * Creates a summary of suggestions for display.
 */
export function summarizeSuggestions(suggestions: ComparisonSuggestion[]): {
	total: number;
	byPriority: Record<GapSeverity, number>;
	byType: Record<SuggestionType, number>;
	topActions: string[];
} {
	const byPriority: Record<GapSeverity, number> = {
		high: 0,
		medium: 0,
		low: 0,
	};

	const byType: Record<SuggestionType, number> = {
		add: 0,
		improve: 0,
		diversify: 0,
	};

	const allActions: string[] = [];

	for (const suggestion of suggestions) {
		byPriority[suggestion.priority]++;
		byType[suggestion.type]++;
		allActions.push(...suggestion.actionItems);
	}

	// Get unique top actions (first 5)
	const uniqueActions = [...new Set(allActions)].slice(0, 5);

	return {
		total: suggestions.length,
		byPriority,
		byType,
		topActions: uniqueActions,
	};
}
