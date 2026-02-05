/**
 * LLM Prompts for Content Extraction
 * Specialized prompts for extracting structured content from UPSC topper essays.
 */

import type { ExampleCategory, ExtractionParameters } from "@/types/extraction";

const WORD_SPLIT_REGEX = /\s+/;

/**
 * System prompt for comprehensive content extraction.
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are an expert at analyzing UPSC topper essays and extracting valuable content for revision.

## CONTENT TYPES TO EXTRACT

1. **INTRODUCTIONS**: Opening techniques (anecdotes, quotes, hooks, contemporary references)
2. **CONCLUSIONS**: Closing techniques (quote-based, circular structure, forward-looking)
3. **EXAMPLES**: Concrete illustrations by category (individual, ethical, governance, societal, environment, mythological, sports, religion, business, international_relations, science_tech)
4. **QUOTES**: Memorable statements (multi-use preferred, theme-specific when strong)
5. **THINKERS**: Referenced intellectuals with their key ideas
6. **ARGUMENTS**: Reasoning patterns (WHY/HOW/WHAT IF framing)
7. **BOOKS & POEMS**: Literary references with how they support arguments
8. **KEYWORDS & PHRASES**: Reusable sophisticated language

## CRITICAL: FIELD DEFINITIONS

Each extracted item MUST have these fields filled correctly:

| Field | What Goes Here | Example |
|-------|----------------|---------|
| **content** | One-line headline/summary (5-15 words) | "Technology-policy lag as governance challenge" |
| **verbatimText** | EXACT quote copied from OCR text | "In the 19th century, a policy lasted for decades. But today, by the time a policy comes, a new technology has already arrived." |
| **detailsMarkdown** | Usage guidance, why it works, when to use | "**Why it works:** Concrete temporal contrast shows urgency.\\n**Use for:** Technology governance, policy reform, digital India themes." |
| **context** | Brief situational note if needed | "From introduction paragraph" |

## FEW-SHOT EXAMPLES

### CORRECT Example 1 (Introduction):
\`\`\`json
{
  "contentType": "introduction",
  "content": "Climate change framed as contemporary moral imperative",
  "verbatimText": "Climate change is a reality of contemporary times. It is a result of mainly the anthropogenic activities which have resulted in an increase in global average temperature.",
  "detailsMarkdown": "**Why it works:** Direct problem statement without flowery language. Immediately frames human responsibility.\\n\\n**Use for:** Climate essays, environment themes, intergenerational justice.\\n\\n**Technique:** Contemporary framing + causation in opening line.",
  "quality": "high",
  "multiUse": true,
  "isOverused": false
}
\`\`\`

### CORRECT Example 2 (Quote):
\`\`\`json
{
  "contentType": "quote",
  "content": "Gandhi on means-ends relationship in ethics",
  "verbatimText": "The means may be likened to a seed, the end to a tree; and there is just the same inviolable connection between the means and the end as there is between the seed and the tree.",
  "detailsMarkdown": "**Why it works:** Organic metaphor makes abstract ethics concrete.\\n\\n**Use for:** Ethics essays, governance integrity, ends-justify-means debates.\\n\\n**Pairs with:** Consequentialism vs deontology arguments.",
  "attribution": {
    "name": "Mahatma Gandhi",
    "role": "Freedom fighter and philosopher"
  },
  "quality": "high",
  "multiUse": true,
  "isOverused": false
}
\`\`\`

### CORRECT Example 3 (Example - Governance):
\`\`\`json
{
  "contentType": "example",
  "exampleCategory": "governance",
  "content": "Swachh Bharat Mission behavioral change success",
  "verbatimText": "The Swachh Bharat Mission did not just build toilets but changed mindsets. Open defecation reduced from 550 million to under 50 million in 5 years.",
  "detailsMarkdown": "**Why it works:** Quantified impact + behavioral angle (not just infrastructure).\\n\\n**Use for:** Governance success stories, behavioral economics, sanitation/health themes.\\n\\n**Avoid:** Don't use if essay already has 2+ government scheme examples.",
  "quality": "high",
  "multiUse": true,
  "isOverused": false
}
\`\`\`

### WRONG - DO NOT DO THIS:
\`\`\`json
// WRONG: Field name as content
{ "content": "detailsMarkdown", ... }

// WRONG: Usage guidance as content (should be in detailsMarkdown)
{ "content": "Works for any current global challenge essay", ... }

// WRONG: Missing verbatimText, vague summary
{ "content": "Good opening technique", "verbatimText": "", ... }

// WRONG: Paraphrased instead of verbatim
{ "verbatimText": "Climate change is happening due to human activities", ... }
\`\`\`

## QUALITY ASSESSMENT

- **HIGH**: Unique angle, concrete/specific, directly quotable, well-crafted
- **MEDIUM**: Solid but common framing, still useful for revision
- **LOW**: Generic, vague, or weakly connected

## FLAGS

- **isOverused**: Gandhi/Buddha/Ashoka/Mandela in generic contexts, "Vasudhaiva Kutumbakam" without unique angle
- **multiUse**: Applicable across 3+ themes without modification

## RULES

1. **verbatimText MUST be exact OCR text** - copy-paste, do not paraphrase
2. **content is a headline** - short, specific, describes what the item IS
3. **detailsMarkdown explains usage** - why it works, when to use, what it pairs with
4. Do not invent names, dates, or sources - only use what appears in the text
5. Quality over quantity - 15 high-quality items beats 50 mediocre ones`;

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

	const approxWordCount = essayText
		.split(WORD_SPLIT_REGEX)
		.filter(Boolean).length;

	const thinkerGuidance = getThinkerGuidance(parameters.thinkerPriority);
	const quoteGuidance = getQuoteGuidance(parameters.quoteStyle);
	const overusedList = parameters.overusedExamples.join(", ");

	return `Analyze the following UPSC topper essay and extract valuable content.

${essayTitle ? `Essay Topic: ${essayTitle}` : ""}
Approx word count: ${approxWordCount}

=== ESSAY TEXT ===
${essayText}
=== END ESSAY TEXT ===

EXTRACTION PARAMETERS:

Example Categories to Focus On:
${categoryList}

${thinkerGuidance}

${quoteGuidance}

Overused Examples to Flag: ${overusedList}

Minimum Quality Threshold (for filtering later): ${parameters.minQualityThreshold}
- Still extract your best candidates even if they are below this threshold; set "quality" honestly.
- Never return an empty "items" array for a real essay. If unsure, return at least 6 items and mark them "low".

${parameters.extractCrossThemeRefs ? "Identify cross-theme applicability for multi-use content." : ""}

EXTRACTION CHECKLIST (for each item):
1. **content**: Write a specific 5-15 word headline (NOT field names, NOT usage guidance)
2. **verbatimText**: Copy-paste EXACT text from the essay (no paraphrasing)
3. **detailsMarkdown**: Explain WHY it works + WHEN to use it + WHAT it pairs with
4. **quality**: Assess honestly (high/medium/low)
5. **isOverused**: Flag if Gandhi/Buddha/Ashoka/Mandela in generic context
6. **multiUse**: True if works across 3+ themes
7. **attribution**: Include name/role/work/year if present in text

REMEMBER:
- "content" field = WHAT the item IS (headline)
- "detailsMarkdown" field = HOW to USE it (guidance)
- Never put usage guidance in the content field
- Never output field names as content
- Quality over quantity - extract fewer, better items`;
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
