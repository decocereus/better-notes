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
bun add ai @ai-sdk/openai zod @vercel/blob
```

- `ai` - Vercel AI SDK for LLM integration
- `@ai-sdk/openai` - OpenRouter-compatible provider
- `zod` - Schema validation for LLM outputs
- `@vercel/blob` - File uploads for PDFs/images

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

# Vercel Blob (for file uploads)
BLOB_READ_WRITE_TOKEN=xxx
```

**Note**: OpenRouter API key is environment-only. Users can only select which models to use per task via the settings dropdown - they cannot view or modify the API key.

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
- Upload handwritten PDFs → OCR via LLM Vision → Extract patterns
- Store: intro techniques, body structure, example types, conclusion styles
- Flag overused examples (Gandhi, Buddha, Ashoka)

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
- Parameters: **Configurable via UI** (user will provide via strategy doc)
- Default extraction criteria (placeholder - user will customize):
  - Relevance to theme
  - Uniqueness of examples
  - Factual accuracy
  - Cross-theme applicability
  - [Additional parameters from strategy doc TBD]

#### Mode 2: Writer Mode (Building LATER)
- Essay writing evaluation
- Parameters for writing quality (structure, flow, etc.)
- Will be implemented in future phase

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
- Input: PDF page image
- Output: Structured text with paragraphs preserved
- Model: `google/gemini-2.0-flash` (vision)

**Pattern Extraction:**
- Input: Topper essay text
- Output: Intro pattern, body structure, examples, conclusion, style markers
- Flag: Overused examples (Gandhi, Buddha, Ashoka, Mandela)
- Model: `anthropic/claude-4.5-sonnet`

**Content Classification (Auto):**
- Input: Content from Notion page (user provides URL) + theme list
- Process: Extract content → LLM classifies into themes/mini-themes
- Output: Theme mappings with relevance scores, cross-references
- Same content can map to multiple themes
- Model: `anthropic/claude-4.5-sonnet` (cost-effective)

**Comparison Analysis (Content Extraction Mode):**
- Input: User content + topper content + extraction parameters
- Output: Side-by-side comparison showing:
  - What user has covered
  - What toppers have that user is missing
  - Gaps and suggestions
- Parameters: Loaded from user's strategy doc (configurable per theme)
- Model: `anthropic/claude-4.5-sonnet`

**Note Generation (Dual-Section):**
- Input: Classified user content + topper essays + themes
- Output per theme:
  1. **Your Notes**: User's content - CONCISE, distilled, organized (not raw)
  2. **Topper Insights**: Enriches user content with what they're missing
- **Balance: Revisability + Quality** - neither compromised
- Both sections must be revision-ready (scannable, not exhaustive)
- Topper content complements, not duplicates user content
- Model: `anthropic/claude-4.5-sonnet`

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
│   │   ├── page.tsx                # Notion setup + mode toggle
│   │   └── parameters/
│   │       └── page.tsx            # Configure extraction parameters
│   ├── projects/
│   │   ├── page.tsx                # List projects
│   │   └── [id]/
│   │       └── page.tsx            # Project workspace
│   ├── themes/
│   │   └── [id]/
│   │       └── page.tsx            # Theme detail
│   ├── upload/
│   │   └── page.tsx                # Upload interface
│   ├── patterns/
│   │   └── page.tsx                # Topper patterns
│   ├── compare/
│   │   └── page.tsx                # Comparison tool
│   ├── notes/
│   │   ├── page.tsx                # All notes
│   │   └── [themeId]/
│   │       └── page.tsx            # Theme notes
│   └── api/
│       ├── notion/
│       │   ├── connect/route.ts
│       │   ├── search/route.ts
│       │   └── sync/route.ts
│       ├── parameters/route.ts     # Extraction parameters CRUD
│       ├── themes/route.ts
│       ├── projects/
│       │   ├── route.ts            # CRUD projects
│       │   └── [id]/
│       │       └── sources/
│       │           └── route.ts    # Add sources to project
│       ├── upload/route.ts
│       ├── extract/route.ts
│       ├── classify/route.ts
│       ├── compare/route.ts
│       └── generate/route.ts
├── components/
│   ├── ui/                         # (exists - shadcn)
│   ├── theme-tree.tsx
│   ├── upload-zone.tsx
│   ├── pattern-card.tsx
│   ├── comparison-results.tsx
│   ├── revision-note.tsx
│   └── notion-connector.tsx
├── lib/
│   ├── utils.ts                    # (exists)
│   ├── notion/
│   │   ├── client.ts               # API client
│   │   ├── parsers.ts              # Block parsing
│   │   └── theme-parser.ts         # Theme extraction
│   └── llm/
│       ├── provider.ts             # OpenRouter setup
│       ├── prompts.ts              # All prompts
│       └── schemas.ts              # Zod schemas
├── types/
│   ├── theme.ts
│   ├── project.ts
│   ├── content.ts
│   ├── pattern.ts
│   └── comparison.ts
├── .env.local                      # (create)
└── plan.md                         # (this file)
```

---

## Verification Plan

1. **Notion Connection**: Enter API key → Test → Show accessible pages
2. **Theme Parsing**: Select theme page → Display hierarchy correctly
3. **File Upload**: Upload PDF → Store in Vercel Blob → Show preview
4. **OCR**: Process PDF → Show extracted text with confidence
5. **Pattern Extraction**: Analyze topper essay → Display patterns
6. **Classification**: Classify notes → Show theme mappings
7. **Comparison**: Run analysis → Display scores and suggestions
8. **Note Generation**: Generate notes → Show formatted output
9. **Notion Sync**: Sync notes → Verify page created in Notion

---

## Implementation Sequence

### Week 1: Foundation
- [ ] Add dependencies (ai, zod, @vercel/blob)
- [ ] Create `lib/notion/client.ts`
- [ ] Create `lib/llm/provider.ts`
- [ ] Create type definitions
- [ ] Build settings page with Notion connection

### Week 2: Theme & Upload
- [ ] Implement theme parsing
- [ ] Build dashboard with theme tree
- [ ] Create upload interface
- [ ] Implement file upload API

### Week 3: Processing Pipeline
- [ ] Implement OCR extraction
- [ ] Implement pattern extraction
- [ ] Build patterns display page
- [ ] Implement content classification

### Week 4: Analysis & Output
- [ ] Implement comparison analysis
- [ ] Build comparison UI with scores
- [ ] Implement note generation
- [ ] Build notes display pages

### Week 5: Polish
- [ ] Implement Notion sync
- [ ] Add cross-theme references
- [ ] Error handling & loading states
- [ ] Testing & refinement
