# BetterNotes - UPSC Essay Preparation Assistant

## Project Overview

A Next.js web app that helps UPSC aspirants prepare for essay writing by:
1. Extracting patterns from topper handwritten essays (PDFs)
2. Classifying user's notes into essay themes
3. Comparing content against topper patterns and strategy criteria
4. Generating revision-ready notes organized by themes

---

## Existing Setup (Already Done)

- **Framework**: Next.js 16.1.4 (App Router)
- **React**: 19.2.3
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **Components**: button, badge, card, input, textarea, dropdown-menu, label, separator, select, alert-dialog, combobox, field
- **Utilities**: `lib/utils.ts` with cn() helper

---

## Dependencies to Add

```bash
bun add ai @ai-sdk/openai zod @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- `ai` - Vercel AI SDK for LLM integration
- `@ai-sdk/openai` - OpenRouter-compatible provider
- `zod` - Schema validation for LLM outputs
- `@aws-sdk/client-s3` - S3-compatible client for Cloudflare R2
- `@aws-sdk/s3-request-presigner` - Signed URL generation for R2

---

## Environment Variables

Create `.env.local`:
```env
# Notion Integration (user provides via UI, stored in localStorage)
# Can also be set here for server-side access
NOTION_API_KEY=ntn_xxx

# OpenRouter for LLM (REQUIRED - env only, not configurable via UI)
# User selects models via UI dropdown, but API key is always from env
OPENROUTER_API_KEY=sk-or-xxx

# Cloudflare R2 Storage (for PDF uploads and file storage)
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=betternotes
```

**Note**: OpenRouter API key is environment-only. Users can only select which models to use per task via the settings dropdown - they cannot view or modify the API key.

### Why R2 over Vercel Blob?

| Feature | Vercel Blob | Cloudflare R2 |
|---------|-------------|---------------|
| File size limit | 500MB | 5GB+ |
| Signed URLs | Limited | Full S3-compatible |
| Streaming | No | Yes |
| Cost (storage) | $0.40/GB | $0.015/GB |
| Cost (egress) | $0.30/GB | Free |

For 190MB+ topper PDFs, R2 provides better streaming, signed URLs for secure access, and significant cost savings.

---

## Core Features

### 1. Theme Dashboard
- Display essay themes from Notion (Main Theme → Mini Theme → Questions)
- User connects Notion and selects pages for: Themes, Strategy, Output
- **Content sources are NOT pre-configured** - user provides them on-demand

### 1b. Project/Thread Workflow
- User starts a project (session for working on themes)
- User mentions/pastes Notion page URL(s) as content source
- System extracts content and **auto-classifies into themes/mini-themes**
- Multiple Notion pages can be added → content accumulates per theme
- Each theme aggregates content from all relevant sources

### 2. Topper Pattern Extraction
- Upload handwritten PDFs (up to 190MB) → Stream from R2 → OCR via LLM Vision
- Extract structured content types:
  - **Introductions**: Anecdotes, quotes, movie/book references, catchy phrases
  - **Conclusions**: Quote-based, ellipse back to intro, Sanskrit shlokas, summaries
  - **Examples** (by category):
    - Individual aspect
    - Ethical aspect (extra marks!)
    - Governance (bureaucrats, schemes, Panchayati Raj)
    - Societal (vulnerable groups, tribals, women, SC/ST, LGBTQIA+)
    - Environment (climate change, biodiversity, eco-feminism)
    - Mythological (Indian mythology preferred)
    - Sports, Religion, Business, International Relations, S&T
  - **Quotes**: Multi-use preferred, from key thinkers
  - **Thinkers**: Indian & Western (Gandhi, Marx, Buddha, Vivekananda, Plato, etc.)
  - **Arguments**: Diverse dimensions, WHY/HOW/WHAT IF framing
  - **Books & Poems**: High-value literary references
  - **Keywords & Phrases**: Multi-use phrases for revision
- Flag overused examples (Gandhi, Buddha, Ashoka, Mandela)
- Store all extracted content in Notion with theme classifications
- Extraction output is JSON for structure, plus markdown summaries per content type for UX
  - JSON remains the source of truth for filters, counts, and grouping
  - Markdown is rendered in the UI for "Highlights" per content type

#### Patterns Library UX (Topper Patterns page)
- Grouped by content type with:
  - Highlights (markdown summary rendered via ai-elements)
  - Item cards showing snippet, usage context, quality, multi-use/overused
  - Source + essay badges for traceability
- Re-extract action:
  - Pick a PDF with existing OCR results to rerun extraction only
  - Useful after prompt/schema changes without re-OCR

### 3. Content Classification (Auto)
- User mentions Notion page URL → system fetches content
- Also supports: PDFs, images, raw text input
- **LLM auto-classifies** content into themes/mini-themes
- Same content can map to multiple themes (cross-cutting)
- Content accumulates per theme from multiple sources
- User can review and adjust classifications if needed

### 4. Comparison & Analysis

**TWO MODES:**

#### Mode 1: Content Extraction & Comparison (Building NOW)
- Extract content from user notes based on themes
- Compare user content against topper content
- **Configurable Parameters** (via Settings UI):

  **Example Categories to Extract:**
  - Individual, Ethical, Governance, Societal, Environment
  - Mythological, Sports, Religion, Business, IR, S&T
  - User can enable/disable categories per their focus

  **Content Quality Criteria:**
  - Uniqueness (avoid overused examples)
  - Relevance to theme and PYQs
  - Cross-theme applicability (multi-use value)
  - Diversity of examples across categories
  - Essence illustration (does example capture theme core?)

  **Thinker Handling:**
  - Priority: Indian vs Western vs Balanced
  - Key thinkers: Gandhi, Marx, Buddha, Vivekananda, Plato, Amartya Sen, Viktor Frankl
  - Extract both quotes and anecdotes from their lives

  **Quote Style:**
  - Multi-use preferred (Marcus Aurelius, Emily Dickinson)
  - Theme-specific when highly relevant
  - Sanskrit shlokas (unique ones only, not Vasudhaiva Kutumbakam)

  **Argument Dimensions:**
  - WHY, HOW, WHAT IF framing (not just WHO, WHAT)
  - Breadth over depth (multiple reasons, not repetition)
  - Stakeholder perspectives (Family, Society, Nation, Judiciary)

- Output: Gap analysis showing what user has vs what toppers have

#### Mode 2: Writer Mode (Building LATER - Phase 2)
- Essay writing evaluation
- Parameters for writing quality (structure, flow, etc.)
- User uploads their essays for evaluation against topper patterns

**Key: All parameters are configurable per theme via dashboard**

### 5. Note Generation (Dual-Section Structure)

**For each theme, output TWO sections:**

```
## [Theme Name]

### Your Notes
[User's classified content - CONCISE, revision-ready]
[Organized, distilled to key points - not raw dumps]

---

### Topper Insights
[Enriches user content with high-value additions]
[Concise, revision-ready - NOT excess content]
[Only unique examples, strong arguments, techniques user is missing]
```

**Key Requirements:**
- **BOTH sections must be concise and revision-ready**
- Balance: Quality content + Revisability (neither compromised)
- User content: Distilled, organized - not raw notes
- Topper content: Enriches and enhances user content
- Cross-reference content across themes
- Sync to Notion

---

## Implementation Plan

### Phase 1: Foundation (Files to Create)

**Notion Client** - `lib/notion/client.ts`
```typescript
// REST API client using Notion-Version: 2025-09-03
// Endpoints: search, pages, blocks, data_sources
// Rate limiting: ~3 req/sec
```

**LLM Provider** - `lib/llm/provider.ts`
```typescript
// AI SDK with OpenRouter
// Models: claude-3.5-sonnet (analysis), gemini-flash (vision)
```

**Type Definitions** - `types/`
- `theme.ts` - Theme hierarchy types
- `project.ts` - Project/session types
- `content.ts` - Content and classification types
- `pattern.ts` - Topper pattern types
- `comparison.ts` - Evaluation types

### Phase 2: Core Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Dashboard - theme overview |
| `/projects` | `app/projects/page.tsx` | List all projects |
| `/projects/[id]` | `app/projects/[id]/page.tsx` | Project workspace - add sources, view classified content |
| `/settings` | `app/settings/page.tsx` | Notion connection + mode toggle |
| `/settings/parameters` | `app/settings/parameters/page.tsx` | Configure extraction parameters |
| `/settings/models` | `app/settings/models/page.tsx` | Select LLM models per task (dropdown only, no API key input) |
| `/themes/[id]` | `app/themes/[id]/page.tsx` | Theme detail |
| `/upload` | `app/upload/page.tsx` | Upload interface |
| `/patterns` | `app/patterns/page.tsx` | Topper patterns |
| `/compare` | `app/compare/page.tsx` | Comparison tool |
| `/notes` | `app/notes/page.tsx` | Generated notes |
| `/notes/[themeId]` | `app/notes/[themeId]/page.tsx` | Theme notes |

### Phase 3: API Routes

| Route | File | Purpose |
|-------|------|---------|
| `POST /api/notion/connect` | `app/api/notion/connect/route.ts` | Test connection |
| `GET /api/notion/search` | `app/api/notion/search/route.ts` | Search workspace |
| `GET /api/themes` | `app/api/themes/route.ts` | Fetch themes |
| `GET/POST /api/projects` | `app/api/projects/route.ts` | CRUD projects |
| `POST /api/projects/[id]/sources` | `app/api/projects/[id]/sources/route.ts` | Add content source to project |
| `POST /api/upload` | `app/api/upload/route.ts` | Upload files |
| `POST /api/extract` | `app/api/extract/route.ts` | OCR + patterns |
| `POST /api/classify` | `app/api/classify/route.ts` | Classify content |
| `POST /api/compare` | `app/api/compare/route.ts` | Run comparison |
| `POST /api/generate` | `app/api/generate/route.ts` | Generate notes |
| `POST /api/notion/sync` | `app/api/notion/sync/route.ts` | Sync to Notion |
| `GET/POST /api/parameters` | `app/api/parameters/route.ts` | Manage extraction parameters |
| `GET/POST /api/models` | `app/api/models/route.ts` | Manage model configuration per task |

### Phase 4: Components to Create

```
components/
├── theme-tree.tsx          # Hierarchical theme display
├── upload-zone.tsx         # Drag-drop file upload
├── pattern-card.tsx        # Display extracted patterns
├── comparison-results.tsx  # Show evaluation scores
├── revision-note.tsx       # Display generated notes
└── notion-connector.tsx    # Notion setup UI
```

---

## Key Implementation Details

### Notion API (v2025-09-03)

```typescript
// lib/notion/client.ts
const NOTION_VERSION = '2025-09-03';

export async function notionRequest(endpoint: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
  return res.json();
}

// Key endpoints:
// POST /search - find pages/data sources
// GET /blocks/{id}/children - get page content
// POST /pages - create page
// PATCH /blocks/{id}/children - append content
// POST /data_sources/{id}/query - query database
```

### Theme Parsing Strategy

User's theme structure:
```
Main Theme (e.g., "Philosophical Themes")
  └── Mini Theme (toggle/heading)
       └── "YYYY: Question text"
```

Parse by:
1. Get page blocks recursively
2. Detect structure (toggles vs headings)
3. Extract year from "YYYY: ..." format
4. Build hierarchy object

### LLM Prompts (Key)

**OCR Extraction:**
- Input: PDF page image (streamed from R2)
- Output: Structured text with paragraphs preserved, handwriting interpreted
- Model: `google/gemini-2.0-flash` (vision) - best for handwritten content
- Processing: 10-page chunks, parallel (max 3 concurrent)

**Essay Boundary Detection:**
- Input: Combined OCR text from multiple pages
- Output: Array of `{start_page, end_page, title_if_visible}`
- Purpose: Identify where individual essays begin/end in large PDF
- Model: `anthropic/claude-3.5-sonnet`

**Content Extraction (Per Essay):**
- Input: Single essay text + extraction parameters
- Output: Structured content array with types:
  ```typescript
  {
    type: 'introduction' | 'conclusion' | 'example' | 'quote' |
          'thinker' | 'argument' | 'book_poem' | 'keyword_phrase',
    content: string,
    exampleCategory?: string,  // For examples only
    quality: 'high' | 'medium' | 'low',
    isOverused: boolean,
    multiUse: boolean,  // Applicable across themes
  }
  ```
- Extraction focus (from strategy doc):
  - Introductions: Anecdotes that clarify ALL aspects of topic, catchy phrases
  - Examples: Diverse categories, essence-illustrating, contemporary + historical mix
  - Quotes: Multi-use preferred, from key thinkers
  - Arguments: WHY/HOW/WHAT IF framing, breadth over depth
- Flag overused: Gandhi, Buddha, Ashoka, Mandela (in generic contexts)
- Model: `anthropic/claude-3.5-sonnet`

**Content Classification:**
- Input: Extracted content item + theme hierarchy (40+ themes)
- Output: Array of `{mainThemeId, miniThemeId, relevanceScore}`
- Cross-theme: Same content appears in ALL themes with score > 0.6
- Model: `anthropic/claude-3-haiku` (fast, cheap, good enough)

**Comparison Analysis:**
- Input: User content + topper content + extraction parameters (per theme)
- Output:
  - Coverage map: What user has per category
  - Gaps: What toppers have that user is missing
  - Quality assessment: Uniqueness, diversity, depth
  - Suggestions: Specific content to add
- Model: `anthropic/claude-3.5-sonnet`

**Note Generation (Dual-Section):**
- Input: Classified user content + topper content + theme context
- Output per theme:
  1. **Your Notes**: User's content - CONCISE, distilled, organized
     - Key points in digestible form
     - Examples kept concise
     - Arguments in revision-ready format
  2. **Topper Insights**: Enriches (not duplicates) user content
     - Unique examples user is missing
     - Strong arguments and techniques
     - Reusable intro hooks and conclusion approaches
     - Cross-theme applicability notes
- **Critical**: Both sections must be revision-ready (scannable before exam)
- **Balance**: Quality content + Revisability - neither compromised
- Model: `anthropic/claude-3.5-sonnet`

### Output Format (Per Theme)

```markdown
## Philosophical Themes > Life, Experience and Becoming

### Your Notes (Concise & Revision-Ready)
- **Key Point 1**: [distilled from your content]
- **Key Point 2**: [distilled from your content]
- **Your Example**: [your example - kept concise]
- **Core Argument**: [your argument in digestible form]

[Organized, not raw - quality preserved, excess trimmed]

---

### Topper Insights (Enriches Your Content)
- **Unique Example**: [adds to your content, not duplicate]
- **Strong Argument**: [technique you're missing]
- **Intro Hook**: [reusable opening you can adopt]
- **Cross-applicable**: Can also use in [other theme]

[Complements your notes - fills gaps, doesn't overwhelm]
```

**Balance: Revisability + Quality - neither compromised**
```

### Anti-Patterns to Detect

Flag and avoid in generated content:
- Overused examples: Gandhi, Buddha, Ashoka, Mandela
- Thesis statements: "In this essay, I will..."
- Subheadings within essays
- Defining obvious terms
- Generic statements without substance

---

## File Structure (Final)

```
better-notes/
├── app/
│   ├── page.tsx                    # Dashboard
│   ├── layout.tsx                  # (exists)
│   ├── globals.css                 # (exists)
│   ├── settings/
│   │   ├── page.tsx                # Notion setup + output destination
│   │   ├── parameters/
│   │   │   └── page.tsx            # Configure extraction parameters
│   │   └── models/
│   │       └── page.tsx            # LLM model selection
│   ├── projects/
│   │   ├── page.tsx                # List projects
│   │   └── [id]/
│   │       └── page.tsx            # Project workspace
│   ├── themes/
│   │   ├── page.tsx                # Theme list/tree
│   │   └── [id]/
│   │       ├── page.tsx            # Theme detail
│   │       └── compare/
│   │           └── page.tsx        # Per-theme comparison
│   ├── upload/
│   │   └── page.tsx                # Upload interface
│   ├── patterns/
│   │   └── page.tsx                # Extracted patterns browser
│   ├── compare/
│   │   └── page.tsx                # Global comparison tool
│   ├── notes/
│   │   ├── page.tsx                # All generated notes
│   │   └── [themeId]/
│   │       └── page.tsx            # Theme notes
│   └── api/
│       ├── notion/
│       │   ├── connect/route.ts
│       │   ├── search/route.ts
│       │   └── sync/route.ts
│       ├── storage/
│       │   ├── upload-url/route.ts # Get signed upload URL
│       │   └── read-url/route.ts   # Get signed read URL
│       ├── processing/
│       │   ├── route.ts            # Start/status of processing jobs
│       │   └── [jobId]/route.ts    # Individual job status
│       ├── ocr/route.ts            # OCR single page/chunk
│       ├── extract/route.ts        # Extract patterns from text
│       ├── classify/route.ts       # Classify content into themes
│       ├── compare/route.ts        # Run comparison analysis
│       ├── generate/route.ts       # Generate notes
│       ├── parameters/route.ts     # Extraction parameters CRUD
│       ├── themes/route.ts
│       ├── projects/
│       │   ├── route.ts
│       │   └── [id]/
│       │       └── sources/route.ts
│       └── models/route.ts
├── components/
│   ├── ui/                         # (exists - shadcn)
│   ├── theme-tree.tsx              # (exists)
│   ├── upload-zone.tsx             # (exists - update for R2)
│   ├── pattern-card.tsx
│   ├── comparison-results.tsx
│   ├── revision-note.tsx
│   ├── notion-connector.tsx        # (exists)
│   ├── processing-status.tsx       # Job progress tracking
│   ├── ocr-viewer.tsx              # View OCR results
│   ├── extracted-content.tsx       # Browse extracted content
│   ├── classification-review.tsx   # Review/adjust classifications
│   └── sync-status.tsx             # Notion sync status
├── lib/
│   ├── utils.ts                    # (exists)
│   ├── storage/
│   │   ├── r2-client.ts            # R2 S3-compatible client
│   │   └── signed-urls.ts          # Upload/read URL generation
│   ├── pdf/
│   │   ├── stream.ts               # Stream PDF from R2
│   │   ├── chunker.ts              # Split PDF into chunks
│   │   └── renderer.ts             # Page to image conversion
│   ├── processing/
│   │   ├── job-manager.ts          # Track processing jobs
│   │   └── queue.ts                # Processing queue management
│   ├── extraction/
│   │   ├── essay-detector.ts       # Detect essay boundaries
│   │   ├── content-extractor.ts    # Extract structured content
│   │   └── quality.ts              # Quality scoring, overused flagging
│   ├── classification/
│   │   ├── classifier.ts           # Theme classification
│   │   ├── cross-theme.ts          # Handle multi-theme content
│   │   └── aggregator.ts           # Aggregate content per theme
│   ├── comparison/
│   │   ├── gap-analyzer.ts         # User vs topper gap analysis
│   │   └── suggestions.ts          # Generate improvement suggestions
│   ├── generation/
│   │   ├── note-generator.ts       # Generate dual-section notes
│   │   ├── formatter.ts            # Format for Notion
│   │   └── conciseness.ts          # Ensure revision-ready output
│   ├── notion/
│   │   ├── client.ts               # (exists)
│   │   ├── parsers.ts              # (exists)
│   │   ├── theme-parser.ts         # (exists)
│   │   ├── content-fetcher.ts      # Fetch user content from Notion
│   │   └── block-builder.ts        # Build Notion blocks for sync
│   └── llm/
│       ├── provider.ts             # (exists)
│       ├── prompts/
│       │   ├── ocr.ts              # OCR prompts
│       │   ├── extraction.ts       # Content extraction prompts
│       │   ├── classification.ts   # Classification prompts
│       │   ├── comparison.ts       # Comparison prompts
│       │   └── generation.ts       # Note generation prompts
│       └── schemas/
│           ├── extraction.ts       # Zod schemas for extraction
│           ├── classification.ts   # Zod schemas for classification
│           └── generation.ts       # Zod schemas for generation
├── types/
│   ├── theme.ts                    # (exists)
│   ├── project.ts                  # (exists)
│   ├── content.ts                  # (exists)
│   ├── settings.ts                 # (exists)
│   ├── extraction.ts               # Extracted content types
│   ├── processing.ts               # Processing job types
│   └── comparison.ts               # Comparison result types
├── .env.local
└── docs/
    ├── plan.md                     # (this file)
    ├── sprints.md                  # Sprint breakdown
    ├── progress.md                 # Progress tracking
    └── learnings.md                # Development learnings
```

---

## Verification Plan

### Foundation (Sprints 1-7) ✅ COMPLETED
1. **Notion Connection**: Enter API key → Test → Show accessible pages
2. **Theme Parsing**: Select theme page → Display hierarchy correctly
3. **File Upload**: Upload PDF → Store in storage → Show preview
4. **LLM Configuration**: Select models per task → Test connection

### Processing Pipeline (Sprints 8-12)
5. **R2 Upload**: Upload 190MB PDF → Stream to R2 → Get signed URL
6. **OCR**: Process PDF pages → Show extracted text per page
7. **Pattern Extraction**: Analyze topper essays → Display structured content
   - Includes per-type markdown highlights rendered via ai-elements
8. **Classification**: Classify content → Show theme mappings → User review
9. **Comparison**: Select theme → See user vs topper content → Gap analysis
10. **Note Generation**: Generate dual-section notes → Preview → Sync to Notion

---

## Implementation Sequence

### Phase 1: Foundation (COMPLETED ✅)

#### Sprints 1-7: Foundation Complete
- [x] Project setup, dependencies, environment
- [x] Notion integration (connection, search, theme parsing)
- [x] Project management (CRUD, content sources)
- [x] File upload infrastructure (Vercel Blob - to migrate to R2)
- [x] LLM infrastructure (OpenRouter, model config)
- [x] Dashboard with stats, quick actions

### Phase 2: Processing Pipeline (IN PROGRESS)

#### Sprint 8: PDF Processing & OCR Infrastructure ✅ COMPLETED
- [x] R2 storage client with signed URLs
- [x] Large file upload (direct browser-to-R2 with progress)
- [x] PDF streaming and page analysis
- [x] OCR API with Gemini Flash 2.0 via OpenRouter
- [x] Processing job management with R2 persistence
- [x] OCR results viewer with search and export

#### Sprint 9: Content Extraction Engine (COMPLETED)
- [x] Essay boundary detection
- [x] Structured content extraction (intros, examples, quotes, etc.)
- [x] Extraction parameters UI (configurable)
- [x] Quality scoring and overused flagging
- [x] Extracted content browser
- [x] Markdown highlights per content type (ai-elements)
- [x] Re-extract action (rerun extraction from OCR without reprocessing PDFs)

#### Sprint 10: Theme Classification
- [ ] Classification prompts and schemas
- [ ] Cross-theme content handling
- [ ] User content fetcher (from Notion)
- [ ] Classification review/adjustment UI
- [ ] Content aggregation per theme

#### Sprint 11: Comparison & Gap Analysis
- [ ] Comparison prompts and logic
- [ ] Per-theme comparison view
- [ ] Gap analysis (user vs topper)
- [ ] Missing content suggestions
- [ ] Comparison results UI

#### Sprint 12: Note Generation & Notion Sync
- [ ] Note generation prompts (dual-section)
- [ ] Conciseness enforcement
- [ ] Notes preview UI
- [ ] Notion destination configuration
- [ ] Notion sync (block builder)
- [ ] Sync status tracking

### Phase 3: Writer Mode (FUTURE)
- [ ] Essay upload and parsing
- [ ] Writing quality evaluation
- [ ] Feedback against topper patterns
- [ ] Improvement suggestions
