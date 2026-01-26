/**
 * Content Extractor
 * Main extraction logic for pulling structured content from UPSC topper essays.
 * Uses LLM with structured output to extract intros, examples, quotes, etc.
 */

import { generateObject, generateText } from "ai";
import { getModel } from "@/lib/ai/client";
import {
	createExtractionPrompt,
	EXTRACTION_SYSTEM_PROMPT,
} from "@/lib/llm/prompts/extraction";
import {
	type ExtractedItem,
	ExtractionResultSchema,
} from "@/lib/llm/schemas/extraction";
import type {
	ContentType,
	EssayExtractionResult,
	ExtractedContent,
	ExtractionParameters,
	ExtractionSection,
} from "@/types/extraction";
import {
	assessMultiUse,
	calculateQuality,
	filterByQuality,
	isOverusedExample,
} from "./quality";

/**
 * Regex for splitting text into words.
 */
const WORD_SPLIT_REGEX = /\s+/;
const EXTRACTION_JSON_INSTRUCTIONS = `Return ONLY valid JSON. CRITICAL FIELD RULES:

- "content": Short headline (5-15 words) describing WHAT the item IS
  CORRECT: "Technology-policy lag as governance challenge"
  WRONG: "detailsMarkdown" or "Works for any essay"

- "verbatimText": EXACT quote from essay text (copy-paste, no paraphrasing)
  CORRECT: "In the 19th century, a policy lasted for decades..."
  WRONG: "" or paraphrased version

- "detailsMarkdown": Usage guidance - WHY it works, WHEN to use, WHAT it pairs with
  CORRECT: "**Why it works:** Concrete contrast...\\n**Use for:** Tech governance..."

JSON shape:
{
  "items": [
    {
      "contentType": "introduction|conclusion|example|quote|thinker|argument|book_poem|keyword_phrase",
      "exampleCategory": "individual|ethical|governance|societal|environment|mythological|sports|religion|business|international_relations|science_tech",
      "content": "5-15 word headline of what this IS",
      "verbatimText": "EXACT quote from essay - copy paste",
      "context": "optional situational note",
      "detailsMarkdown": "**Why it works:** ...\\n**Use for:** ...\\n**Pairs with:** ...",
      "quality": "high|medium|low",
      "isOverused": false,
      "multiUse": true,
      "sourcePageStart": 1,
      "sourcePageEnd": 2,
      "attribution": { "name": "...", "role": "...", "work": "...", "year": "..." }
    }
  ],
  "sections": [
    { "type": "introduction", "markdown": "- bullet summary", "itemCount": 0 }
  ],
  "essayTitle": "optional",
  "overallQuality": "high|medium|low",
  "totalItemsExtracted": 0,
  "extractionNotes": "optional",
  "summary": { "introductions": 0, "conclusions": 0, "examples": 0, "quotes": 0, "thinkers": 0, "arguments": 0, "booksPoems": 0, "keywords": 0 }
}
No markdown fences, no extra text.`;

const SECTION_TO_CONTENT_TYPE: [RegExp, ContentType][] = [
	[/\bintroductions?\b/i, "introduction"],
	[/\bconclusions?\b/i, "conclusion"],
	[/\bexamples?\b/i, "example"],
	[/\bquotes?\b/i, "quote"],
	[/\bthinkers?\b/i, "thinker"],
	[/\barguments?\b/i, "argument"],
	[/\bbooks?\s*&\s*poems?\b|\bbooks?\b|\bpoems?\b/i, "book_poem"],
	[/\bkeywords?\b|\bphrases?\b/i, "keyword_phrase"],
];

const EXAMPLE_CATEGORY_MAP: [RegExp, ExtractedItem["exampleCategory"]][] = [
	[/\bindividual\b/i, "individual"],
	[/\bethical\b/i, "ethical"],
	[/\bgovernance\b/i, "governance"],
	[/\bsocietal\b/i, "societal"],
	[/\benvironment\b/i, "environment"],
	[/\bmytholog/i, "mythological"],
	[/\bsports?\b/i, "sports"],
	[/\breligion\b/i, "religion"],
	[/\bbusiness\b/i, "business"],
	[
		/\binternational\s+relations\b|\binternational\b/i,
		"international_relations",
	],
	[/\bscience\b|\btech\b|\btechnology\b/i, "science_tech"],
];

const QUALITY_SCORE: Record<ExtractedContent["quality"], number> = {
	high: 3,
	medium: 2,
	low: 1,
};

const HEADING_REGEX = /^#{1,6}\s+/;
const QUALITY_ONLY_REGEX = /^(high|medium|low)(\s+quality)?$/i;
const METADATA_REGEX = /\bquality\b|\bmulti[-\s]?use\b/i;
const CONTEXT_REGEX =
	/^(context|use|uses|usable|applicable|adaptable|can be applied|multi[-\s]?use)\b/i;

// Regex patterns for quality and multi-use detection
const HIGH_QUALITY_REGEX = /high/i;
const LOW_QUALITY_REGEX = /low/i;
const QUALITY_KEYWORD_REGEX = /quality/i;
const MULTI_USE_REGEX = /multi[-\s]?use/i;
const MULTI_USE_YES_REGEX = /yes|high|multi[-\s]?use/i;
const CONTEXT_PREFIX_REGEX = /^context[:\s]/i;
const CONTEXT_REPLACE_REGEX = /^context[:\s]*/i;
const MULTI_USE_APPLICABLE_REGEX =
	/multi[-\s]?use|applicable|can be applied|adaptable/i;
const NEWLINE_REGEX = /\r?\n/;

function extractJsonObject(text: string): unknown {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end <= start) {
		throw new Error("No JSON object found in model response");
	}
	return JSON.parse(text.slice(start, end + 1));
}

function normalizeQuality(text: string): ExtractedItem["quality"] {
	if (HIGH_QUALITY_REGEX.test(text)) {
		return "high";
	}
	if (LOW_QUALITY_REGEX.test(text)) {
		return "low";
	}
	return "medium";
}

function stripMarkdown(line: string): string {
	return line.replace(/[*_`]/g, "").trim();
}

function isHeadingLine(line: string): boolean {
	if (HEADING_REGEX.test(line)) {
		return true;
	}
	const cleaned = stripMarkdown(line);
	if (!cleaned) {
		return false;
	}
	if (QUALITY_ONLY_REGEX.test(cleaned)) {
		return true;
	}
	if (cleaned.toUpperCase() === cleaned && cleaned.length <= 48) {
		return true;
	}
	if (METADATA_REGEX.test(cleaned) && cleaned.length <= 48) {
		return true;
	}
	return false;
}

function appendContext(
	item: ExtractedItem,
	text: string
): ExtractedItem["context"] {
	if (!text) {
		return item.context;
	}
	if (item.context) {
		item.context = `${item.context} ${text}`.trim();
	} else {
		item.context = text;
	}
	return item.context;
}

function normalizeSections(
	sections?: ExtractionSection[]
): ExtractionSection[] {
	if (!sections?.length) {
		return [];
	}

	return sections
		.map((section) => ({
			type: section.type,
			markdown: section.markdown.trim(),
			itemCount: section.itemCount,
		}))
		.filter((section) => section.markdown.length > 0);
}

function buildSectionsFromItems(
	items: ExtractedContent[]
): ExtractionSection[] {
	const grouped = new Map<ContentType, ExtractedContent[]>();

	for (const item of items) {
		const list = grouped.get(item.contentType) ?? [];
		list.push(item);
		grouped.set(item.contentType, list);
	}

	const sections: ExtractionSection[] = [];

	for (const [type, group] of grouped) {
		const sorted = [...group].sort((a, b) => {
			const qualityDiff = QUALITY_SCORE[b.quality] - QUALITY_SCORE[a.quality];
			if (qualityDiff !== 0) {
				return qualityDiff;
			}
			if (a.multiUse !== b.multiUse) {
				return a.multiUse ? -1 : 1;
			}
			return 0;
		});

		const lines = sorted.slice(0, 6).map((item) => {
			const context =
				item.context && item.context.length <= 140 ? ` - ${item.context}` : "";
			return `- ${item.content}${context}`;
		});

		if (lines.length > 0) {
			sections.push({
				type,
				markdown: lines.join("\n"),
				itemCount: group.length,
			});
		}
	}

	return sections;
}

// Parser state for parseItemsFromText
interface ParserState {
	contentType: ContentType | null;
	exampleCategory: ExtractedItem["exampleCategory"] | undefined;
	quality: ExtractedItem["quality"];
	multiUse: boolean;
	lastItem: ExtractedItem | null;
}

const BULLET_REGEX = /^[-*•]\s*(.+)$/;
const BOLD_REGEX = /^\*\*(.+?)\*\*(.*)$/;

function detectContentType(text: string): ContentType | null {
	for (const [regex, type] of SECTION_TO_CONTENT_TYPE) {
		if (regex.test(text)) {
			return type;
		}
	}
	return null;
}

function detectExampleCategory(
	text: string
): ExtractedItem["exampleCategory"] | undefined {
	for (const [regex, category] of EXAMPLE_CATEGORY_MAP) {
		if (regex.test(text)) {
			return category;
		}
	}
	return undefined;
}

function processHeadingMetadata(text: string, state: ParserState): void {
	if (!METADATA_REGEX.test(text)) {
		return;
	}
	if (QUALITY_KEYWORD_REGEX.test(text)) {
		state.quality = normalizeQuality(text);
		if (!MULTI_USE_REGEX.test(text)) {
			state.multiUse = false;
		}
	}
	if (MULTI_USE_REGEX.test(text)) {
		state.multiUse = true;
	}
}

function handleQualityLine(text: string, state: ParserState): boolean {
	if (!QUALITY_KEYWORD_REGEX.test(text)) {
		return false;
	}
	state.quality = normalizeQuality(text);
	if (!MULTI_USE_REGEX.test(text)) {
		state.multiUse = false;
	}
	return true;
}

function handleMultiUseLine(text: string, state: ParserState): boolean {
	if (!MULTI_USE_REGEX.test(text)) {
		return false;
	}
	state.multiUse = MULTI_USE_YES_REGEX.test(text) || state.multiUse;
	if (state.lastItem) {
		state.lastItem.multiUse = true;
	}
	return true;
}

function handleContextLine(text: string, state: ParserState): boolean {
	if (CONTEXT_PREFIX_REGEX.test(text) && state.lastItem) {
		appendContext(
			state.lastItem,
			text.replace(CONTEXT_REPLACE_REGEX, "").trim()
		);
		return true;
	}
	if (state.lastItem && CONTEXT_REGEX.test(text)) {
		appendContext(state.lastItem, text);
		if (MULTI_USE_APPLICABLE_REGEX.test(text)) {
			state.lastItem.multiUse = true;
		}
		return true;
	}
	return false;
}

function extractItemContent(line: string): string | null {
	const bulletMatch = line.match(BULLET_REGEX);
	const boldMatch = line.match(BOLD_REGEX);

	if (!(bulletMatch || boldMatch)) {
		return null;
	}

	let content = bulletMatch ? bulletMatch[1] : line;
	content = stripMarkdown(content);

	const colonIndex = content.indexOf(":");
	if (colonIndex > 0 && colonIndex < 80) {
		const after = content.slice(colonIndex + 1).trim();
		content = after || content.slice(0, colonIndex).trim();
	}

	if (content.length < 5 || QUALITY_ONLY_REGEX.test(content)) {
		return null;
	}

	return content;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Line parsing requires sequential state handling
function parseItemsFromText(
	text: string,
	parameters: ExtractionParameters
): ExtractedItem[] {
	const items: ExtractedItem[] = [];
	const lines = text.split(NEWLINE_REGEX);
	const state: ParserState = {
		contentType: null,
		exampleCategory: undefined,
		quality: "medium",
		multiUse: false,
		lastItem: null,
	};

	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}

		const cleanedLine = stripMarkdown(line);

		// Handle heading lines
		if (isHeadingLine(line) || isHeadingLine(cleanedLine)) {
			const detectedType = detectContentType(cleanedLine);
			if (detectedType) {
				state.contentType = detectedType;
				state.exampleCategory = undefined;
				state.multiUse = false;
			}
			if (state.contentType === "example") {
				state.exampleCategory = detectExampleCategory(cleanedLine);
			}
			processHeadingMetadata(cleanedLine, state);
			continue;
		}

		// Check for content type in non-heading lines
		const typeFromLine = detectContentType(cleanedLine);
		if (typeFromLine) {
			state.contentType = typeFromLine;
			state.exampleCategory = undefined;
			state.multiUse = false;
		}

		// Handle quality and multi-use metadata lines
		if (handleQualityLine(cleanedLine, state)) {
			continue;
		}
		if (handleMultiUseLine(cleanedLine, state)) {
			continue;
		}

		// Handle context lines
		if (handleContextLine(cleanedLine, state)) {
			continue;
		}

		// Try to extract item content
		if (!state.contentType) {
			continue;
		}

		const content = extractItemContent(line);
		if (!content) {
			continue;
		}

		// Check if content is metadata
		if (METADATA_REGEX.test(content) && content.length <= 48) {
			if (QUALITY_KEYWORD_REGEX.test(content)) {
				state.quality = normalizeQuality(content);
			}
			if (MULTI_USE_REGEX.test(content)) {
				state.multiUse = true;
			}
			continue;
		}

		const item: ExtractedItem = {
			contentType: state.contentType,
			exampleCategory:
				state.contentType === "example" ? state.exampleCategory : undefined,
			content,
			quality: state.quality,
			isOverused: isOverusedExample(content, parameters.overusedExamples),
			multiUse: state.multiUse || assessMultiUse(content, state.contentType),
		};

		items.push(item);
		state.lastItem = item;
	}

	return items;
}

/**
 * Extracts structured content from a single essay.
 *
 * @param essayText - The essay text to extract from
 * @param parameters - Extraction configuration parameters
 * @param sourceRef - Reference to the source (R2 key or Notion page ID)
 * @param essayTitle - Optional title of the essay
 * @returns Extracted content items
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Multi-fallback LLM extraction requires nested error handling
export async function extractContentFromEssay(
	essayText: string,
	parameters: ExtractionParameters,
	sourceRef: string,
	essayTitle?: string
): Promise<{ items: ExtractedContent[]; sections: ExtractionSection[] }> {
	// Skip very short essays
	const wordCount = essayText.split(WORD_SPLIT_REGEX).filter(Boolean).length;
	if (wordCount < 100) {
		return { items: [], sections: [] };
	}

	const model = getModel("EXTRACTION");
	const prompt = createExtractionPrompt(essayText, parameters, essayTitle);

	let extractedItems: ExtractedItem[] = [];
	let extractedSections: ExtractionSection[] = [];

	try {
		const result = await generateObject({
			model,
			schema: ExtractionResultSchema,
			system: EXTRACTION_SYSTEM_PROMPT,
			prompt,
		});
		extractedItems = result.object.items;
		extractedSections = normalizeSections(result.object.sections);
	} catch (error) {
		const errorText =
			error && typeof error === "object" && "text" in error
				? String((error as { text?: string }).text ?? "")
				: "";

		if (errorText) {
			try {
				const parsedJson = extractJsonObject(errorText);
				const parsed = ExtractionResultSchema.safeParse(parsedJson);
				if (parsed.success) {
					extractedItems = parsed.data.items;
					extractedSections = normalizeSections(parsed.data.sections);
				}
			} catch {
				extractedItems = parseItemsFromText(errorText, parameters);
			}
		}

		if (extractedItems.length === 0) {
			const fallback = await generateText({
				model,
				system: `${EXTRACTION_SYSTEM_PROMPT}\n\n${EXTRACTION_JSON_INSTRUCTIONS}`,
				prompt,
			});

			try {
				const parsedJson = extractJsonObject(fallback.text);
				const parsed = ExtractionResultSchema.safeParse(parsedJson);
				if (parsed.success) {
					extractedItems = parsed.data.items;
					extractedSections = normalizeSections(parsed.data.sections);
				} else {
					extractedItems = parseItemsFromText(fallback.text, parameters);
				}
			} catch {
				extractedItems = parseItemsFromText(fallback.text, parameters);
			}
		}
	}

	const extractedContent = extractedItems.map((item) =>
		convertToExtractedContent(item, sourceRef, parameters)
	);

	// Filter by quality threshold
	const filteredItems = filterByQuality(
		extractedContent,
		parameters.minQualityThreshold
	);

	const sections =
		extractedSections.length > 0
			? extractedSections
			: buildSectionsFromItems(filteredItems);

	return { items: filteredItems, sections };
}

/**
 * Converts an LLM-extracted item to the ExtractedContent format.
 */
function convertToExtractedContent(
	item: ExtractedItem,
	sourceRef: string,
	parameters: ExtractionParameters
): ExtractedContent {
	// Re-assess quality and flags using our local functions
	const qualityResult = calculateQuality(
		item.verbatimText || item.content,
		item.contentType
	);
	const overused = isOverusedExample(
		item.verbatimText || item.content,
		parameters.overusedExamples
	);
	const multiUse = assessMultiUse(
		item.verbatimText || item.content,
		item.contentType
	);

	return {
		id: crypto.randomUUID(),
		sourceType: "topper",
		sourceRef,
		contentType: item.contentType,
		exampleCategory: item.exampleCategory,
		content: item.content,
		verbatimText: item.verbatimText,
		context: item.context,
		detailsMarkdown: item.detailsMarkdown,
		quality: qualityResult.quality,
		isOverused: overused || item.isOverused,
		multiUse: multiUse || item.multiUse,
		themes: [], // Will be classified in a separate step
		attribution: item.attribution,
		sourcePageStart: item.sourcePageStart,
		sourcePageEnd: item.sourcePageEnd,
		createdAt: new Date().toISOString(),
	};
}

/** Default concurrency for parallel extraction */
const DEFAULT_CONCURRENCY = 3;

/** Maximum concurrency to avoid rate limits */
const MAX_CONCURRENCY = 5;

/**
 * Extracts content from multiple essays in parallel batches.
 *
 * @param essays - Array of essay texts with boundaries
 * @param parameters - Extraction configuration
 * @param sourceRef - Source reference
 * @param onProgress - Progress callback
 * @param concurrency - Number of parallel extractions (default: 3, max: 5)
 * @returns Array of extraction results per essay
 */
export async function extractContentBatch(
	essays: Array<{
		text: string;
		startPage: number;
		endPage: number;
		title?: string;
	}>,
	parameters: ExtractionParameters,
	sourceRef: string,
	onProgress?: (processed: number, total: number) => void,
	concurrency: number = DEFAULT_CONCURRENCY
): Promise<EssayExtractionResult[]> {
	const effectiveConcurrency = Math.min(
		Math.max(1, concurrency),
		MAX_CONCURRENCY
	);

	// For small batches, use sequential processing
	if (essays.length <= effectiveConcurrency) {
		return extractContentSequential(essays, parameters, sourceRef, onProgress);
	}

	// Split essays into batches for parallel processing
	const batches = splitIntoBatches(essays, effectiveConcurrency);
	const results: EssayExtractionResult[] = new Array(essays.length);
	let processedCount = 0;

	// Process batches with controlled concurrency
	for (const batch of batches) {
		const batchPromises = batch.map(({ essay, originalIndex }) =>
			extractSingleEssay(essay, originalIndex, parameters, sourceRef)
		);

		const batchResults = await Promise.allSettled(batchPromises);

		// Process results and update progress
		for (let i = 0; i < batchResults.length; i++) {
			const result = batchResults[i];
			const { essay, originalIndex } = batch[i];

			if (result.status === "fulfilled") {
				results[originalIndex] = result.value;
			} else {
				// Log error and create failed result
				console.error(
					`Failed to extract from essay ${originalIndex + 1}:`,
					result.reason
				);
				results[originalIndex] = createFailedResult(essay);
			}

			processedCount++;
			onProgress?.(processedCount, essays.length);
		}
	}

	return results;
}

/**
 * Sequential extraction for small batches or fallback.
 */
async function extractContentSequential(
	essays: Array<{
		text: string;
		startPage: number;
		endPage: number;
		title?: string;
	}>,
	parameters: ExtractionParameters,
	sourceRef: string,
	onProgress?: (processed: number, total: number) => void
): Promise<EssayExtractionResult[]> {
	const results: EssayExtractionResult[] = [];

	for (let i = 0; i < essays.length; i++) {
		const essay = essays[i];

		try {
			const result = await extractSingleEssay(essay, i, parameters, sourceRef);
			results.push(result);
		} catch (error) {
			console.error(`Failed to extract from essay ${i + 1}:`, error);
			results.push(createFailedResult(essay));
		}

		onProgress?.(i + 1, essays.length);
	}

	return results;
}

/**
 * Extracts content from a single essay with metadata.
 */
async function extractSingleEssay(
	essay: { text: string; startPage: number; endPage: number; title?: string },
	essayIndex: number,
	parameters: ExtractionParameters,
	sourceRef: string
): Promise<EssayExtractionResult> {
	const { items, sections } = await extractContentFromEssay(
		essay.text,
		parameters,
		sourceRef,
		essay.title
	);

	const itemsWithMeta = items.map((item) => ({
		...item,
		essayTitle: essay.title,
		essayIndex: essayIndex + 1,
		essayStartPage: essay.startPage,
		essayEndPage: essay.endPage,
	}));

	const wordCount = essay.text.split(WORD_SPLIT_REGEX).filter(Boolean).length;

	return {
		essayTitle: essay.title,
		startPage: essay.startPage,
		endPage: essay.endPage,
		items: itemsWithMeta,
		sections,
		overallQuality: calculateOverallQuality(items),
		wordCount,
	};
}

/**
 * Creates a failed result placeholder for an essay.
 */
function createFailedResult(essay: {
	text: string;
	startPage: number;
	endPage: number;
	title?: string;
}): EssayExtractionResult {
	return {
		essayTitle: essay.title,
		startPage: essay.startPage,
		endPage: essay.endPage,
		items: [],
		sections: [],
		overallQuality: "low",
		wordCount: essay.text.split(WORD_SPLIT_REGEX).filter(Boolean).length,
	};
}

/**
 * Splits essays into batches for parallel processing.
 * Each batch contains up to `batchSize` essays that will be processed concurrently.
 */
function splitIntoBatches(
	essays: Array<{
		text: string;
		startPage: number;
		endPage: number;
		title?: string;
	}>,
	concurrency: number
): Array<Array<{ essay: (typeof essays)[number]; originalIndex: number }>> {
	const batches: Array<
		Array<{ essay: (typeof essays)[number]; originalIndex: number }>
	> = [];

	// Create indexed essays
	const indexedEssays = essays.map((essay, index) => ({
		essay,
		originalIndex: index,
	}));

	// Split into batches of size `concurrency`
	for (let i = 0; i < indexedEssays.length; i += concurrency) {
		batches.push(indexedEssays.slice(i, i + concurrency));
	}

	return batches;
}

/**
 * Calculates overall quality based on extracted items.
 */
function calculateOverallQuality(
	items: ExtractedContent[]
): ExtractedContent["quality"] {
	if (items.length === 0) {
		return "low";
	}

	const qualityScores = {
		high: 3,
		medium: 2,
		low: 1,
	};

	const totalScore = items.reduce(
		(sum, item) => sum + qualityScores[item.quality],
		0
	);
	const avgScore = totalScore / items.length;

	if (avgScore >= 2.5) {
		return "high";
	}
	if (avgScore >= 1.5) {
		return "medium";
	}
	return "low";
}

/**
 * Gets extraction statistics from results.
 */
export function getExtractionStats(results: EssayExtractionResult[]): {
	totalEssays: number;
	totalItems: number;
	byType: Record<ContentType, number>;
	byQuality: Record<ExtractedContent["quality"], number>;
	overusedCount: number;
	multiUseCount: number;
} {
	const allItems = results.flatMap((r) => r.items);

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

	const byQuality: Record<ExtractedContent["quality"], number> = {
		high: 0,
		medium: 0,
		low: 0,
	};

	let overusedCount = 0;
	let multiUseCount = 0;

	for (const item of allItems) {
		byType[item.contentType]++;
		byQuality[item.quality]++;
		if (item.isOverused) {
			overusedCount++;
		}
		if (item.multiUse) {
			multiUseCount++;
		}
	}

	return {
		totalEssays: results.length,
		totalItems: allItems.length,
		byType,
		byQuality,
		overusedCount,
		multiUseCount,
	};
}

/**
 * Groups extracted content by type.
 */
export function groupByType(
	items: ExtractedContent[]
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

	for (const item of items) {
		grouped[item.contentType].push(item);
	}

	return grouped;
}

/**
 * Filters items to only high-value content (high quality, not overused).
 */
export function getHighValueContent(
	items: ExtractedContent[]
): ExtractedContent[] {
	return items.filter((item) => item.quality === "high" && !item.isOverused);
}

/**
 * Gets multi-use content that can be applied across themes.
 */
export function getMultiUseContent(
	items: ExtractedContent[]
): ExtractedContent[] {
	return items.filter((item) => item.multiUse);
}
