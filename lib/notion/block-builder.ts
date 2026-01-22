/**
 * Notion Block Builder
 * Converts generated notes to Notion block format for API append operations.
 */

import type { GeneratedNote, NoteSection } from "@/types/generation";

/**
 * Regex for matching markdown bullet points.
 */
const BULLET_POINT_REGEX = /^[-*•]\s+(.+)$/;

/**
 * Rich text segment for Notion blocks.
 */
interface RichTextSegment {
	type: "text";
	text: {
		content: string;
		link: { url: string } | null;
	};
	annotations: {
		bold: boolean;
		italic: boolean;
		strikethrough: boolean;
		underline: boolean;
		code: boolean;
		color: "default" | string;
	};
}

/**
 * Block input type for Notion API append/create operations.
 */
interface NotionBlockInput {
	object: "block";
	type: string;
	paragraph?: { rich_text: RichTextSegment[] };
	heading_1?: { rich_text: RichTextSegment[] };
	heading_2?: { rich_text: RichTextSegment[] };
	heading_3?: { rich_text: RichTextSegment[] };
	bulleted_list_item?: { rich_text: RichTextSegment[] };
	numbered_list_item?: { rich_text: RichTextSegment[] };
	quote?: { rich_text: RichTextSegment[] };
	callout?: { rich_text: RichTextSegment[]; icon: { emoji: string } };
	divider?: Record<string, never>;
	toggle?: { rich_text: RichTextSegment[]; children?: NotionBlockInput[] };
}

/**
 * Creates a plain text rich text segment.
 */
function createText(
	content: string,
	options: {
		bold?: boolean;
		italic?: boolean;
		code?: boolean;
		strikethrough?: boolean;
		underline?: boolean;
		color?: string;
	} = {}
): RichTextSegment {
	return {
		type: "text",
		text: {
			content,
			link: null,
		},
		annotations: {
			bold: options.bold ?? false,
			italic: options.italic ?? false,
			strikethrough: options.strikethrough ?? false,
			underline: options.underline ?? false,
			code: options.code ?? false,
			color: options.color ?? "default",
		},
	};
}

/**
 * Creates a heading_2 block.
 */
function createHeading2(text: string): NotionBlockInput {
	return {
		object: "block",
		type: "heading_2",
		heading_2: {
			rich_text: [createText(text)],
		},
	};
}

/**
 * Creates a heading_3 block.
 */
function createHeading3(text: string): NotionBlockInput {
	return {
		object: "block",
		type: "heading_3",
		heading_3: {
			rich_text: [createText(text)],
		},
	};
}

/**
 * Creates a bulleted list item block.
 */
function createBulletedListItem(text: string, bold = false): NotionBlockInput {
	return {
		object: "block",
		type: "bulleted_list_item",
		bulleted_list_item: {
			rich_text: [createText(text, { bold })],
		},
	};
}

/**
 * Creates a paragraph block.
 */
function createParagraph(text: string): NotionBlockInput {
	return {
		object: "block",
		type: "paragraph",
		paragraph: {
			rich_text: text ? [createText(text)] : [],
		},
	};
}

/**
 * Creates a divider block.
 */
function createDivider(): NotionBlockInput {
	return {
		object: "block",
		type: "divider",
		divider: {},
	};
}

/**
 * Creates a quote block.
 */
function createQuote(text: string): NotionBlockInput {
	return {
		object: "block",
		type: "quote",
		quote: {
			rich_text: [createText(text)],
		},
	};
}

/**
 * Creates a callout block with an emoji icon.
 */
function createCallout(text: string, emoji: string): NotionBlockInput {
	return {
		object: "block",
		type: "callout",
		callout: {
			rich_text: [createText(text)],
			icon: { emoji },
		},
	};
}

/**
 * Creates a toggle block with children.
 */
function createToggle(
	title: string,
	children: NotionBlockInput[]
): NotionBlockInput {
	return {
		object: "block",
		type: "toggle",
		toggle: {
			rich_text: [createText(title, { bold: true })],
			children,
		},
	};
}

/**
 * Parses markdown content to extract bullet points.
 */
function parseBulletPoints(markdown: string): string[] {
	const lines = markdown.split("\n");
	const bullets: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		// Match markdown bullets (-, *, •)
		const bulletMatch = trimmed.match(BULLET_POINT_REGEX);
		if (bulletMatch) {
			bullets.push(bulletMatch[1]);
		}
	}

	return bullets;
}

/**
 * Converts a note section to Notion blocks.
 */
function sectionToBlocks(
	section: NoteSection,
	sectionTitle: string,
	emoji: string
): NotionBlockInput[] {
	const blocks: NotionBlockInput[] = [];

	// Section header as heading_3
	blocks.push(createHeading3(`${emoji} ${sectionTitle}`));

	// Parse bullets from markdown content
	const bullets = parseBulletPoints(section.content);

	if (bullets.length > 0) {
		for (const bullet of bullets) {
			// Check if it's a quote (contains quotation marks)
			if (bullet.includes('"') && bullet.includes("—")) {
				blocks.push(createQuote(bullet));
			} else {
				blocks.push(createBulletedListItem(bullet));
			}
		}
	} else {
		// Fallback: use the raw content as a paragraph
		blocks.push(createParagraph(section.content));
	}

	// Add word count as a subtle note
	blocks.push(createParagraph(`📝 ${section.wordCount} words`));

	return blocks;
}

/**
 * Converts a generated note to Notion blocks.
 * Creates the dual-section format with Your Notes + Topper Insights.
 */
export function noteToNotionBlocks(note: GeneratedNote): NotionBlockInput[] {
	const blocks: NotionBlockInput[] = [];

	// Main theme header
	blocks.push(createHeading2(`${note.mainThemeName} > ${note.miniThemeName}`));
	blocks.push(createParagraph("")); // Spacer

	// Your Notes section
	blocks.push(
		...sectionToBlocks(
			note.yourNotes,
			"Your Notes (Concise & Revision-Ready)",
			"📚"
		)
	);

	// Divider between sections
	blocks.push(createDivider());

	// Topper Insights section
	blocks.push(
		...sectionToBlocks(
			note.topperInsights,
			"Topper Insights (Enriches Your Content)",
			"✨"
		)
	);

	// Cross-theme references (if any)
	if (note.crossThemeRefs.length > 0) {
		blocks.push(createDivider());
		blocks.push(createHeading3("↔️ Cross-Theme Applicable"));

		for (const ref of note.crossThemeRefs) {
			const themeList = ref.applicableThemeNames.join(", ");
			blocks.push(
				createCallout(`${ref.content}\n\nAlso applies to: ${themeList}`, "↔️")
			);
		}
	}

	// Generation metadata
	blocks.push(createDivider());
	blocks.push(
		createParagraph(
			`Generated: ${new Date(note.generatedAt).toLocaleDateString()} | Version: ${note.version}`
		)
	);

	return blocks;
}

/**
 * Converts a generated note to a toggle block structure.
 * More compact format for pages with many notes.
 */
export function noteToNotionToggle(note: GeneratedNote): NotionBlockInput {
	const children: NotionBlockInput[] = [];

	// Your Notes section
	children.push(createHeading3("📚 Your Notes"));
	const yourNotesBullets = parseBulletPoints(note.yourNotes.content);
	for (const bullet of yourNotesBullets) {
		children.push(createBulletedListItem(bullet));
	}

	children.push(createDivider());

	// Topper Insights section
	children.push(createHeading3("✨ Topper Insights"));
	const topperBullets = parseBulletPoints(note.topperInsights.content);
	for (const bullet of topperBullets) {
		children.push(createBulletedListItem(bullet));
	}

	// Cross-theme references
	if (note.crossThemeRefs.length > 0) {
		children.push(createDivider());
		children.push(createHeading3("↔️ Cross-Theme"));
		for (const ref of note.crossThemeRefs) {
			children.push(
				createBulletedListItem(
					`${ref.content} (Also: ${ref.applicableThemeNames.join(", ")})`
				)
			);
		}
	}

	return createToggle(
		`${note.mainThemeName} > ${note.miniThemeName}`,
		children
	);
}

/**
 * Creates a summary block for a collection of notes.
 */
export function createNotesSummaryBlock(
	notes: GeneratedNote[]
): NotionBlockInput[] {
	const blocks: NotionBlockInput[] = [];

	blocks.push(createHeading2("📊 Notes Summary"));

	const totalNotes = notes.length;
	const totalWords = notes.reduce(
		(sum, n) => sum + n.yourNotes.wordCount + n.topperInsights.wordCount,
		0
	);
	const themes = new Set(notes.map((n) => n.mainThemeName)).size;

	blocks.push(
		createCallout(
			`Total Notes: ${totalNotes}\nTotal Words: ${totalWords}\nThemes Covered: ${themes}`,
			"📈"
		)
	);

	return blocks;
}

/**
 * Exports the block creation utilities for custom block building.
 */
export const blockUtils = {
	createText,
	createHeading2,
	createHeading3,
	createBulletedListItem,
	createParagraph,
	createDivider,
	createQuote,
	createCallout,
	createToggle,
	parseBulletPoints,
};

export type { NotionBlockInput, RichTextSegment };
