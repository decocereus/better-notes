/**
 * LLM Prompts for Note Generation
 * Specialized prompts for generating dual-section revision notes.
 */

import type {
	ContentType,
	ExtractedContent,
	ThemeMapping,
} from "@/types/extraction";
import type { GenerationConfig } from "@/types/generation";
import type { MainTheme, MiniTheme } from "@/types/theme";

/**
 * System prompt for dual-section note generation.
 * Emphasizes REVISION-READY format and conciseness.
 */
export const GENERATION_SYSTEM_PROMPT = `You are an expert at creating REVISION-READY notes for UPSC essay preparation.

Your task is to generate TWO SECTIONS of notes that an aspirant can quickly review before an exam.

=== OUTPUT FORMAT ===

## YOUR NOTES
- Distill the user's content into KEY POINTS
- Keep examples CONCISE (1-2 sentences max)
- Format for quick scanning (bullet points)
- Target: 200-350 words
- Include: Key arguments, best examples, memorable quotes
- DO NOT dump raw content - SYNTHESIZE and DISTILL

---

## TOPPER INSIGHTS
- Add UNIQUE content the user is missing
- Focus on HIGH-QUALITY additions only
- Include cross-theme references where applicable
- Target: 150-300 words
- DO NOT repeat what's in "Your Notes"
- Priority: Intro hooks, strong examples, unique arguments, effective conclusions

=== END OUTPUT FORMAT ===

CRITICAL REQUIREMENTS:

1. **REVISION-READY**: Notes must be scannable in 2-3 minutes before an exam
   - Bullet points, not paragraphs
   - No verbose explanations
   - Each point should stand alone

2. **CONCISENESS**: Quality over quantity
   - Trim excess without losing meaning
   - Prefer shorter, punchier phrasing
   - Avoid redundancy between sections

3. **STRUCTURE**: Clear mental model for the theme
   - Group related points
   - Use sub-bullets for examples under arguments
   - Mark cross-theme content with ↔️

4. **ACTIONABLE**: Content should be directly usable in essays
   - Examples should be write-ready
   - Quotes should be memorizable
   - Arguments should have clear WHY/HOW framing

DO NOT:
- Include generic statements ("This theme is important...")
- Repeat the same point in different words
- Add filler content to meet word counts
- Use academic jargon unnecessarily`;

/**
 * Content type priorities for note generation.
 * Higher priority content appears first.
 */
export const CONTENT_TYPE_PRIORITY: Record<ContentType, number> = {
	introduction: 1, // Intro hooks are high value
	argument: 2, // Core reasoning
	example: 3, // Concrete illustrations
	quote: 4, // Memorable statements
	thinker: 5, // Referenced thinkers
	conclusion: 6, // Closing techniques
	book_poem: 7, // Literary references
	keyword_phrase: 8, // Useful phrases
};

/**
 * Creates a prompt for generating dual-section notes.
 */
export function createNoteGenerationPrompt(
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[],
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme },
	config: GenerationConfig
): string {
	const userSummary = formatContentForGeneration(userContent, "user");
	const topperSummary = formatContentForGeneration(topperContent, "topper");
	const crossThemeContent = identifyCrossThemeContent([
		...userContent,
		...topperContent,
	]);

	return `Generate revision-ready notes for the following theme.

=== THEME ===
Main Theme: ${theme.mainTheme.title}
Mini Theme: ${theme.miniTheme.title}
${formatThemeQuestions(theme.miniTheme)}
=== END THEME ===

=== USER'S CONTENT (${userContent.length} items) ===
${userSummary || "User has no content for this theme yet."}
=== END USER'S CONTENT ===

=== TOPPER CONTENT (${topperContent.length} items) ===
${topperSummary || "No topper content available for reference."}
=== END TOPPER CONTENT ===

${crossThemeContent.length > 0 ? formatCrossThemeSection(crossThemeContent) : ""}

GENERATION PARAMETERS:
- Max "Your Notes" words: ${config.maxYourNotesWords}
- Max "Topper Insights" words: ${config.maxTopperInsightsWords}
- Include cross-theme references: ${config.includeCrossThemeSection}
- Format style: ${config.formatStyle}

INSTRUCTIONS:
1. Create "Your Notes" section from USER'S CONTENT
   - Distill, don't dump
   - Prioritize high-quality items
   - Group logically by argument/theme aspect

2. Create "Topper Insights" section from TOPPER CONTENT
   - Only include what USER doesn't have
   - Focus on unique, high-value additions
   - Add cross-theme markers where applicable

3. Keep BOTH sections within word limits
   - If over limit, cut lower-value content
   - Maintain at least 3-5 key points per section

OUTPUT FORMAT:
Return the notes in the exact dual-section format specified in the system prompt.`;
}

/**
 * Creates a prompt for condensing notes that exceed word limits.
 */
export function createCondensationPrompt(
	section: "yourNotes" | "topperInsights",
	currentContent: string,
	currentWordCount: number,
	targetWordCount: number,
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme }
): string {
	const sectionName =
		section === "yourNotes" ? "Your Notes" : "Topper Insights";

	return `Condense the following ${sectionName} section for the theme "${theme.mainTheme.title} > ${theme.miniTheme.title}".

CURRENT CONTENT (${currentWordCount} words):
${currentContent}

TARGET: ${targetWordCount} words maximum

CONDENSATION RULES:
1. Keep the most important points
2. Merge similar points where possible
3. Remove redundant examples (keep the strongest one)
4. Shorten verbose explanations
5. Maintain bullet point format
6. Preserve the core meaning and usability

DO NOT:
- Remove all examples (keep at least 2-3 best ones)
- Make content so brief it loses meaning
- Change the structure significantly
- Add new content

OUTPUT: The condensed version, maintaining markdown bullet format.`;
}

/**
 * Creates a prompt for identifying cross-theme applicability.
 */
export function createCrossThemePrompt(
	content: ExtractedContent[],
	allThemes: MainTheme[]
): string {
	const contentList = content
		.filter((c) => c.multiUse || c.quality === "high")
		.slice(0, 20)
		.map(
			(c) =>
				`[${c.id}] ${c.contentType}: ${c.content.slice(0, 100)}${c.content.length > 100 ? "..." : ""}`
		)
		.join("\n");

	const themeList = allThemes
		.flatMap((main) =>
			main.miniThemes.map((mini) => `${main.title} > ${mini.title}`)
		)
		.join("\n");

	return `Identify cross-theme applicability for the following content.

=== CONTENT TO ANALYZE ===
${contentList}
=== END CONTENT ===

=== AVAILABLE THEMES ===
${themeList}
=== END THEMES ===

For each content item, identify 2-3 other themes where it could be effectively used.
Only include strong matches where the content genuinely fits the theme.

OUTPUT FORMAT:
For each item, return:
- Content ID
- List of applicable theme names (main > mini format)
- Brief reason why it fits (1 sentence)`;
}

/**
 * Creates a prompt for generating a quick summary note.
 */
export function createQuickSummaryPrompt(
	content: ExtractedContent[],
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme },
	maxWords: number
): string {
	const contentSummary = content
		.slice(0, 10)
		.map((c) => `- ${c.contentType}: ${c.content.slice(0, 80)}...`)
		.join("\n");

	return `Create a ${maxWords}-word quick summary note for:

Theme: ${theme.mainTheme.title} > ${theme.miniTheme.title}

Content:
${contentSummary}

Requirements:
- 5-7 bullet points maximum
- Most important points only
- Exam-ready format
- No fluff`;
}

// ============== Helper Functions ==============

/**
 * Formats content array for inclusion in generation prompt.
 */
function formatContentForGeneration(
	content: ExtractedContent[],
	source: "user" | "topper"
): string {
	if (content.length === 0) {
		return "";
	}

	// Sort by priority and quality
	const sorted = [...content].sort((a, b) => {
		// First by quality (high > medium > low)
		const qualityOrder = { high: 0, medium: 1, low: 2 };
		const qualityDiff = qualityOrder[a.quality] - qualityOrder[b.quality];
		if (qualityDiff !== 0) {
			return qualityDiff;
		}

		// Then by content type priority
		return (
			CONTENT_TYPE_PRIORITY[a.contentType] -
			CONTENT_TYPE_PRIORITY[b.contentType]
		);
	});

	// Group by content type
	const grouped = groupByContentType(sorted);

	const lines: string[] = [];
	for (const [type, items] of grouped) {
		lines.push(`\n### ${formatContentTypeName(type)} (${items.length})`);

		// Show more items for user content, fewer for topper
		const limit = source === "user" ? 5 : 3;
		for (const item of items.slice(0, limit)) {
			lines.push(formatSingleContent(item));
		}

		if (items.length > limit) {
			lines.push(`  ... and ${items.length - limit} more`);
		}
	}

	return lines.join("\n");
}

/**
 * Groups content by type.
 */
function groupByContentType(
	content: ExtractedContent[]
): Map<ContentType, ExtractedContent[]> {
	const grouped = new Map<ContentType, ExtractedContent[]>();

	for (const item of content) {
		const existing = grouped.get(item.contentType) || [];
		existing.push(item);
		grouped.set(item.contentType, existing);
	}

	// Sort map entries by priority
	const sortedEntries = [...grouped.entries()].sort(
		([a], [b]) => CONTENT_TYPE_PRIORITY[a] - CONTENT_TYPE_PRIORITY[b]
	);

	return new Map(sortedEntries);
}

/**
 * Formats a single content item for the prompt.
 */
function formatSingleContent(item: ExtractedContent): string {
	const flags = getContentFlags(item);
	const category =
		item.exampleCategory && item.contentType === "example"
			? ` [${item.exampleCategory}]`
			: "";

	// Truncate long content
	const maxLen = 200;
	const truncated =
		item.content.length > maxLen
			? `${item.content.slice(0, maxLen)}...`
			: item.content;

	return `- ${flags}${category} ${truncated}`;
}

/**
 * Gets display flags for content item.
 */
function getContentFlags(item: ExtractedContent): string {
	const flags: string[] = [];

	if (item.quality === "high") {
		flags.push("★");
	}
	if (item.multiUse) {
		flags.push("↔️");
	}
	if (item.isOverused) {
		flags.push("⚠️");
	}

	return flags.length > 0 ? `[${flags.join("")}]` : "";
}

/**
 * Formats content type name for display.
 */
function formatContentTypeName(type: ContentType): string {
	const names: Record<ContentType, string> = {
		introduction: "Intro Hooks",
		conclusion: "Conclusion Techniques",
		example: "Examples",
		quote: "Quotes",
		thinker: "Thinkers",
		argument: "Arguments",
		book_poem: "Books & Poems",
		keyword_phrase: "Key Phrases",
	};
	return names[type] || type;
}

/**
 * Formats theme questions for context.
 */
function formatThemeQuestions(miniTheme: MiniTheme): string {
	if (!miniTheme.questions || miniTheme.questions.length === 0) {
		return "";
	}

	const questions = miniTheme.questions
		.slice(0, 3)
		.map((q) => {
			const truncated =
				q.text.length > 60 ? `${q.text.slice(0, 60)}...` : q.text;
			return `- ${q.year}: ${truncated}`;
		})
		.join("\n");

	return `Past Questions:\n${questions}`;
}

/**
 * Identifies content with cross-theme applicability.
 */
function identifyCrossThemeContent(
	content: ExtractedContent[]
): ExtractedContent[] {
	return content.filter((c) => {
		// Content is cross-theme if:
		// 1. Explicitly marked as multi-use
		// 2. Has mappings to multiple themes (3+)
		// 3. Is a high-quality quote or argument (generally applicable)
		if (c.multiUse) {
			return true;
		}
		if (c.themes && c.themes.length >= 3) {
			return true;
		}
		if (
			c.quality === "high" &&
			(c.contentType === "quote" || c.contentType === "argument")
		) {
			return true;
		}
		return false;
	});
}

/**
 * Formats cross-theme content section for the prompt.
 */
function formatCrossThemeSection(content: ExtractedContent[]): string {
	const items = content
		.slice(0, 5)
		.map((c) => {
			const themes = formatThemeMappings(c.themes);
			return `- ${c.contentType}: ${c.content.slice(0, 80)}... ${themes}`;
		})
		.join("\n");

	return `=== CROSS-THEME CONTENT ===
The following content can be used across multiple themes:
${items}
=== END CROSS-THEME ===`;
}

/**
 * Formats theme mappings for display.
 */
function formatThemeMappings(themes: ThemeMapping[] | undefined): string {
	if (!themes || themes.length === 0) {
		return "";
	}

	const count = themes.length;
	return `(applies to ${count} theme${count > 1 ? "s" : ""})`;
}

/**
 * Creates a prompt for regenerating a specific section.
 */
export function createRegenerationPrompt(
	section: "yourNotes" | "topperInsights",
	existingContent: string,
	feedback: string,
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme }
): string {
	const sectionName =
		section === "yourNotes" ? "Your Notes" : "Topper Insights";

	return `Regenerate the ${sectionName} section based on feedback.

=== THEME ===
${theme.mainTheme.title} > ${theme.miniTheme.title}
=== END THEME ===

=== CURRENT CONTENT ===
${existingContent}
=== END CURRENT CONTENT ===

=== FEEDBACK ===
${feedback}
=== END FEEDBACK ===

Regenerate the section addressing the feedback while maintaining:
1. Bullet point format
2. Revision-ready conciseness
3. Actionable content
4. Original structure where appropriate

OUTPUT: The regenerated section content only.`;
}
