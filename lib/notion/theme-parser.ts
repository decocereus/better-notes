/**
 * Theme parser for extracting essay themes from Notion pages.
 * Parses hierarchical structure: Main Theme → Mini Theme → Questions
 */

import type { EssayQuestion, MainTheme, MiniTheme, ThemeData } from "@/types";
import {
	extractBlockText,
	getHeadingLevel,
	isListItemBlock,
	isToggleBlock,
} from "./block-parser";
import type { NotionClient } from "./client";
import type { NotionBlock, NotionPage } from "./types";

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
 * Checks if a block starts a new mini theme (toggle, h2, or h3).
 */
function isMiniThemeBlock(block: NotionBlock): boolean {
	const headingLevel = getHeadingLevel(block);
	return isToggleBlock(block) || headingLevel === 2 || headingLevel === 3;
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

	// If it's a toggle with children, fetch and parse them
	if (isToggleBlock(block) && block.has_children) {
		const children = await client.getBlockChildren(block.id);
		miniTheme.questions = extractQuestionsFromBlocks(children);
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
 * Checks if a block starts a new main theme (toggle or h1).
 */
function isMainThemeBlock(block: NotionBlock): boolean {
	const headingLevel = getHeadingLevel(block);
	return isToggleBlock(block) || headingLevel === 1;
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

	// If it's a toggle with children, parse them as mini themes
	if (isToggleBlock(block) && block.has_children) {
		const children = await client.getBlockChildren(block.id);
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
	const themes: MainTheme[] = [];
	let currentMainTheme: MainTheme | null = null;
	const pendingBlocks: NotionBlock[] = [];

	for (const block of blocks) {
		const text = extractBlockText(block);

		if (isMainThemeBlock(block) && text) {
			// Process pending blocks for previous theme
			if (currentMainTheme) {
				await processPendingBlocks(pendingBlocks, currentMainTheme, client);
				pendingBlocks.length = 0;
			}

			currentMainTheme = await handleNewMainTheme(block, themes, client);
		} else if (currentMainTheme) {
			pendingBlocks.push(block);
		}
	}

	// Process any remaining pending blocks
	if (currentMainTheme) {
		await processPendingBlocks(pendingBlocks, currentMainTheme, client);
	}

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
	// Fetch page metadata
	const page = await client.getPage(pageId);
	const pageTitle = extractPageTitle(page);

	// Fetch all top-level blocks
	const blocks = await client.getPageContent(pageId);

	// Parse themes from blocks
	const themes = await parseMainThemes(blocks, client);

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
