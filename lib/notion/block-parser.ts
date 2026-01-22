/**
 * Block content parser for extracting text from Notion blocks.
 * Handles various block types and rich text extraction.
 */

import type { NotionBlock, RichText } from "./types";

/**
 * Block types that contain rich_text content.
 */
const RICH_TEXT_BLOCK_TYPES = [
	"paragraph",
	"heading_1",
	"heading_2",
	"heading_3",
	"bulleted_list_item",
	"numbered_list_item",
	"toggle",
	"quote",
	"callout",
] as const;

type RichTextBlockType = (typeof RICH_TEXT_BLOCK_TYPES)[number];

/**
 * Extracts plain text from an array of rich text objects.
 * @param richText - Array of Notion rich text objects
 * @returns Combined plain text string
 */
export function extractRichText(richText: RichText[]): string {
	return richText.map((rt) => rt.plain_text).join("");
}

/**
 * Checks if a block type contains rich text content.
 */
function isRichTextBlockType(type: string): type is RichTextBlockType {
	return RICH_TEXT_BLOCK_TYPES.includes(type as RichTextBlockType);
}

/**
 * Gets the rich text content from a block based on its type.
 */
function getBlockRichText(block: NotionBlock): RichText[] | undefined {
	switch (block.type) {
		case "paragraph":
			return block.paragraph?.rich_text;
		case "heading_1":
			return block.heading_1?.rich_text;
		case "heading_2":
			return block.heading_2?.rich_text;
		case "heading_3":
			return block.heading_3?.rich_text;
		case "bulleted_list_item":
			return block.bulleted_list_item?.rich_text;
		case "numbered_list_item":
			return block.numbered_list_item?.rich_text;
		case "toggle":
			return block.toggle?.rich_text;
		case "quote":
			return block.quote?.rich_text;
		case "callout":
			return block.callout?.rich_text;
		default:
			return undefined;
	}
}

/**
 * Extracts text content from a single Notion block.
 * Handles different block types appropriately.
 *
 * @param block - The Notion block to extract text from
 * @returns The plain text content of the block
 */
export function extractBlockText(block: NotionBlock): string {
	// Handle rich text blocks
	if (isRichTextBlockType(block.type)) {
		const richText = getBlockRichText(block);
		if (richText) {
			return extractRichText(richText);
		}
		return "";
	}

	// Handle special block types
	switch (block.type) {
		case "child_page":
			return block.child_page?.title ?? "";
		case "child_database":
			return block.child_database?.title ?? "";
		case "code":
			return block.code?.rich_text ? extractRichText(block.code.rich_text) : "";
		case "divider":
		case "table_of_contents":
			// These blocks have no text content
			return "";
		default:
			return "";
	}
}

/**
 * Parses an array of Notion blocks into a single text string.
 * Useful for extracting all text content from a page.
 *
 * @param blocks - Array of Notion blocks to parse
 * @returns Combined text content with newlines between blocks
 */
export function parseBlocksToText(blocks: NotionBlock[]): string {
	return blocks
		.map((block) => extractBlockText(block))
		.filter(Boolean)
		.join("\n");
}

/**
 * Gets the heading level of a block (1, 2, 3) or null if not a heading.
 */
export function getHeadingLevel(block: NotionBlock): 1 | 2 | 3 | null {
	switch (block.type) {
		case "heading_1":
			return 1;
		case "heading_2":
			return 2;
		case "heading_3":
			return 3;
		default:
			return null;
	}
}

/**
 * Checks if a block is a toggle block that can have children.
 */
export function isToggleBlock(block: NotionBlock): boolean {
	return block.type === "toggle";
}

/**
 * Checks if a block is a list item (bulleted or numbered).
 */
export function isListItemBlock(block: NotionBlock): boolean {
	return (
		block.type === "bulleted_list_item" || block.type === "numbered_list_item"
	);
}
