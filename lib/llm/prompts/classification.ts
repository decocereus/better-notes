/**
 * LLM Prompts for Theme Classification
 * Specialized prompts for classifying extracted content into theme hierarchy.
 */

import type { ExtractedContent } from "@/types/extraction";
import type { MainTheme, MiniTheme } from "@/types/theme";

/**
 * System prompt for theme classification.
 */
export const CLASSIFICATION_SYSTEM_PROMPT = `You are an expert at classifying UPSC essay content into themes for exam preparation.

Your task is to analyze content and determine which themes it applies to.

IMPORTANT PRINCIPLES:
1. Content can belong to MULTIPLE themes (cross-cutting content is valuable)
2. Consider both direct relevance and tangential applicability
3. Use relevance scores to indicate strength of connection:
   - 0.9-1.0: Core match - content is primarily about this theme
   - 0.7-0.89: Strong match - highly relevant to this theme
   - 0.5-0.69: Moderate match - can be applied with some adaptation
   - Below 0.5: Weak match - don't include unless specifically relevant

CLASSIFICATION CRITERIA:
- Match content to themes based on conceptual alignment
- Consider the essay questions under each mini-theme for context
- Quotes and examples often apply across multiple philosophical themes
- Governance/policy examples may apply to multiple implementation themes
- Individual stories can illustrate various ethical or philosophical points

OUTPUT REQUIREMENTS:
- Only include themes with relevance score >= 0.5
- Provide brief reasoning for each classification
- Flag content that applies to 3+ themes as "multi-theme"

OUTPUT FORMAT:
You MUST output ONLY a valid JSON object. Do not include any introductory text, explanations, or markdown formatting. Output raw JSON only.

REQUIRED JSON STRUCTURE:
{
  "mappings": [
    {
      "mainThemeId": "string - exact ID from theme hierarchy",
      "miniThemeId": "string - exact ID from theme hierarchy",
      "relevanceScore": "number between 0.5 and 1.0",
      "reasoning": "string - brief explanation"
    }
  ],
  "isMultiTheme": "boolean - true if 3+ themes",
  "confidence": "string - 'high', 'medium', or 'low'"
}`;

/**
 * Creates a theme hierarchy summary for the prompt.
 */
export function formatThemeHierarchy(themes: MainTheme[]): string {
	const lines: string[] = [];

	for (const mainTheme of themes) {
		lines.push(`\n## ${mainTheme.title} (ID: ${mainTheme.id})`);

		for (const miniTheme of mainTheme.miniThemes) {
			lines.push(`  - ${miniTheme.title} (ID: ${miniTheme.id})`);

			// Include sample questions for context
			const sampleQuestions = miniTheme.questions.slice(0, 2);
			for (const question of sampleQuestions) {
				lines.push(
					`      * ${question.year}: ${question.text.slice(0, 80)}...`
				);
			}
		}
	}

	return lines.join("\n");
}

/**
 * Creates a classification prompt for a single content item.
 */
export function createClassificationPrompt(
	content: ExtractedContent,
	themes: MainTheme[]
): string {
	const themeHierarchy = formatThemeHierarchy(themes);

	return `Classify the following content into the theme hierarchy.

=== CONTENT TO CLASSIFY ===
Type: ${content.contentType}
${content.exampleCategory ? `Category: ${content.exampleCategory}` : ""}
Content: ${content.content}
${content.context ? `Context: ${content.context}` : ""}
Quality: ${content.quality}
Multi-use: ${content.multiUse ? "Yes" : "No"}
=== END CONTENT ===

=== THEME HIERARCHY ===${themeHierarchy}
=== END THEME HIERARCHY ===

CLASSIFICATION RULES:
- Classify this content into ALL relevant themes (score >= 0.5)
- Include mappings array with mainThemeId and miniThemeId from the hierarchy above
- isMultiTheme should be true if content applies to 3+ themes
- Set confidence to "high", "medium", or "low"

OUTPUT FORMAT - Return ONLY this exact JSON structure:
{
  "mappings": [
    {
      "mainThemeId": "theme-id-from-hierarchy",
      "miniThemeId": "mini-theme-id-from-hierarchy",
      "relevanceScore": 0.85,
      "reasoning": "Brief explanation of why this content fits this theme"
    }
  ],
  "isMultiTheme": true,
  "confidence": "high"
}

IMPORTANT: Use the exact field names shown above: "mappings", "mainThemeId", "miniThemeId", "isMultiTheme", "confidence"`;
}

/**
 * Creates a batch classification prompt for multiple content items.
 * More efficient for classifying many items at once.
 */
export function createBatchClassificationPrompt(
	contents: ExtractedContent[],
	themes: MainTheme[]
): string {
	const themeHierarchy = formatThemeHierarchy(themes);

	const contentList = contents
		.map(
			(c, i) => `
[${i + 1}] ID: ${c.id}
Type: ${c.contentType}${c.exampleCategory ? ` (${c.exampleCategory})` : ""}
Content: ${c.content.slice(0, 200)}${c.content.length > 200 ? "..." : ""}`
		)
		.join("\n");

	return `Classify each of the following ${contents.length} content items into the theme hierarchy.

=== CONTENT ITEMS ===${contentList}
=== END CONTENT ITEMS ===

=== THEME HIERARCHY ===${themeHierarchy}
=== END THEME HIERARCHY ===

CLASSIFICATION RULES:
- Classify each content item into ALL relevant themes (score >= 0.5)
- Use the exact IDs from the theme hierarchy above
- Mark as multiTheme if content applies to 3+ themes
- Set confidence to "high", "medium", or "low"

OUTPUT FORMAT - Return ONLY this exact JSON structure:
{
  "classifications": [
    {
      "contentId": "content-id-from-list",
      "mappings": [
        {
          "mainThemeId": "theme-id-from-hierarchy",
          "miniThemeId": "mini-theme-id-from-hierarchy",
          "relevanceScore": 0.85,
          "reasoning": "Brief explanation"
        }
      ],
      "isMultiTheme": true,
      "confidence": "high"
    }
  ],
  "totalItems": ${contents.length},
  "multiThemeCount": 0,
  "averageMappingsPerItem": 0
}

IMPORTANT: Use the exact field names shown above: "mappings", "mainThemeId", "miniThemeId", "isMultiTheme", "confidence"`;
}

/**
 * Creates a prompt for re-classifying content when themes change.
 */
export function createReclassificationPrompt(
	content: ExtractedContent,
	currentMappings: ExtractedContent["themes"],
	themes: MainTheme[]
): string {
	const themeHierarchy = formatThemeHierarchy(themes);

	const currentMappingsText =
		currentMappings.length > 0
			? currentMappings
					.map(
						(m) =>
							`  - Main: ${m.mainThemeId}, Mini: ${m.miniThemeId}, Score: ${m.relevanceScore}`
					)
					.join("\n")
			: "  None";

	return `Review and update the theme classification for this content.

=== CONTENT ===
Type: ${content.contentType}
Content: ${content.content}
=== END CONTENT ===

=== CURRENT MAPPINGS ===
${currentMappingsText}
=== END CURRENT MAPPINGS ===

=== THEME HIERARCHY ===${themeHierarchy}
=== END THEME HIERARCHY ===

Review the current classifications and:
1. Keep valid classifications that still apply
2. Remove any that are no longer relevant
3. Add new themes that were missed
4. Adjust relevance scores if needed

Output the complete updated classification.`;
}

/**
 * Gets mini-theme by ID from the theme hierarchy.
 */
export function findMiniTheme(
	themes: MainTheme[],
	miniThemeId: string
): { mainTheme: MainTheme; miniTheme: MiniTheme } | null {
	for (const mainTheme of themes) {
		const miniTheme = mainTheme.miniThemes.find((m) => m.id === miniThemeId);
		if (miniTheme) {
			return { mainTheme, miniTheme };
		}
	}
	return null;
}

/**
 * Validates that theme IDs in mappings exist in the hierarchy.
 */
export function validateThemeMappings(
	mappings: ExtractedContent["themes"],
	themes: MainTheme[]
): {
	valid: ExtractedContent["themes"];
	invalid: ExtractedContent["themes"];
} {
	const valid: ExtractedContent["themes"] = [];
	const invalid: ExtractedContent["themes"] = [];

	const mainThemeIds = new Set(themes.map((t) => t.id));
	const miniThemeIds = new Set(
		themes.flatMap((t) => t.miniThemes.map((m) => m.id))
	);

	for (const mapping of mappings) {
		if (
			mainThemeIds.has(mapping.mainThemeId) &&
			miniThemeIds.has(mapping.miniThemeId)
		) {
			valid.push(mapping);
		} else {
			invalid.push(mapping);
		}
	}

	return { valid, invalid };
}
