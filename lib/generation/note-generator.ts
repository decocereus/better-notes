/**
 * Note Generator
 * Main generation logic for creating dual-section revision notes.
 * Uses LLM with structured output to generate Your Notes + Topper Insights.
 */

import { generateObject } from "ai";
import { getModel } from "@/lib/ai/client";
import {
	createNoteGenerationPrompt,
	GENERATION_SYSTEM_PROMPT,
} from "@/lib/llm/prompts/generation";
import {
	type GeneratedNoteOutput,
	GeneratedNoteOutputSchema,
	type LLMCrossThemeRef,
	type LLMNoteItem,
} from "@/lib/llm/schemas/generation";
import type { ExtractedContent } from "@/types/extraction";
import type {
	CrossThemeRef,
	GeneratedNote,
	GenerationConfig,
	NoteItem,
	NoteSection,
} from "@/types/generation";
import type { MainTheme, MiniTheme } from "@/types/theme";

/**
 * Regex for word count calculation.
 */
const WORD_SPLIT_REGEX = /\s+/;

/**
 * Regex patterns for identifying thinker references.
 */
const THINKER_PATTERNS = [
	/gandhi/i,
	/vivekananda/i,
	/ambedkar/i,
	/aristotle/i,
	/kant/i,
	/marx/i,
];

/**
 * Regex for stripping bullet point markers.
 */
const BULLET_STRIP_REGEX = /^[-*]\s*/;

/**
 * Generates dual-section notes for a theme.
 *
 * @param mainTheme - The main theme
 * @param miniTheme - The mini theme to generate notes for
 * @param userContent - User's extracted content for this theme
 * @param topperContent - Topper's extracted content for this theme
 * @param config - Generation configuration
 * @returns Generated note with both sections
 */
export async function generateNotesForTheme(
	mainTheme: MainTheme,
	miniTheme: MiniTheme,
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[],
	config: GenerationConfig
): Promise<GeneratedNote> {
	const model = getModel("EXTRACTION"); // Using Sonnet for high-quality generation
	const prompt = createNoteGenerationPrompt(
		userContent,
		topperContent,
		{ mainTheme, miniTheme },
		config
	);

	const result = await generateObject({
		model,
		schema: GeneratedNoteOutputSchema,
		system: GENERATION_SYSTEM_PROMPT,
		prompt,
	});

	// Convert LLM output to GeneratedNote format
	return convertToGeneratedNote(
		result.object,
		mainTheme,
		miniTheme,
		userContent,
		topperContent
	);
}

/**
 * Converts LLM output to the GeneratedNote format.
 */
function convertToGeneratedNote(
	output: GeneratedNoteOutput,
	mainTheme: MainTheme,
	miniTheme: MiniTheme,
	userContent: ExtractedContent[],
	topperContent: ExtractedContent[]
): GeneratedNote {
	const yourNotes = convertToNoteSection(output.yourNotes, userContent);

	const topperInsights = convertToNoteSection(
		output.topperInsights,
		topperContent
	);

	const crossThemeRefs = convertCrossThemeRefs(output.crossThemeRefs || []);

	return {
		id: crypto.randomUUID(),
		mainThemeId: mainTheme.id,
		mainThemeName: mainTheme.title,
		miniThemeId: miniTheme.id,
		miniThemeName: miniTheme.title,
		yourNotes,
		topperInsights,
		crossThemeRefs,
		generatedAt: new Date().toISOString(),
		generationStatus: "completed",
		syncStatus: "not_synced",
		version: 1,
	};
}

/**
 * Converts LLM note section to NoteSection format.
 */
function convertToNoteSection(
	llmSection: GeneratedNoteOutput["yourNotes"],
	sourceContent: ExtractedContent[]
): NoteSection {
	const items = llmSection.items.map((item) =>
		convertToNoteItem(item, sourceContent)
	);

	return {
		content: llmSection.markdownContent,
		items,
		wordCount: llmSection.wordCount,
		itemCount: items.length,
	};
}

/**
 * Converts LLM note item to NoteItem format.
 */
function convertToNoteItem(
	llmItem: LLMNoteItem,
	sourceContent: ExtractedContent[]
): NoteItem {
	// Try to match with source content for reference
	const sourceMatch = llmItem.sourceReference
		? sourceContent.find((c) => c.id === llmItem.sourceReference)
		: undefined;

	return {
		id: crypto.randomUUID(),
		type: llmItem.type,
		content: llmItem.content,
		context: llmItem.context,
		isCrossTheme: llmItem.isCrossTheme,
		sourceContentId: sourceMatch?.id || llmItem.sourceReference,
		sourceContentType: sourceMatch?.contentType,
	};
}

/**
 * Converts LLM cross-theme refs to CrossThemeRef format.
 */
function convertCrossThemeRefs(llmRefs: LLMCrossThemeRef[]): CrossThemeRef[] {
	return llmRefs.map((ref) => ({
		content: ref.content,
		applicableThemeIds: [], // Would need theme lookup to get IDs
		applicableThemeNames: ref.applicableThemes,
	}));
}

/**
 * Calculates word count from a string.
 */
export function calculateWordCount(text: string): number {
	return text.split(WORD_SPLIT_REGEX).filter(Boolean).length;
}

/**
 * Checks if a note section exceeds word limit.
 */
export function exceedsWordLimit(section: NoteSection, limit: number): boolean {
	return section.wordCount > limit;
}

/**
 * Gets statistics about generated notes.
 */
export function getNoteStats(note: GeneratedNote): {
	totalWordCount: number;
	yourNotesWordCount: number;
	topperInsightsWordCount: number;
	yourNotesItemCount: number;
	topperInsightsItemCount: number;
	crossThemeCount: number;
	isBalanced: boolean;
} {
	const yourNotesWordCount = note.yourNotes.wordCount;
	const topperInsightsWordCount = note.topperInsights.wordCount;
	const totalWordCount = yourNotesWordCount + topperInsightsWordCount;

	// Notes are balanced if neither section is more than 2x the other
	const ratio = yourNotesWordCount / Math.max(topperInsightsWordCount, 1);
	const isBalanced = ratio >= 0.5 && ratio <= 2;

	return {
		totalWordCount,
		yourNotesWordCount,
		topperInsightsWordCount,
		yourNotesItemCount: note.yourNotes.itemCount,
		topperInsightsItemCount: note.topperInsights.itemCount,
		crossThemeCount: note.crossThemeRefs.length,
		isBalanced,
	};
}

/**
 * Validates that a generated note meets quality requirements.
 */
export function validateGeneratedNote(
	note: GeneratedNote,
	config: GenerationConfig
): { valid: boolean; issues: string[] } {
	const issues: string[] = [];

	// Check word limits
	if (note.yourNotes.wordCount > config.maxYourNotesWords * 1.1) {
		issues.push(
			`Your Notes exceeds word limit (${note.yourNotes.wordCount}/${config.maxYourNotesWords})`
		);
	}

	if (note.topperInsights.wordCount > config.maxTopperInsightsWords * 1.1) {
		issues.push(
			`Topper Insights exceeds word limit (${note.topperInsights.wordCount}/${config.maxTopperInsightsWords})`
		);
	}

	// Check minimum content
	if (note.yourNotes.itemCount < 3) {
		issues.push("Your Notes has too few items (minimum 3)");
	}

	if (note.topperInsights.itemCount < 2) {
		issues.push("Topper Insights has too few items (minimum 2)");
	}

	// Check for empty sections
	if (!note.yourNotes.content.trim()) {
		issues.push("Your Notes section is empty");
	}

	if (!note.topperInsights.content.trim()) {
		issues.push("Topper Insights section is empty");
	}

	return {
		valid: issues.length === 0,
		issues,
	};
}

/**
 * Formats a generated note as markdown for display/export.
 */
export function formatNoteAsMarkdown(note: GeneratedNote): string {
	const lines: string[] = [];

	// Header
	lines.push(`## ${note.mainThemeName} > ${note.miniThemeName}`);
	lines.push("");

	// Your Notes section
	lines.push("### Your Notes (Concise & Revision-Ready)");
	lines.push("");
	lines.push(note.yourNotes.content);
	lines.push("");

	// Divider
	lines.push("---");
	lines.push("");

	// Topper Insights section
	lines.push("### Topper Insights (Enriches Your Content)");
	lines.push("");
	lines.push(note.topperInsights.content);

	// Cross-theme references (if any)
	if (note.crossThemeRefs.length > 0) {
		lines.push("");
		lines.push("---");
		lines.push("");
		lines.push("### Cross-Theme Applicable");
		lines.push("");
		for (const ref of note.crossThemeRefs) {
			lines.push(`- ${ref.content}`);
			if (ref.applicableThemeNames.length > 0) {
				lines.push(
					`  *Also applies to: ${ref.applicableThemeNames.join(", ")}*`
				);
			}
		}
	}

	return lines.join("\n");
}

/**
 * Parses markdown content into structured items.
 * Useful for re-structuring edited markdown.
 */
export function parseMarkdownToItems(markdown: string): NoteItem[] {
	const items: NoteItem[] = [];
	const lines = markdown.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();

		// Skip empty lines and headers
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		// Parse bullet points
		if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
			const content = trimmed.replace(BULLET_STRIP_REGEX, "").trim();
			if (content) {
				items.push({
					id: crypto.randomUUID(),
					type: inferItemType(content),
					content,
				});
			}
		}
	}

	return items;
}

/**
 * Infers the type of a note item from its content.
 */
function inferItemType(content: string): NoteItem["type"] {
	const lowerContent = content.toLowerCase();

	// Check for quotes (usually in quotation marks or attributed)
	if (
		content.includes('"') ||
		content.includes("—") ||
		content.includes("said")
	) {
		return "quote";
	}

	// Check for thinker references
	for (const pattern of THINKER_PATTERNS) {
		if (pattern.test(content)) {
			return "thinker";
		}
	}

	// Check for examples (usually mention specific cases, stories, or "e.g.")
	if (
		lowerContent.includes("e.g.") ||
		lowerContent.includes("for example") ||
		lowerContent.includes("case of") ||
		lowerContent.includes("instance")
	) {
		return "example";
	}

	// Check for argument framing
	if (
		lowerContent.includes("because") ||
		lowerContent.includes("therefore") ||
		lowerContent.includes("thus") ||
		lowerContent.includes("hence")
	) {
		return "argument";
	}

	// Check for intro/conclusion patterns
	if (lowerContent.includes("hook") || lowerContent.includes("opening")) {
		return "intro_hook";
	}

	if (lowerContent.includes("conclude") || lowerContent.includes("ending")) {
		return "conclusion_technique";
	}

	// Default to key_point
	return "key_point";
}

/**
 * Merges two notes (useful for regeneration).
 */
export function mergeNotes(
	original: GeneratedNote,
	updates: Partial<GeneratedNote>
): GeneratedNote {
	return {
		...original,
		...updates,
		version: original.version + 1,
		generatedAt: new Date().toISOString(),
	};
}
