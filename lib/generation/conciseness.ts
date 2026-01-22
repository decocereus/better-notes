/**
 * Conciseness Enforcer
 * Ensures generated notes stay within word limits while preserving quality.
 * Uses LLM to intelligently trim over-limit content.
 */

import { generateObject } from "ai";
import { getModel } from "@/lib/ai/client";
import { createCondensationPrompt } from "@/lib/llm/prompts/generation";
import { CondensedSectionSchema } from "@/lib/llm/schemas/generation";
import type { GeneratedNote, NoteSection } from "@/types/generation";
import type { MainTheme, MiniTheme } from "@/types/theme";

/**
 * Word limits for note sections.
 */
export const MAX_YOUR_NOTES_WORDS = 350;
export const MAX_TOPPER_INSIGHTS_WORDS = 300;

/**
 * Buffer percentage for word limits (10% over is acceptable).
 */
const WORD_LIMIT_BUFFER = 0.1;

/**
 * Regex for splitting text into words.
 */
const WHITESPACE_REGEX = /\s+/;

/**
 * System prompt for condensation.
 */
const CONDENSATION_SYSTEM_PROMPT = `You are an expert at condensing revision notes while preserving key information.

Your task is to reduce word count while maintaining:
1. The most important points and arguments
2. The best examples (keep 2-3 strongest)
3. Memorable quotes
4. Clear, scannable bullet structure

RULES:
- Merge similar points rather than deleting
- Prefer shorter phrasing over complete removal
- Keep at least 5-7 key points
- Maintain exam-ready format
- DO NOT add new content`;

/**
 * Checks if a section needs condensation.
 */
export function needsCondensation(
	section: NoteSection,
	maxWords: number
): boolean {
	const effectiveLimit = maxWords * (1 + WORD_LIMIT_BUFFER);
	return section.wordCount > effectiveLimit;
}

/**
 * Checks if a generated note has any sections that need condensation.
 */
export function noteNeedsCondensation(note: GeneratedNote): {
	yourNotes: boolean;
	topperInsights: boolean;
	any: boolean;
} {
	const yourNotes = needsCondensation(note.yourNotes, MAX_YOUR_NOTES_WORDS);
	const topperInsights = needsCondensation(
		note.topperInsights,
		MAX_TOPPER_INSIGHTS_WORDS
	);

	return {
		yourNotes,
		topperInsights,
		any: yourNotes || topperInsights,
	};
}

/**
 * Condenses a note section to fit within word limits.
 */
export async function condenseSection(
	section: NoteSection,
	sectionType: "yourNotes" | "topperInsights",
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme }
): Promise<NoteSection> {
	const maxWords =
		sectionType === "yourNotes"
			? MAX_YOUR_NOTES_WORDS
			: MAX_TOPPER_INSIGHTS_WORDS;

	// Check if condensation is needed
	if (!needsCondensation(section, maxWords)) {
		return section;
	}

	const model = getModel("EXTRACTION");
	const prompt = createCondensationPrompt(
		sectionType,
		section.content,
		section.wordCount,
		maxWords,
		theme
	);

	const result = await generateObject({
		model,
		schema: CondensedSectionSchema,
		system: CONDENSATION_SYSTEM_PROMPT,
		prompt,
	});

	// Return updated section
	return {
		content: result.object.content,
		items: section.items, // Keep original items structure (could update with removed items)
		wordCount: result.object.wordCount,
		itemCount: section.itemCount,
	};
}

/**
 * Condenses both sections of a generated note if needed.
 */
export async function enforceNoteConciseness(
	note: GeneratedNote,
	theme: { mainTheme: MainTheme; miniTheme: MiniTheme }
): Promise<GeneratedNote> {
	const status = noteNeedsCondensation(note);

	if (!status.any) {
		return note;
	}

	let updatedNote = { ...note };

	// Condense Your Notes if needed
	if (status.yourNotes) {
		const condensedYourNotes = await condenseSection(
			note.yourNotes,
			"yourNotes",
			theme
		);
		updatedNote = {
			...updatedNote,
			yourNotes: condensedYourNotes,
		};
	}

	// Condense Topper Insights if needed
	if (status.topperInsights) {
		const condensedTopperInsights = await condenseSection(
			note.topperInsights,
			"topperInsights",
			theme
		);
		updatedNote = {
			...updatedNote,
			topperInsights: condensedTopperInsights,
		};
	}

	// Update version
	return {
		...updatedNote,
		version: note.version + 1,
	};
}

/**
 * Quick word count estimation.
 */
export function estimateWordCount(text: string): number {
	return text.split(WHITESPACE_REGEX).filter(Boolean).length;
}

/**
 * Calculates how much a section is over the limit.
 */
export function getOverageInfo(
	section: NoteSection,
	maxWords: number
): {
	isOver: boolean;
	overage: number;
	overagePercent: number;
	targetReduction: number;
} {
	const effectiveLimit = maxWords * (1 + WORD_LIMIT_BUFFER);
	const isOver = section.wordCount > effectiveLimit;
	const overage = Math.max(0, section.wordCount - maxWords);
	const overagePercent = maxWords > 0 ? (overage / maxWords) * 100 : 0;
	const targetReduction = Math.max(0, section.wordCount - maxWords);

	return {
		isOver,
		overage,
		overagePercent,
		targetReduction,
	};
}

/**
 * Gets a summary of word counts and limits for a note.
 */
export function getWordCountSummary(note: GeneratedNote): {
	yourNotes: {
		current: number;
		limit: number;
		status: "ok" | "warning" | "over";
	};
	topperInsights: {
		current: number;
		limit: number;
		status: "ok" | "warning" | "over";
	};
	total: {
		current: number;
		limit: number;
	};
} {
	const getStatus = (
		current: number,
		limit: number
	): "ok" | "warning" | "over" => {
		const effectiveLimit = limit * (1 + WORD_LIMIT_BUFFER);
		if (current <= limit) {
			return "ok";
		}
		if (current <= effectiveLimit) {
			return "warning";
		}
		return "over";
	};

	return {
		yourNotes: {
			current: note.yourNotes.wordCount,
			limit: MAX_YOUR_NOTES_WORDS,
			status: getStatus(note.yourNotes.wordCount, MAX_YOUR_NOTES_WORDS),
		},
		topperInsights: {
			current: note.topperInsights.wordCount,
			limit: MAX_TOPPER_INSIGHTS_WORDS,
			status: getStatus(
				note.topperInsights.wordCount,
				MAX_TOPPER_INSIGHTS_WORDS
			),
		},
		total: {
			current: note.yourNotes.wordCount + note.topperInsights.wordCount,
			limit: MAX_YOUR_NOTES_WORDS + MAX_TOPPER_INSIGHTS_WORDS,
		},
	};
}

/**
 * Manual condensation without LLM (simple trimming).
 * Useful as a fallback or for testing.
 */
export function simpleCondense(content: string, targetWords: number): string {
	const lines = content.split("\n");
	const result: string[] = [];
	let currentWords = 0;

	for (const line of lines) {
		const lineWords = estimateWordCount(line);
		if (currentWords + lineWords <= targetWords) {
			result.push(line);
			currentWords += lineWords;
		} else if (currentWords < targetWords * 0.8) {
			// If we're still under 80% of target, include partial line
			result.push(line);
			break;
		} else {
			break;
		}
	}

	return result.join("\n");
}

/**
 * Validates that a condensed section still has minimum required content.
 */
export function validateCondensedContent(
	content: string,
	minPoints = 5
): { valid: boolean; issues: string[] } {
	const issues: string[] = [];

	// Count bullet points
	const bulletCount = (content.match(/^[-*•]\s/gm) || []).length;
	if (bulletCount < minPoints) {
		issues.push(
			`Too few points after condensation (${bulletCount}/${minPoints})`
		);
	}

	// Check if content is too short
	const wordCount = estimateWordCount(content);
	if (wordCount < 50) {
		issues.push(`Content too short after condensation (${wordCount} words)`);
	}

	// Check for empty content
	if (!content.trim()) {
		issues.push("Content is empty after condensation");
	}

	return {
		valid: issues.length === 0,
		issues,
	};
}
