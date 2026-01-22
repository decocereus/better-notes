/**
 * Theme hierarchy types for UPSC essay preparation.
 * Structure: Main Theme → Mini Theme → Questions
 */

export interface MainTheme {
	id: string;
	title: string;
	miniThemes: MiniTheme[];
}

export interface MiniTheme {
	id: string;
	parentId: string;
	title: string;
	questions: EssayQuestion[];
}

export interface EssayQuestion {
	id: string;
	year: number;
	text: string;
	fullText: string;
}

/**
 * Parsed theme data from Notion page
 */
export interface ThemeData {
	pageId: string;
	pageTitle: string;
	themes: MainTheme[];
	parsedAt: string;
}
