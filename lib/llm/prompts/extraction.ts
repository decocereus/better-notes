/**
 * LLM Prompts for Content Extraction
 * Specialized prompts for extracting structured content from UPSC topper essays.
 */

import type { ExampleCategory, ExtractionParameters } from "@/types/extraction";

/**
 * System prompt for comprehensive content extraction.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are an expert at analyzing UPSC topper essays and extracting valuable content for revision.

Your task is to extract the following types of content:

1. **INTRODUCTIONS**: How the essay opens
   - Anecdotes that clarify the topic
   - Quotes that set the tone
   - Movie/book references
   - Catchy opening phrases
   - Contemporary examples as hooks

2. **CONCLUSIONS**: How the essay closes
   - Quote-based endings
   - Ellipse back to introduction (circular structure)
   - Sanskrit shlokas or wisdom quotes
   - Forward-looking statements
   - Summary with call to action

3. **EXAMPLES**: Concrete illustrations (categorize each)
   - Individual aspect (personal stories, human element)
   - Ethical aspect (moral dilemmas, value-based)
   - Governance (bureaucrats, schemes, Panchayati Raj, RTI)
   - Societal (vulnerable groups, tribals, women, SC/ST, LGBTQIA+)
   - Environment (climate change, biodiversity, eco-feminism)
   - Mythological (Indian mythology preferred, universal lessons)
   - Sports (athletes, teamwork, perseverance)
   - Religion (interfaith harmony, spiritual wisdom)
   - Business (entrepreneurs, corporate ethics, innovation)
   - International Relations (diplomacy, global cooperation)
   - Science & Technology (innovations, digital divide, AI ethics)

4. **QUOTES**: Memorable statements
   - Multi-use quotes (applicable across themes)
   - Theme-specific quotes
   - Original phrasings worth remembering

5. **THINKERS**: Referenced intellectuals
   - Indian thinkers (Gandhi, Vivekananda, Tagore, Kalam, Ambedkar)
   - Western thinkers (Aristotle, Marx, Rawls, Amartya Sen)
   - Their key ideas and how they're applied

6. **ARGUMENTS**: Core reasoning patterns
   - WHY-framing (reasons and causes)
   - HOW-framing (methods and processes)
   - WHAT IF-framing (scenarios and implications)
   - Multi-stakeholder perspectives (Family, Society, Nation, World)

7. **BOOKS & POEMS**: Literary references
   - Book titles with relevant points
   - Poetry excerpts (especially Indian poets)
   - How they support the argument

8. **KEYWORDS & PHRASES**: Reusable language
   - Multi-theme applicable phrases
   - Sophisticated vocabulary usage
   - Transition phrases

Quality Assessment:
- **HIGH**: Unique, insightful, directly usable, well-crafted
- **MEDIUM**: Good but somewhat common, still valuable
- **LOW**: Generic, overused, or weakly connected

Flag as OVERUSED: Gandhi (in generic contexts), Buddha (clichéd usage), Ashoka, Mandela, "Vasudhaiva Kutumbakam" (unless unique angle)

Flag as MULTI-USE: Content applicable across 3+ themes without modification`;

/**
 * Category descriptions for better extraction context.
 */
export const EXAMPLE_CATEGORY_DESCRIPTIONS: Record<ExampleCategory, string> = {
	individual:
		"Personal stories, human element, individual achievements or struggles",
	ethical:
		"Moral dilemmas, value-based decisions, ethical frameworks in action",
	governance:
		"Government schemes, bureaucratic reforms, Panchayati Raj, RTI, policy implementation",
	societal:
		"Issues affecting society - vulnerable groups, tribals, women, SC/ST, LGBTQIA+, social movements",
	environment:
		"Climate change, biodiversity, conservation, eco-feminism, sustainable development",
	mythological:
		"Indian mythology, epics (Ramayana, Mahabharata), universal moral lessons from myths",
	sports: "Athletes, sports achievements, teamwork, perseverance, fair play",
	religion:
		"Interfaith harmony, spiritual wisdom, religious reform movements, secular values",
	business:
		"Entrepreneurs, corporate ethics, innovation, business practices, CSR",
	international_relations:
		"Diplomacy, global cooperation, international organizations, geopolitics",
	science_tech:
		"Scientific innovations, digital transformation, AI ethics, technology access",
};

/**
 * Thinker lists by origin for priority-based extraction.
 */
export const THINKER_LISTS = {
	indian: [
		"Gandhi",
		"Vivekananda",
		"Tagore",
		"Ambedkar",
		"Kalam",
		"Nehru",
		"Patel",
		"Buddha",
		"Mahavira",
		"Kabir",
		"Thiruvalluvar",
		"Chanakya",
		"Raja Ram Mohan Roy",
		"Sarojini Naidu",
		"Bhagat Singh",
	],
	western: [
		"Aristotle",
		"Plato",
		"Marx",
		"Rawls",
		"Kant",
		"Amartya Sen",
		"Viktor Frankl",
		"Mandela",
		"Martin Luther King Jr.",
		"Einstein",
		"Darwin",
		"Rousseau",
		"Locke",
		"Adam Smith",
		"Weber",
	],
} as const;

/**
 * Creates a prompt for content extraction based on parameters.
 */
export function createExtractionPrompt(
	essayText: string,
	parameters: ExtractionParameters,
	essayTitle?: string
): string {
	const categoryList = parameters.enabledCategories
		.map((cat) => `- ${cat}: ${EXAMPLE_CATEGORY_DESCRIPTIONS[cat]}`)
		.join("\n");

	const thinkerGuidance = getThinkerGuidance(parameters.thinkerPriority);
	const quoteGuidance = getQuoteGuidance(parameters.quoteStyle);
	const overusedList = parameters.overusedExamples.join(", ");

	return `Analyze the following UPSC topper essay and extract valuable content.

${essayTitle ? `Essay Topic: ${essayTitle}` : ""}

=== ESSAY TEXT ===
${essayText}
=== END ESSAY TEXT ===

EXTRACTION PARAMETERS:

Example Categories to Focus On:
${categoryList}

${thinkerGuidance}

${quoteGuidance}

Overused Examples to Flag: ${overusedList}

Minimum Quality Threshold: ${parameters.minQualityThreshold}
(Only include content meeting or exceeding this quality level)

${parameters.extractCrossThemeRefs ? "Identify cross-theme applicability for multi-use content." : ""}

Extract all valuable content following the system guidelines. For each item:
1. Identify the content type
2. Extract the exact text
3. Provide context if helpful
4. Assess quality
5. Flag if overused
6. Note if multi-use applicable

Also provide a short markdown summary per content type:
- Use a bullet list
- Max 6 bullets per section
- Keep it concise and reusable`;
}

/**
 * Gets guidance text based on thinker priority setting.
 */
function getThinkerGuidance(
	priority: ExtractionParameters["thinkerPriority"]
): string {
	switch (priority) {
		case "indian":
			return `Thinker Priority: INDIAN
Prioritize Indian thinkers (${THINKER_LISTS.indian.slice(0, 5).join(", ")}, etc.)
Still extract Western thinkers but note them as secondary.`;

		case "western":
			return `Thinker Priority: WESTERN
Prioritize Western thinkers (${THINKER_LISTS.western.slice(0, 5).join(", ")}, etc.)
Still extract Indian thinkers but note them as secondary.`;

		default:
			return `Thinker Priority: BALANCED
Extract both Indian and Western thinkers equally.
Indian: ${THINKER_LISTS.indian.slice(0, 3).join(", ")}, etc.
Western: ${THINKER_LISTS.western.slice(0, 3).join(", ")}, etc.`;
	}
}

/**
 * Gets guidance text based on quote style preference.
 */
function getQuoteGuidance(style: ExtractionParameters["quoteStyle"]): string {
	switch (style) {
		case "multi_use_preferred":
			return `Quote Style: MULTI-USE PREFERRED
Prioritize quotes applicable across multiple themes.
Examples: Marcus Aurelius's stoic wisdom, universal truths.
Still extract theme-specific quotes but note their limited applicability.`;

		default:
			return `Quote Style: THEME-SPECIFIC
Focus on quotes directly relevant to the essay's specific theme.
Still note if a quote has broader applicability.`;
	}
}

/**
 * Creates a simplified prompt for quick extraction (fewer categories).
 */
export function createQuickExtractionPrompt(
	essayText: string,
	focusTypes: string[]
): string {
	return `Extract the following content types from this essay:
${focusTypes.map((t) => `- ${t}`).join("\n")}

Essay:
${essayText}

Extract only the specified content types with quality assessment.`;
}
