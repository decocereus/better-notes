/**
 * Content Aggregator
 * Aggregates all classified content per theme for easy access and analysis.
 */

import type {
	ContentQuality,
	ContentSourceType,
	ContentType,
	ExtractedContent,
} from "@/types/extraction";
import type { MainTheme, MiniTheme } from "@/types/theme";

/**
 * Aggregated content for a specific mini-theme.
 */
export interface ThemeContent {
	/** Main theme ID */
	mainThemeId: string;
	/** Main theme title */
	mainThemeName: string;
	/** Mini theme ID */
	miniThemeId: string;
	/** Mini theme title */
	miniThemeName: string;

	/** Content grouped by type */
	content: {
		introductions: ExtractedContent[];
		conclusions: ExtractedContent[];
		examples: ExtractedContent[];
		quotes: ExtractedContent[];
		thinkers: ExtractedContent[];
		arguments: ExtractedContent[];
		booksPoems: ExtractedContent[];
		keywords: ExtractedContent[];
	};

	/** Statistics */
	stats: {
		total: number;
		bySource: Record<ContentSourceType, number>;
		byQuality: Record<ContentQuality, number>;
		overusedCount: number;
		multiUseCount: number;
		averageRelevance: number;
	};
}

/**
 * Summary of content across all themes.
 */
export interface AggregationSummary {
	/** Total themes with content */
	themesWithContent: number;
	/** Total content items */
	totalContent: number;
	/** Content distribution by type */
	byType: Record<ContentType, number>;
	/** Content distribution by source */
	bySource: Record<ContentSourceType, number>;
	/** Themes sorted by content count */
	themesByContentCount: Array<{
		mainThemeId: string;
		miniThemeId: string;
		themeName: string;
		count: number;
	}>;
}

/**
 * Aggregates content by theme.
 *
 * @param contents - Array of classified content
 * @param themes - Theme hierarchy
 * @returns Array of ThemeContent for each mini-theme with content
 */
export function aggregateContentByTheme(
	contents: ExtractedContent[],
	themes: MainTheme[]
): ThemeContent[] {
	// Build a map of theme ID to theme info for quick lookup
	const themeInfoMap = buildThemeInfoMap(themes);

	// Group content by mini-theme
	const contentByMiniTheme = new Map<string, ExtractedContent[]>();

	for (const content of contents) {
		for (const mapping of content.themes) {
			const key = mapping.miniThemeId;
			const existing = contentByMiniTheme.get(key) || [];
			existing.push(content);
			contentByMiniTheme.set(key, existing);
		}
	}

	// Build ThemeContent for each mini-theme
	const result: ThemeContent[] = [];

	for (const [miniThemeId, themeContents] of contentByMiniTheme) {
		const info = themeInfoMap.get(miniThemeId);
		if (!info) {
			continue;
		}

		const themeContent = buildThemeContent(
			info.mainTheme,
			info.miniTheme,
			themeContents,
			miniThemeId
		);

		result.push(themeContent);
	}

	// Sort by total content count (descending)
	return result.sort((a, b) => b.stats.total - a.stats.total);
}

/**
 * Builds theme info map for quick lookup.
 */
function buildThemeInfoMap(
	themes: MainTheme[]
): Map<string, { mainTheme: MainTheme; miniTheme: MiniTheme }> {
	const map = new Map<string, { mainTheme: MainTheme; miniTheme: MiniTheme }>();

	for (const mainTheme of themes) {
		for (const miniTheme of mainTheme.miniThemes) {
			map.set(miniTheme.id, { mainTheme, miniTheme });
		}
	}

	return map;
}

/**
 * Builds ThemeContent for a specific mini-theme.
 */
function buildThemeContent(
	mainTheme: MainTheme,
	miniTheme: MiniTheme,
	contents: ExtractedContent[],
	miniThemeId: string
): ThemeContent {
	// Group content by type
	const grouped = groupContentByType(contents);

	// Calculate statistics
	const stats = calculateThemeStats(contents, miniThemeId);

	return {
		mainThemeId: mainTheme.id,
		mainThemeName: mainTheme.title,
		miniThemeId: miniTheme.id,
		miniThemeName: miniTheme.title,
		content: grouped,
		stats,
	};
}

/**
 * Groups content by type.
 */
function groupContentByType(
	contents: ExtractedContent[]
): ThemeContent["content"] {
	const grouped: ThemeContent["content"] = {
		introductions: [],
		conclusions: [],
		examples: [],
		quotes: [],
		thinkers: [],
		arguments: [],
		booksPoems: [],
		keywords: [],
	};

	for (const content of contents) {
		switch (content.contentType) {
			case "introduction":
				grouped.introductions.push(content);
				break;
			case "conclusion":
				grouped.conclusions.push(content);
				break;
			case "example":
				grouped.examples.push(content);
				break;
			case "quote":
				grouped.quotes.push(content);
				break;
			case "thinker":
				grouped.thinkers.push(content);
				break;
			case "argument":
				grouped.arguments.push(content);
				break;
			case "book_poem":
				grouped.booksPoems.push(content);
				break;
			case "keyword_phrase":
				grouped.keywords.push(content);
				break;
			default:
				// Unknown content type, skip
				break;
		}
	}

	return grouped;
}

/**
 * Calculates statistics for a theme's content.
 */
function calculateThemeStats(
	contents: ExtractedContent[],
	miniThemeId: string
): ThemeContent["stats"] {
	const bySource: Record<ContentSourceType, number> = {
		topper: 0,
		user: 0,
	};

	const byQuality: Record<ContentQuality, number> = {
		high: 0,
		medium: 0,
		low: 0,
	};

	let overusedCount = 0;
	let multiUseCount = 0;
	let totalRelevance = 0;

	for (const content of contents) {
		bySource[content.sourceType]++;
		byQuality[content.quality]++;

		if (content.isOverused) {
			overusedCount++;
		}

		if (content.multiUse) {
			multiUseCount++;
		}

		// Get relevance score for this specific theme
		const mapping = content.themes.find((m) => m.miniThemeId === miniThemeId);
		if (mapping) {
			totalRelevance += mapping.relevanceScore;
		}
	}

	return {
		total: contents.length,
		bySource,
		byQuality,
		overusedCount,
		multiUseCount,
		averageRelevance:
			contents.length > 0 ? totalRelevance / contents.length : 0,
	};
}

/**
 * Gets aggregation summary across all themes.
 *
 * @param themeContents - Array of aggregated theme content
 * @returns Summary statistics
 */
export function getAggregationSummary(
	themeContents: ThemeContent[]
): AggregationSummary {
	let totalContent = 0;
	const byType: Record<ContentType, number> = {
		introduction: 0,
		conclusion: 0,
		example: 0,
		quote: 0,
		thinker: 0,
		argument: 0,
		book_poem: 0,
		keyword_phrase: 0,
	};
	const bySource: Record<ContentSourceType, number> = {
		topper: 0,
		user: 0,
	};

	const themesByContentCount: AggregationSummary["themesByContentCount"] = [];

	// Track unique content IDs to avoid double-counting
	const seenContentIds = new Set<string>();

	for (const theme of themeContents) {
		themesByContentCount.push({
			mainThemeId: theme.mainThemeId,
			miniThemeId: theme.miniThemeId,
			themeName: `${theme.mainThemeName} > ${theme.miniThemeName}`,
			count: theme.stats.total,
		});

		// Process each content item (only count once per unique item)
		const allItems = [
			...theme.content.introductions,
			...theme.content.conclusions,
			...theme.content.examples,
			...theme.content.quotes,
			...theme.content.thinkers,
			...theme.content.arguments,
			...theme.content.booksPoems,
			...theme.content.keywords,
		];

		for (const item of allItems) {
			if (!seenContentIds.has(item.id)) {
				seenContentIds.add(item.id);
				totalContent++;
				byType[item.contentType]++;
				bySource[item.sourceType]++;
			}
		}
	}

	// Sort themes by content count
	themesByContentCount.sort((a, b) => b.count - a.count);

	return {
		themesWithContent: themeContents.length,
		totalContent,
		byType,
		bySource,
		themesByContentCount,
	};
}

/**
 * Gets content for a specific theme.
 *
 * @param contents - Array of classified content
 * @param mainThemeId - Main theme ID
 * @param miniThemeId - Mini theme ID
 * @param themes - Theme hierarchy for names
 * @returns ThemeContent or null if not found
 */
export function getThemeContent(
	contents: ExtractedContent[],
	mainThemeId: string,
	miniThemeId: string,
	themes: MainTheme[]
): ThemeContent | null {
	// Find the theme info
	const mainTheme = themes.find((t) => t.id === mainThemeId);
	if (!mainTheme) {
		return null;
	}

	const miniTheme = mainTheme.miniThemes.find((m) => m.id === miniThemeId);
	if (!miniTheme) {
		return null;
	}

	// Filter content for this theme
	const themeContents = contents.filter((content) =>
		content.themes.some(
			(m) => m.mainThemeId === mainThemeId && m.miniThemeId === miniThemeId
		)
	);

	if (themeContents.length === 0) {
		return null;
	}

	return buildThemeContent(mainTheme, miniTheme, themeContents, miniThemeId);
}

/**
 * Finds themes with insufficient content coverage.
 *
 * @param contents - Array of classified content
 * @param themes - Theme hierarchy
 * @param minContent - Minimum content items per theme
 * @returns Themes with less than minimum content
 */
export function findUndercoveredThemes(
	contents: ExtractedContent[],
	themes: MainTheme[],
	minContent = 3
): Array<{ mainTheme: MainTheme; miniTheme: MiniTheme; contentCount: number }> {
	const aggregated = aggregateContentByTheme(contents, themes);

	const undercovered: Array<{
		mainTheme: MainTheme;
		miniTheme: MiniTheme;
		contentCount: number;
	}> = [];

	for (const mainTheme of themes) {
		for (const miniTheme of mainTheme.miniThemes) {
			const themeContent = aggregated.find(
				(a) => a.miniThemeId === miniTheme.id
			);
			const count = themeContent?.stats.total || 0;

			if (count < minContent) {
				undercovered.push({
					mainTheme,
					miniTheme,
					contentCount: count,
				});
			}
		}
	}

	// Sort by content count (ascending - most undercovered first)
	return undercovered.sort((a, b) => a.contentCount - b.contentCount);
}

/**
 * Gets unique content items (removing duplicates from cross-theme content).
 *
 * @param themeContent - Aggregated theme content
 * @returns Array of unique content items
 */
export function getUniqueContent(
	themeContent: ThemeContent
): ExtractedContent[] {
	const seen = new Set<string>();
	const unique: ExtractedContent[] = [];

	const allItems = [
		...themeContent.content.introductions,
		...themeContent.content.conclusions,
		...themeContent.content.examples,
		...themeContent.content.quotes,
		...themeContent.content.thinkers,
		...themeContent.content.arguments,
		...themeContent.content.booksPoems,
		...themeContent.content.keywords,
	];

	for (const item of allItems) {
		if (!seen.has(item.id)) {
			seen.add(item.id);
			unique.push(item);
		}
	}

	return unique;
}

/**
 * Compares content between topper and user sources for a theme.
 */
export function compareSourcesForTheme(themeContent: ThemeContent): {
	topperOnly: ExtractedContent[];
	userOnly: ExtractedContent[];
	both: ExtractedContent[];
	topperAdvantage: Record<ContentType, number>;
} {
	const allItems = getUniqueContent(themeContent);

	const topperOnly = allItems.filter((item) => item.sourceType === "topper");
	const userOnly = allItems.filter((item) => item.sourceType === "user");

	// Calculate advantage by type
	const topperByType = groupByType(topperOnly);
	const userByType = groupByType(userOnly);

	const topperAdvantage: Record<ContentType, number> = {
		introduction: 0,
		conclusion: 0,
		example: 0,
		quote: 0,
		thinker: 0,
		argument: 0,
		book_poem: 0,
		keyword_phrase: 0,
	};

	for (const type of Object.keys(topperAdvantage) as ContentType[]) {
		const topperCount = topperByType[type]?.length || 0;
		const userCount = userByType[type]?.length || 0;
		topperAdvantage[type] = topperCount - userCount;
	}

	return {
		topperOnly,
		userOnly,
		both: [], // Content from both sources would need matching logic
		topperAdvantage,
	};
}

/**
 * Groups content by type.
 */
function groupByType(
	contents: ExtractedContent[]
): Record<ContentType, ExtractedContent[]> {
	const grouped: Record<ContentType, ExtractedContent[]> = {
		introduction: [],
		conclusion: [],
		example: [],
		quote: [],
		thinker: [],
		argument: [],
		book_poem: [],
		keyword_phrase: [],
	};

	for (const content of contents) {
		grouped[content.contentType].push(content);
	}

	return grouped;
}
