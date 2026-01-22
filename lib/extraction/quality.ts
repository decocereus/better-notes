/**
 * Quality Scoring for Extracted Content
 * Flags overused examples, assesses multi-use potential, and scores quality.
 */

import type { ContentQuality, ContentType } from "@/types/extraction";

/**
 * Default patterns for overused examples (case-insensitive).
 * These are commonly cited in UPSC essays and should be flagged.
 */
const DEFAULT_OVERUSED_PATTERNS = [
	// Overused individuals
	/\bgandhi\b/i,
	/\bmahatma\b/i,
	/\bbuddha\b/i,
	/\bashoka\b/i,
	/\bmandela\b/i,
	/\bmartin luther king\b/i,
	/\bmlk\b/i,

	// Overused phrases
	/vasudhaiva kutumbakam/i,
	/satyamev jayate/i,
	/unity in diversity/i,
	/world is a family/i,

	// Overused concepts without context
	/\bswachh bharat\b/i,
	/\bdigital india\b/i,
	/\bmake in india\b/i,
] as const;

/**
 * Patterns indicating potentially high-quality content.
 */
const HIGH_QUALITY_INDICATORS = [
	// Specific data points
	/\d{4}.*?report/i, // Year + report
	/according to.*?(\d{4}|\brecent\b)/i, // Recent citations
	/\bstud(y|ies)\b.*?found/i, // Research citations

	// Specific examples
	/\bin \d{4}\b/i, // Specific years
	/\b(district|state|country) of\b/i, // Specific locations

	// Nuanced thinking
	/\bhowever\b.*?\balso\b/i, // Balanced perspective
	/\bon one hand\b.*?\bon the other\b/i, // Nuanced argument
	/\bcriticism\b|\bcritique\b/i, // Critical analysis

	// Contemporary references
	/\bCOP\d{2}\b/i, // Climate conferences
	/\bG20\b|\bBRICS\b|\bASEAN\b/i, // International forums
	/\bSDG\b|\bsustainable development goal/i, // UN goals
] as const;

/**
 * Patterns indicating potentially low-quality content.
 */
const LOW_QUALITY_INDICATORS = [
	// Generic statements
	/\bsince time immemorial\b/i,
	/\bsince ancient times\b/i,
	/\beveryone knows\b/i,
	/\bit is well known\b/i,
	/\bneedless to say\b/i,

	// Thesis statements (not good for extraction)
	/\bin this essay\b/i,
	/\bi will discuss\b/i,
	/\blet us examine\b/i,

	// Overly simple
	/^(yes|no|true|false)[.,]?$/i,
	/\bobviously\b/i,
	/\bclearly\b.*\bshow/i,
] as const;

/**
 * Patterns indicating universal/multi-use themes.
 */
const UNIVERSAL_THEME_INDICATORS = [
	/\btruth\b/i,
	/\bjustice\b/i,
	/\bfreedom\b/i,
	/\bequality\b/i,
	/\bhumanity\b/i,
	/\bwisdom\b/i,
	/\bvirtue\b/i,
	/\bethics\b/i,
	/\bmoral\b/i,
	/\blife\b/i,
	/\bsociety\b/i,
	/\bprogress\b/i,
] as const;

/**
 * Patterns indicating broad framing in arguments.
 */
const BROAD_FRAMING_INDICATORS = [
	/\bfundamental\b/i,
	/\buniversal\b/i,
	/\bessential\b/i,
	/\bcore\b/i,
	/\bbasic human\b/i,
] as const;

/**
 * Checks if content contains overused examples.
 *
 * @param content - The text content to check
 * @param customOverused - Additional overused patterns from user settings
 * @returns Whether the content contains overused examples
 */
export function isOverusedExample(
	content: string,
	customOverused: string[] = []
): boolean {
	// Check default patterns
	for (const pattern of DEFAULT_OVERUSED_PATTERNS) {
		if (pattern.test(content)) {
			return true;
		}
	}

	// Check custom patterns (convert strings to case-insensitive patterns)
	for (const custom of customOverused) {
		const pattern = new RegExp(`\\b${escapeRegex(custom)}\\b`, "i");
		if (pattern.test(content)) {
			return true;
		}
	}

	return false;
}

/**
 * Assesses if content is likely applicable across multiple themes.
 *
 * @param content - The text content to assess
 * @param contentType - Type of the content
 * @returns Whether the content is likely multi-use
 */
export function assessMultiUse(
	content: string,
	contentType: ContentType
): boolean {
	// Certain content types are more likely to be multi-use
	const multiUseFriendlyTypes: ContentType[] = [
		"quote",
		"thinker",
		"keyword_phrase",
	];

	if (multiUseFriendlyTypes.includes(contentType)) {
		// Quotes and thinkers are often universally applicable
		// Check for universal themes
		for (const indicator of UNIVERSAL_THEME_INDICATORS) {
			if (indicator.test(content)) {
				return true;
			}
		}
	}

	// Arguments with broad framing
	if (contentType === "argument") {
		for (const indicator of BROAD_FRAMING_INDICATORS) {
			if (indicator.test(content)) {
				return true;
			}
		}
	}

	// Check content length - very short quotes are often more reusable
	if (contentType === "quote" && content.length < 100) {
		return true;
	}

	return false;
}

/**
 * Checks if content matches any high-quality indicators.
 */
function matchesHighQuality(content: string): boolean {
	return HIGH_QUALITY_INDICATORS.some((pattern) => pattern.test(content));
}

/**
 * Checks if content matches any low-quality indicators.
 */
function matchesLowQuality(content: string): boolean {
	return LOW_QUALITY_INDICATORS.some((pattern) => pattern.test(content));
}

/**
 * Scores content length for examples and arguments.
 */
function scoreExampleLength(length: number): {
	score: number;
	reason: string | null;
} {
	if (length < 50) {
		return { score: -15, reason: "Too brief for meaningful extraction" };
	}
	if (length > 150 && length < 500) {
		return { score: 10, reason: "Good detail level" };
	}
	return { score: 0, reason: null };
}

/**
 * Scores content length for quotes.
 */
function scoreQuoteLength(length: number): {
	score: number;
	reason: string | null;
} {
	if (length > 200) {
		return { score: -10, reason: "Quote too long for easy recall" };
	}
	if (length >= 30 && length <= 100) {
		return { score: 10, reason: "Good quote length" };
	}
	return { score: 0, reason: null };
}

/**
 * Converts a numeric score to a quality level.
 */
function scoreToQuality(score: number): ContentQuality {
	if (score >= 70) {
		return "high";
	}
	if (score >= 40) {
		return "medium";
	}
	return "low";
}

/**
 * Calculates a quality score for content.
 *
 * @param content - The text content to score
 * @param contentType - Type of the content
 * @returns Quality level and reasoning
 */
export function calculateQuality(
	content: string,
	contentType: ContentType
): { quality: ContentQuality; reasoning: string } {
	let score = 50; // Start at medium
	const reasons: string[] = [];

	// Check for high-quality indicators
	if (matchesHighQuality(content)) {
		score += 15;
		reasons.push("Contains specific/nuanced content");
	}

	// Check for low-quality indicators
	if (matchesLowQuality(content)) {
		score -= 20;
		reasons.push("Contains generic/weak content");
	}

	// Content length considerations
	if (contentType === "example" || contentType === "argument") {
		const result = scoreExampleLength(content.length);
		score += result.score;
		if (result.reason) {
			reasons.push(result.reason);
		}
	}

	// Quotes should be concise
	if (contentType === "quote") {
		const result = scoreQuoteLength(content.length);
		score += result.score;
		if (result.reason) {
			reasons.push(result.reason);
		}
	}

	// Check for overused content
	if (isOverusedExample(content)) {
		score -= 25;
		reasons.push("Contains commonly overused example");
	}

	return {
		quality: scoreToQuality(score),
		reasoning: reasons.length > 0 ? reasons.join("; ") : "Standard content",
	};
}

/**
 * Filters content based on minimum quality threshold.
 *
 * @param items - Array of items with quality property
 * @param threshold - Minimum quality level to include
 * @returns Filtered items meeting threshold
 */
export function filterByQuality<T extends { quality: ContentQuality }>(
	items: T[],
	threshold: ContentQuality
): T[] {
	const qualityOrder: Record<ContentQuality, number> = {
		low: 1,
		medium: 2,
		high: 3,
	};

	const minLevel = qualityOrder[threshold];
	return items.filter((item) => qualityOrder[item.quality] >= minLevel);
}

/**
 * Gets a list of all default overused patterns as strings.
 */
export function getDefaultOverusedList(): string[] {
	return [
		"Gandhi",
		"Buddha",
		"Ashoka",
		"Mandela",
		"Martin Luther King",
		"Vasudhaiva Kutumbakam",
		"Unity in diversity",
	];
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
