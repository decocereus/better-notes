/**
 * LLM Prompts for Strategy Document → Extraction Parameters
 */

import type { ExtractionParameters } from "@/types/extraction";

/**
 * System prompt for converting a strategy document into extraction parameters.
 */
export const PARAMETERS_SYSTEM_PROMPT = `You convert a UPSC essay strategy document into extraction parameters for a content-extraction pipeline.

Return ONLY a JSON object that matches the required schema.

Rules:
- Use ONLY the allowed enum values and categories.
- If the strategy document does not mention a setting, KEEP the default value provided.
- enabledCategories must include at least one category.
- overusedExamples should be lowercase strings without extra punctuation.
- Do not invent categories or values that are not listed.`;

/**
 * Builds a prompt for extracting parameters from a strategy document.
 */
export function createStrategyParametersPrompt(
	strategyText: string,
	defaults: ExtractionParameters
): string {
	const defaultJson = JSON.stringify(defaults, null, 2);

	return `Strategy document (from Notion):
"""
${strategyText}
"""

DEFAULT PARAMETERS (use as fallback when not specified):
${defaultJson}

ALLOWED VALUES:
- enabledCategories: ["individual","ethical","governance","societal","environment","mythological","sports","religion","business","international_relations","science_tech"]
- thinkerPriority: "indian" | "western" | "balanced"
- quoteStyle: "multi_use_preferred" | "theme_specific"
- minQualityThreshold: "high" | "medium" | "low"
- extractCrossThemeRefs: true | false

Return the updated parameters as JSON only.`;
}
