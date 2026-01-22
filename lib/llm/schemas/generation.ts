/**
 * Zod Schemas for Note Generation
 * Validates LLM generation output for type safety.
 */

import { z } from "zod";

/**
 * Note item type enum matching types/generation.ts
 */
export const NoteItemTypeSchema = z.enum([
	"key_point",
	"example",
	"quote",
	"argument",
	"thinker",
	"intro_hook",
	"conclusion_technique",
]);

/**
 * Schema for a single note item.
 */
export const NoteItemSchema = z.object({
	type: NoteItemTypeSchema.describe("Type of note item"),

	content: z
		.string()
		.min(5)
		.describe("The note content (minimum 5 characters)"),

	context: z.string().optional().describe("Additional context or explanation"),

	isCrossTheme: z
		.boolean()
		.optional()
		.describe("Whether this applies to other themes"),

	sourceReference: z
		.string()
		.optional()
		.describe("Reference to source content ID"),
});

export type LLMNoteItem = z.infer<typeof NoteItemSchema>;

/**
 * Schema for a note section (Your Notes or Topper Insights).
 */
export const NoteSectionSchema = z.object({
	items: z.array(NoteItemSchema).describe("Structured note items"),

	markdownContent: z
		.string()
		.describe("Full markdown-formatted content for display"),

	wordCount: z.number().describe("Approximate word count"),
});

export type LLMNoteSection = z.infer<typeof NoteSectionSchema>;

/**
 * Schema for cross-theme reference.
 */
export const CrossThemeRefSchema = z.object({
	content: z.string().describe("The cross-applicable content"),

	applicableThemes: z
		.array(z.string())
		.min(1)
		.describe("Names of other applicable themes"),

	reason: z.string().optional().describe("Why this applies to other themes"),
});

export type LLMCrossThemeRef = z.infer<typeof CrossThemeRefSchema>;

/**
 * Schema for the complete generated note output from LLM.
 */
export const GeneratedNoteOutputSchema = z.object({
	yourNotes: NoteSectionSchema.describe("User's content section"),

	topperInsights: NoteSectionSchema.describe("Topper additions section"),

	crossThemeRefs: z
		.array(CrossThemeRefSchema)
		.optional()
		.describe("Cross-theme applicable content"),

	themeSummary: z
		.string()
		.optional()
		.describe("Brief one-line summary of the theme approach"),

	generationNotes: z
		.string()
		.optional()
		.describe("Notes about what was included/excluded"),
});

export type GeneratedNoteOutput = z.infer<typeof GeneratedNoteOutputSchema>;

/**
 * Schema for condensation/trimming output.
 */
export const CondensedSectionSchema = z.object({
	content: z.string().describe("Condensed markdown content"),

	wordCount: z.number().describe("New word count after condensation"),

	removedItems: z
		.array(z.string())
		.optional()
		.describe("Items that were removed or heavily trimmed"),
});

export type CondensedSection = z.infer<typeof CondensedSectionSchema>;

/**
 * Schema for regeneration output.
 */
export const RegeneratedSectionSchema = z.object({
	content: z.string().describe("Regenerated markdown content"),

	items: z.array(NoteItemSchema).describe("Updated structured items"),

	wordCount: z.number().describe("Word count"),

	changesApplied: z
		.array(z.string())
		.optional()
		.describe("List of changes made based on feedback"),
});

export type RegeneratedSection = z.infer<typeof RegeneratedSectionSchema>;

/**
 * Helper to validate generation output.
 */
export function validateGenerationOutput(data: unknown): {
	success: boolean;
	data?: GeneratedNoteOutput;
	error?: string;
} {
	const result = GeneratedNoteOutputSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}

/**
 * Helper to validate a note section.
 */
export function validateNoteSection(data: unknown): {
	success: boolean;
	data?: LLMNoteSection;
	error?: string;
} {
	const result = NoteSectionSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}

/**
 * Helper to validate condensed output.
 */
export function validateCondensedSection(data: unknown): {
	success: boolean;
	data?: CondensedSection;
	error?: string;
} {
	const result = CondensedSectionSchema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error.message };
}
