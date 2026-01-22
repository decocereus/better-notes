/**
 * Cross-Theme Content Handler
 * Handles content that applies to multiple themes.
 * Maintains single source of truth while allowing content in multiple themes.
 */

import type { ExtractedContent } from "@/types/extraction";
import type { MainTheme } from "@/types/theme";

/**
 * Minimum number of themes for content to be considered cross-theme.
 */
const CROSS_THEME_THRESHOLD = 3;

/**
 * Result of cross-theme analysis.
 */
export interface CrossThemeAnalysis {
	/** Content items that appear in 3+ themes */
	crossThemeItems: ExtractedContent[];

	/** Content items in only 1-2 themes */
	singleThemeItems: ExtractedContent[];

	/** Statistics about cross-theme content */
	stats: {
		totalCrossTheme: number;
		totalSingleTheme: number;
		averageThemesPerCrossTheme: number;
		mostCrossThemeContent: ExtractedContent | null;
	};
}

/**
 * Cross-theme content reference.
 * Used when content appears in multiple themes.
 */
export interface CrossThemeRef {
	contentId: string;
	content: string;
	contentType: ExtractedContent["contentType"];
	applicableThemes: Array<{
		mainThemeId: string;
		mainThemeTitle: string;
		miniThemeId: string;
		miniThemeTitle: string;
		relevanceScore: number;
	}>;
	themeCount: number;
}

/**
 * Analyzes content for cross-theme applicability.
 *
 * @param contents - Array of classified content
 * @returns Analysis of cross-theme vs single-theme content
 */
export function analyzeCrossThemeContent(
	contents: ExtractedContent[]
): CrossThemeAnalysis {
	const crossThemeItems: ExtractedContent[] = [];
	const singleThemeItems: ExtractedContent[] = [];

	for (const content of contents) {
		if (content.themes.length >= CROSS_THEME_THRESHOLD) {
			crossThemeItems.push(content);
		} else {
			singleThemeItems.push(content);
		}
	}

	// Find the content with the most theme mappings
	let mostCrossThemeContent: ExtractedContent | null = null;
	let maxThemes = 0;

	for (const item of crossThemeItems) {
		if (item.themes.length > maxThemes) {
			maxThemes = item.themes.length;
			mostCrossThemeContent = item;
		}
	}

	// Calculate average themes for cross-theme content
	const totalThemes = crossThemeItems.reduce(
		(sum, item) => sum + item.themes.length,
		0
	);
	const averageThemes =
		crossThemeItems.length > 0 ? totalThemes / crossThemeItems.length : 0;

	return {
		crossThemeItems,
		singleThemeItems,
		stats: {
			totalCrossTheme: crossThemeItems.length,
			totalSingleTheme: singleThemeItems.length,
			averageThemesPerCrossTheme: averageThemes,
			mostCrossThemeContent,
		},
	};
}

/**
 * Finds all cross-theme content in the collection.
 *
 * @param contents - Array of classified content
 * @param minThemes - Minimum number of themes to qualify as cross-theme
 * @returns Content items with cross-theme applicability
 */
export function findCrossThemeContent(
	contents: ExtractedContent[],
	minThemes: number = CROSS_THEME_THRESHOLD
): ExtractedContent[] {
	return contents.filter((content) => content.themes.length >= minThemes);
}

/**
 * Creates cross-theme references with resolved theme names.
 *
 * @param contents - Array of classified content
 * @param themes - Theme hierarchy for name resolution
 * @returns Array of cross-theme references with theme details
 */
export function createCrossThemeRefs(
	contents: ExtractedContent[],
	themes: MainTheme[]
): CrossThemeRef[] {
	const crossThemeItems = findCrossThemeContent(contents);

	// Create theme lookup maps for efficiency
	const mainThemeMap = new Map(themes.map((t) => [t.id, t]));
	const miniThemeMap = new Map(
		themes.flatMap((t) =>
			t.miniThemes.map((m) => [m.id, { ...m, mainTheme: t }])
		)
	);

	return crossThemeItems.map((content) => {
		const applicableThemes = content.themes
			.map((mapping) => {
				const mainTheme = mainThemeMap.get(mapping.mainThemeId);
				const miniThemeData = miniThemeMap.get(mapping.miniThemeId);

				if (!(mainTheme && miniThemeData)) {
					return null;
				}

				return {
					mainThemeId: mapping.mainThemeId,
					mainThemeTitle: mainTheme.title,
					miniThemeId: mapping.miniThemeId,
					miniThemeTitle: miniThemeData.title,
					relevanceScore: mapping.relevanceScore,
				};
			})
			.filter((t): t is NonNullable<typeof t> => t !== null)
			.sort((a, b) => b.relevanceScore - a.relevanceScore);

		return {
			contentId: content.id,
			content: content.content,
			contentType: content.contentType,
			applicableThemes,
			themeCount: applicableThemes.length,
		};
	});
}

/**
 * Gets common themes between multiple content items.
 * Useful for finding related content.
 *
 * @param contents - Array of classified content
 * @returns Map of theme IDs to content items that share them
 */
export function findCommonThemes(
	contents: ExtractedContent[]
): Map<string, ExtractedContent[]> {
	const themeToContent = new Map<string, ExtractedContent[]>();

	for (const content of contents) {
		for (const mapping of content.themes) {
			const key = `${mapping.mainThemeId}:${mapping.miniThemeId}`;
			const existing = themeToContent.get(key) || [];
			existing.push(content);
			themeToContent.set(key, existing);
		}
	}

	return themeToContent;
}

/**
 * Finds content items that share themes with a specific item.
 *
 * @param content - The content to find related items for
 * @param allContents - All classified content
 * @param minSharedThemes - Minimum number of shared themes
 * @returns Related content items
 */
export function findRelatedContent(
	content: ExtractedContent,
	allContents: ExtractedContent[],
	minSharedThemes = 1
): ExtractedContent[] {
	const contentThemeKeys = new Set(
		content.themes.map((m) => `${m.mainThemeId}:${m.miniThemeId}`)
	);

	return allContents.filter((other) => {
		if (other.id === content.id) {
			return false;
		}

		const sharedCount = other.themes.filter((m) =>
			contentThemeKeys.has(`${m.mainThemeId}:${m.miniThemeId}`)
		).length;

		return sharedCount >= minSharedThemes;
	});
}

/**
 * Groups cross-theme content by the number of themes they apply to.
 *
 * @param contents - Array of classified content
 * @returns Map of theme count to content items
 */
export function groupByThemeCount(
	contents: ExtractedContent[]
): Map<number, ExtractedContent[]> {
	const grouped = new Map<number, ExtractedContent[]>();

	for (const content of contents) {
		const count = content.themes.length;
		const existing = grouped.get(count) || [];
		existing.push(content);
		grouped.set(count, existing);
	}

	return grouped;
}

/**
 * Identifies high-value cross-theme content.
 * Content that is both high quality and applicable across many themes.
 *
 * @param contents - Array of classified content
 * @returns High-value cross-theme content
 */
export function findHighValueCrossTheme(
	contents: ExtractedContent[]
): ExtractedContent[] {
	return contents.filter(
		(content) =>
			content.themes.length >= CROSS_THEME_THRESHOLD &&
			content.quality === "high" &&
			!content.isOverused
	);
}

/**
 * Updates multiUse flag based on theme classification.
 * Content with 3+ themes should have multiUse = true.
 *
 * @param contents - Array of classified content
 * @returns Updated content with multiUse flag set correctly
 */
export function updateMultiUseFlags(
	contents: ExtractedContent[]
): ExtractedContent[] {
	return contents.map((content) => ({
		...content,
		multiUse:
			content.multiUse || content.themes.length >= CROSS_THEME_THRESHOLD,
	}));
}

/**
 * Gets cross-theme statistics by content type.
 */
export function getCrossThemeStatsByType(contents: ExtractedContent[]): Map<
	ExtractedContent["contentType"],
	{
		total: number;
		crossTheme: number;
		percentage: number;
	}
> {
	const statsByType = new Map<
		ExtractedContent["contentType"],
		{ total: number; crossTheme: number; percentage: number }
	>();

	// Initialize counts
	const counts: Record<
		ExtractedContent["contentType"],
		{ total: number; crossTheme: number }
	> = {
		introduction: { total: 0, crossTheme: 0 },
		conclusion: { total: 0, crossTheme: 0 },
		example: { total: 0, crossTheme: 0 },
		quote: { total: 0, crossTheme: 0 },
		thinker: { total: 0, crossTheme: 0 },
		argument: { total: 0, crossTheme: 0 },
		book_poem: { total: 0, crossTheme: 0 },
		keyword_phrase: { total: 0, crossTheme: 0 },
	};

	for (const content of contents) {
		counts[content.contentType].total++;
		if (content.themes.length >= CROSS_THEME_THRESHOLD) {
			counts[content.contentType].crossTheme++;
		}
	}

	for (const [type, { total, crossTheme }] of Object.entries(counts)) {
		statsByType.set(type as ExtractedContent["contentType"], {
			total,
			crossTheme,
			percentage: total > 0 ? (crossTheme / total) * 100 : 0,
		});
	}

	return statsByType;
}
