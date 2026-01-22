/**
 * Theme parser for extracting essay themes from Notion pages.
 * Parses hierarchical structure: Main Theme → Mini Theme → Questions
 */

import { createLogger } from "@/lib/utils/logger";
import type { EssayQuestion, MainTheme, MiniTheme, ThemeData } from "@/types";
import {
	extractBlockText,
	getHeadingLevel,
	isListItemBlock,
	isToggleBlock,
} from "./block-parser";
import type { NotionClient } from "./client";
import type { NotionBlock, NotionPage } from "./types";

const log = createLogger("theme-parser");

/**
 * Regex pattern for extracting year from question text.
 * Matches "YYYY: question text" format.
 */
const QUESTION_YEAR_PATTERN = /^(\d{4}):\s*(.+)$/;

const GENERAL_QUESTIONS_TITLE = "General Questions";
const MIN_VALID_YEAR = 1922; // UPSC started in 1922

/**
 * Parses a question from text in the format "YYYY: Question text".
 * @param text - The raw text to parse
 * @returns EssayQuestion object or null if format doesn't match
 */
export function parseQuestion(text: string): EssayQuestion | null {
	const trimmedText = text.trim();
	const match = trimmedText.match(QUESTION_YEAR_PATTERN);

	if (!match) {
		return null;
	}

	const [, yearStr, questionText] = match;
	const year = Number.parseInt(yearStr, 10);
	const maxValidYear = new Date().getFullYear() + 1;

	if (year < MIN_VALID_YEAR || year > maxValidYear) {
		return null;
	}

	return {
		id: crypto.randomUUID(),
		year,
		text: questionText.trim(),
		fullText: trimmedText,
	};
}

/**
 * Extracts questions from an array of blocks.
 * Questions are typically bullet points with "YYYY: text" format.
 */
function extractQuestionsFromBlocks(blocks: NotionBlock[]): EssayQuestion[] {
	const questions: EssayQuestion[] = [];

	for (const block of blocks) {
		if (isListItemBlock(block)) {
			const text = extractBlockText(block);
			const question = parseQuestion(text);
			if (question) {
				questions.push(question);
			}
		}
	}

	return questions;
}

/**
 * Checks if a block starts a new mini theme.
 * Supports: toggle blocks, h2/h3 headings, or bulleted_list_items with children.
 */
function isMiniThemeBlock(block: NotionBlock): boolean {
	const headingLevel = getHeadingLevel(block);

	// Toggle or h2/h3 heading
	if (isToggleBlock(block) || headingLevel === 2 || headingLevel === 3) {
		return true;
	}

	// Bulleted list item with children (nested content)
	if (block.type === "bulleted_list_item" && block.has_children) {
		return true;
	}

	return false;
}

/**
 * Creates a new MiniTheme from a block.
 */
function createMiniTheme(block: NotionBlock, parentId: string): MiniTheme {
	return {
		id: block.id,
		parentId,
		title: extractBlockText(block),
		questions: [],
	};
}

/**
 * Gets or creates the "General Questions" mini theme for orphan questions.
 */
function getOrCreateGeneralTheme(
	miniThemes: MiniTheme[],
	parentId: string
): MiniTheme {
	let generalTheme = miniThemes.find(
		(mt) => mt.title === GENERAL_QUESTIONS_TITLE
	);

	if (!generalTheme) {
		generalTheme = {
			id: crypto.randomUUID(),
			parentId,
			title: GENERAL_QUESTIONS_TITLE,
			questions: [],
		};
		miniThemes.push(generalTheme);
	}

	return generalTheme;
}

/**
 * Handles a block that starts a new mini theme.
 */
async function handleNewMiniTheme(
	block: NotionBlock,
	parentId: string,
	miniThemes: MiniTheme[],
	client: NotionClient
): Promise<MiniTheme> {
	const miniTheme = createMiniTheme(block, parentId);
	miniThemes.push(miniTheme);

	// If it's a collapsible block with children (toggle or bulleted list), fetch and parse them
	const isCollapsible =
		isToggleBlock(block) || block.type === "bulleted_list_item";

	if (isCollapsible && block.has_children) {
		log.debug(
			`Fetching children for mini theme "${miniTheme.title.slice(0, 30)}"`
		);
		const children = await client.getBlockChildren(block.id);
		log.debug(
			`Mini theme "${miniTheme.title.slice(0, 30)}" has ${children.length} children`
		);
		miniTheme.questions = extractQuestionsFromBlocks(children);
		log.debug(
			`Extracted ${miniTheme.questions.length} questions from mini theme "${miniTheme.title.slice(0, 30)}"`
		);
	}

	return miniTheme;
}

/**
 * Handles a question block that should be added to a mini theme.
 */
function handleQuestionBlock(
	block: NotionBlock,
	currentMiniTheme: MiniTheme | null,
	miniThemes: MiniTheme[],
	parentId: string
): void {
	const text = extractBlockText(block);
	const question = parseQuestion(text);

	if (!question) {
		return;
	}

	if (currentMiniTheme) {
		currentMiniTheme.questions.push(question);
	} else {
		// Orphan question - add to "General Questions"
		const generalTheme = getOrCreateGeneralTheme(miniThemes, parentId);
		generalTheme.questions.push(question);
	}
}

/**
 * Parses mini themes from child blocks of a main theme.
 * Mini themes can be toggles or h2/h3 headings.
 */
async function parseMiniThemes(
	blocks: NotionBlock[],
	client: NotionClient,
	parentId: string
): Promise<MiniTheme[]> {
	const miniThemes: MiniTheme[] = [];
	let currentMiniTheme: MiniTheme | null = null;

	for (const block of blocks) {
		const text = extractBlockText(block);

		if (isMiniThemeBlock(block) && text) {
			currentMiniTheme = await handleNewMiniTheme(
				block,
				parentId,
				miniThemes,
				client
			);
		} else if (isListItemBlock(block)) {
			handleQuestionBlock(block, currentMiniTheme, miniThemes, parentId);
		}
	}

	return miniThemes;
}

/**
 * Checks if a block starts a new main theme.
 * Supports: toggle blocks, h1 headings, or bulleted_list_items with children.
 */
function isMainThemeBlock(block: NotionBlock): boolean {
	const headingLevel = getHeadingLevel(block);

	// Toggle or h1 heading
	if (isToggleBlock(block) || headingLevel === 1) {
		return true;
	}

	// Bulleted list item with children (common Notion pattern for collapsible sections)
	if (block.type === "bulleted_list_item" && block.has_children) {
		return true;
	}

	return false;
}

/**
 * Creates a new MainTheme from a block.
 */
function createMainTheme(block: NotionBlock): MainTheme {
	return {
		id: block.id,
		title: extractBlockText(block),
		miniThemes: [],
	};
}

/**
 * Processes pending blocks and adds them as mini themes to the current main theme.
 */
async function processPendingBlocks(
	pendingBlocks: NotionBlock[],
	currentMainTheme: MainTheme,
	client: NotionClient
): Promise<void> {
	if (pendingBlocks.length === 0) {
		return;
	}

	const additionalMiniThemes = await parseMiniThemes(
		pendingBlocks,
		client,
		currentMainTheme.id
	);
	currentMainTheme.miniThemes.push(...additionalMiniThemes);
}

/**
 * Handles a block that starts a new main theme.
 */
async function handleNewMainTheme(
	block: NotionBlock,
	themes: MainTheme[],
	client: NotionClient
): Promise<MainTheme> {
	const mainTheme = createMainTheme(block);
	themes.push(mainTheme);

	// If it's a collapsible block with children (toggle or bulleted list), parse children as mini themes
	const isCollapsible =
		isToggleBlock(block) || block.type === "bulleted_list_item";

	if (isCollapsible && block.has_children) {
		log.debug(
			`Fetching children for main theme "${mainTheme.title.slice(0, 30)}"`
		);
		const children = await client.getBlockChildren(block.id);
		log.debug(
			`Main theme "${mainTheme.title.slice(0, 30)}" has ${children.length} children`
		);
		mainTheme.miniThemes = await parseMiniThemes(
			children,
			client,
			mainTheme.id
		);
	}

	return mainTheme;
}

/**
 * Parses main themes from the top-level blocks of a theme page.
 * Main themes can be toggles or h1 headings.
 */
async function parseMainThemes(
	blocks: NotionBlock[],
	client: NotionClient
): Promise<MainTheme[]> {
	log.debug(`parseMainThemes: Processing ${blocks.length} blocks`);
	const themes: MainTheme[] = [];
	let currentMainTheme: MainTheme | null = null;
	const pendingBlocks: NotionBlock[] = [];

	for (const block of blocks) {
		const text = extractBlockText(block);
		const headingLevel = getHeadingLevel(block);
		const isToggle = isToggleBlock(block);
		const isMain = isMainThemeBlock(block);

		log.debug(
			`Block: type=${block.type}, isToggle=${isToggle}, headingLevel=${headingLevel}, isMainTheme=${isMain}, text="${text.slice(0, 40)}"`
		);

		if (isMain && text) {
			// Process pending blocks for previous theme
			if (currentMainTheme) {
				await processPendingBlocks(pendingBlocks, currentMainTheme, client);
				pendingBlocks.length = 0;
			}

			log.info(`Found main theme: "${text.slice(0, 50)}"`);
			currentMainTheme = await handleNewMainTheme(block, themes, client);
		} else if (currentMainTheme) {
			pendingBlocks.push(block);
		} else {
			log.debug(
				`Skipping block (no current main theme): type=${block.type}, text="${text.slice(0, 40)}"`
			);
		}
	}

	// Process any remaining pending blocks
	if (currentMainTheme) {
		await processPendingBlocks(pendingBlocks, currentMainTheme, client);
	}

	log.debug(`parseMainThemes: Found ${themes.length} main themes`);
	return themes;
}

/**
 * Extracts the title from a Notion page.
 */
function extractPageTitle(page: NotionPage): string {
	const titleProp = Object.values(page.properties).find(
		(prop) => prop.type === "title"
	);

	if (titleProp?.title?.[0]?.plain_text) {
		return titleProp.title[0].plain_text;
	}

	return "Untitled";
}

/**
 * Parses an entire Notion theme page into structured theme data.
 *
 * @param client - Notion API client
 * @param pageId - The page ID to parse
 * @returns Parsed theme data with hierarchy
 */
export async function parseThemePage(
	client: NotionClient,
	pageId: string
): Promise<ThemeData> {
	log.info(`Starting theme page parse for pageId: ${pageId}`);

	// Fetch page metadata
	const page = await client.getPage(pageId);
	const pageTitle = extractPageTitle(page);
	log.info(`Page title: "${pageTitle}"`);

	// Fetch all top-level blocks
	const blocks = await client.getPageContent(pageId);
	log.info(`Fetched ${blocks.length} top-level blocks`);

	// Log block types for debugging
	const blockTypeCounts: Record<string, number> = {};
	for (const block of blocks) {
		blockTypeCounts[block.type] = (blockTypeCounts[block.type] || 0) + 1;
	}
	log.debug("Block type distribution:", blockTypeCounts);

	// Log first few blocks for debugging
	if (blocks.length > 0) {
		log.debug(
			"First 5 blocks:",
			blocks.slice(0, 5).map((b) => ({
				id: b.id.slice(0, 8),
				type: b.type,
				hasChildren: b.has_children,
				text: extractBlockText(b).slice(0, 50),
			}))
		);
	}

	// Parse themes from blocks
	const themes = await parseMainThemes(blocks, client);

	log.info(
		`Parsing complete: ${themes.length} main themes, ` +
			`${themes.reduce((acc, t) => acc + t.miniThemes.length, 0)} mini themes, ` +
			`${themes.reduce((acc, t) => acc + t.miniThemes.reduce((a, m) => a + m.questions.length, 0), 0)} questions`
	);

	return {
		pageId,
		pageTitle,
		themes,
		parsedAt: new Date().toISOString(),
	};
}

/**
 * Calculates statistics about the parsed themes.
 */
export function getThemeStats(themes: MainTheme[]): {
	totalMainThemes: number;
	totalMiniThemes: number;
	totalQuestions: number;
	yearsRange: { min: number; max: number } | null;
} {
	let totalMiniThemes = 0;
	let totalQuestions = 0;
	let minYear = Number.POSITIVE_INFINITY;
	let maxYear = Number.NEGATIVE_INFINITY;

	for (const mainTheme of themes) {
		totalMiniThemes += mainTheme.miniThemes.length;

		for (const miniTheme of mainTheme.miniThemes) {
			totalQuestions += miniTheme.questions.length;

			for (const question of miniTheme.questions) {
				if (question.year < minYear) {
					minYear = question.year;
				}
				if (question.year > maxYear) {
					maxYear = question.year;
				}
			}
		}
	}

	return {
		totalMainThemes: themes.length,
		totalMiniThemes,
		totalQuestions,
		yearsRange: minYear <= maxYear ? { min: minYear, max: maxYear } : null,
	};
}
