# BetterNotes - Sprint Breakdown

## Review Summary (Post-Review Updates)

The following improvements were made after subagent review:

### Tasks Added
- **1.0**: TypeScript path alias verification
- **1.6**: App metadata update
- **2.0**: useLocalStorage hook for SSR-safe storage
- **3.7**: Theme page persistence
- **3.8**: Theme refresh capability
- **5.5**: File size validation
- **5.6**: File deletion

### Tasks Split (Too Large)
- **1.5** split into 1.5a, 1.5b, 1.5c (13 pages → 3 groups)

### Key Technical Decisions
- **API Key Strategy**: Store in localStorage, pass to API routes via request body
- **Hydration**: useLocalStorage hook handles SSR/client mismatch
- **Settings Persistence**: useSettings hook for typed settings access

---

## Overview

This document breaks down the project into atomic, committable tasks organized into sprints. Each sprint results in a demoable piece of software that builds on previous work.

**Guiding Principles:**
- Foundation first (Notion integration, UI, infrastructure)
- Strategy-dependent features deferred until strategy document provided
- Each task is atomic and independently testable
- Each sprint produces runnable, demoable software

---

## Sprint 1: Project Foundation & UI Shell

**Goal:** Establish project infrastructure, add dependencies, create basic navigation shell with placeholder pages.

**Demo:** App runs with navigation between pages, basic layout visible.

### Tasks

#### 1.0 Verify TypeScript Path Aliases
**Description:** Ensure `@/` path alias is configured in tsconfig.json for clean imports.

**Files to Modify:**
- `tsconfig.json` (verify/add paths configuration)

**Implementation:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

**Validation:**
- [ ] `import { cn } from '@/lib/utils'` compiles without error
- [ ] All `@/` imports resolve correctly

---

#### 1.1 Add Core Dependencies
**Description:** Install required packages for LLM, file storage, and schema validation.

**Implementation:**
```bash
bun add ai @ai-sdk/openai zod @vercel/blob
```

**Files Changed:**
- `package.json`

**Validation:**
- [ ] `bun install` completes without errors
- [ ] Dependencies appear in `package.json`
- [ ] `bun run dev` still works

---

#### 1.2 Create Environment Configuration
**Description:** Set up environment variables structure and types.

**Implementation:**
- Create `.env.example` with all required variables
- Create `lib/env.ts` for typed environment access

**Files to Create:**
- `.env.example`
- `lib/env.ts`

**Code:**
```typescript
// lib/env.ts
export const env = {
  NOTION_API_KEY: process.env.NOTION_API_KEY || '',
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN || '',
} as const;

export function validateEnv() {
  const missing = Object.entries(env)
    .filter(([_, value]) => !value)
    .map(([key]) => key);
  return { valid: missing.length === 0, missing };
}
```

**Validation:**
- [ ] `.env.example` documents all variables
- [ ] `validateEnv()` correctly identifies missing variables
- [ ] TypeScript compiles without errors

---

#### 1.3 Create Type Definitions - Core Types
**Description:** Define TypeScript interfaces for core domain objects.

**Files to Create:**
- `types/theme.ts`
- `types/project.ts`
- `types/content.ts`
- `types/settings.ts`
- `types/index.ts` (barrel export)

**Code Outline:**
```typescript
// types/theme.ts
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

// types/project.ts
export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sources: ContentSource[];
}

export interface ContentSource {
  id: string;
  type: 'notion' | 'pdf' | 'image' | 'text';
  reference: string; // URL or file path
  addedAt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// types/settings.ts
export interface ModelConfig {
  task: 'ocr' | 'pattern_extraction' | 'classification' | 'comparison' | 'generation';
  modelId: string;
  modelName: string;
}

export interface AppSettings {
  notionConnected: boolean;
  notionApiKey?: string;
  models: ModelConfig[];
  extractionParameters: Record<string, unknown>;
}
```

**Validation:**
- [ ] All type files compile without errors
- [ ] Types are exported from barrel file
- [ ] Import works: `import { MainTheme } from '@/types'`

---

#### 1.4 Create App Layout with Navigation
**Description:** Build main layout with sidebar navigation and header.

**Files to Create:**
- `components/layout/app-shell.tsx`
- `components/layout/sidebar.tsx`
- `components/layout/header.tsx`

**Files to Modify:**
- `app/layout.tsx`

**Implementation:**
- Sidebar with navigation links (Dashboard, Projects, Themes, Settings)
- Header with app title
- Main content area with children slot
- Responsive design (collapsible sidebar on mobile)

**Validation:**
- [ ] Layout renders without errors
- [ ] Navigation links are visible
- [ ] Sidebar collapses on mobile viewport
- [ ] Screenshot comparison or visual inspection

---

#### 1.5a Create Core Pages
**Description:** Create main navigation pages (Dashboard, Projects list, Settings).

**Files to Create/Modify:**
- `app/page.tsx` (Dashboard - modify existing)
- `app/projects/page.tsx`
- `app/settings/page.tsx`
- `app/themes/page.tsx`

**Validation:**
- [ ] All 4 routes accessible without 404
- [ ] Navigation to each page works

---

#### 1.5b Create Dynamic Route Pages
**Description:** Create pages with dynamic [id] parameters.

**Files to Create:**
- `app/projects/[id]/page.tsx`
- `app/themes/[id]/page.tsx`
- `app/notes/[themeId]/page.tsx`
- `app/settings/parameters/page.tsx`
- `app/settings/models/page.tsx`

**Validation:**
- [ ] Dynamic routes render with any ID
- [ ] URL parameters accessible via props

---

#### 1.5c Create Feature Pages
**Description:** Create feature-specific pages.

**Files to Create:**
- `app/upload/page.tsx`
- `app/patterns/page.tsx`
- `app/compare/page.tsx`
- `app/notes/page.tsx`

**Validation:**
- [ ] All feature pages accessible
- [ ] Navigation links work correctly

---

#### 1.6 Update App Metadata
**Description:** Update app title and metadata for BetterNotes branding.

**Files to Modify:**
- `app/layout.tsx`

**Implementation:**
```typescript
export const metadata: Metadata = {
  title: "BetterNotes - UPSC Essay Preparation",
  description: "Intelligent essay preparation assistant for UPSC aspirants",
};
```

**Validation:**
- [ ] Browser tab shows "BetterNotes"
- [ ] Meta description updated

---

#### 1.7 Create Loading and Error States
**Description:** Create reusable loading and error components.

**Files to Create:**
- `components/ui/loading-spinner.tsx`
- `components/ui/error-message.tsx`
- `app/loading.tsx` (global loading)
- `app/error.tsx` (global error boundary)

**Validation:**
- [ ] Loading spinner renders
- [ ] Error message displays with message prop
- [ ] Error boundary catches errors and displays fallback

---

### Sprint 1 Completion Criteria
- [ ] App runs with `bun run dev`
- [ ] All navigation links work
- [ ] All pages render (with placeholder content)
- [ ] TypeScript compiles without errors
- [ ] Layout is responsive

---

## Sprint 2: Notion Integration - Connection & Search

**Goal:** Implement Notion API client with connection testing and workspace search.

**Demo:** User can enter Notion API key, test connection, and search for pages.

### Tasks

#### 2.0 Create useLocalStorage Hook
**Description:** Create a React hook for safe localStorage access with SSR/hydration handling.

**Files to Create:**
- `lib/hooks/use-local-storage.ts`

**Implementation:**
```typescript
// lib/hooks/use-local-storage.ts
'use client';

import { useState, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  // State to store value
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
    }
    setIsHydrated(true);
  }, [key]);

  // Persist to localStorage
  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
```

**Validation:**
- [ ] Hook works in client components
- [ ] No hydration mismatch errors
- [ ] Value persists across page reloads
- [ ] Initial value used before hydration

---

#### 2.1 Create Notion API Client
**Description:** Build a typed Notion API client using REST API (v2025-09-03).

**Files to Create:**
- `lib/notion/client.ts`
- `lib/notion/types.ts`

**Implementation:**
```typescript
// lib/notion/client.ts
const NOTION_VERSION = '2025-09-03';
const BASE_URL = 'https://api.notion.com/v1';

export class NotionClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new NotionAPIError(res.status, error.message || 'Unknown error');
    }

    return res.json();
  }

  async testConnection(): Promise<{ valid: boolean; user?: string }> {
    try {
      const user = await this.request<{ name: string }>('/users/me');
      return { valid: true, user: user.name };
    } catch {
      return { valid: false };
    }
  }

  async search(query: string): Promise<NotionSearchResult> {
    return this.request('/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  }
}

export class NotionAPIError extends Error {
  constructor(public status: number, message: string) {
    super(`Notion API Error (${status}): ${message}`);
  }
}
```

**Validation:**
- [ ] Client instantiates without error
- [ ] `testConnection()` returns valid/invalid correctly
- [ ] `search()` returns results for valid query
- [ ] Proper error handling for invalid API key
- Unit tests:
  - [ ] Test with mocked fetch responses
  - [ ] Test error handling

---

#### 2.2 Create Notion Connection API Route
**Description:** API endpoint to test Notion connection with provided API key.

**Files to Create:**
- `app/api/notion/connect/route.ts`

**Implementation:**
```typescript
// app/api/notion/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NotionClient } from '@/lib/notion/client';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 });
    }

    const client = new NotionClient(apiKey);
    const result = await client.testConnection();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Connection failed' }, { status: 500 });
  }
}
```

**Validation:**
- [ ] POST with valid API key returns `{ valid: true, user: "..." }`
- [ ] POST with invalid API key returns `{ valid: false }`
- [ ] POST without API key returns 400 error
- API tests:
  - [ ] Test with curl or API client
  - [ ] Test error cases

---

#### 2.3 Create Notion Search API Route
**Description:** API endpoint to search Notion workspace.

**Files to Create:**
- `app/api/notion/search/route.ts`

**Implementation:**
```typescript
// app/api/notion/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NotionClient } from '@/lib/notion/client';
import { env } from '@/lib/env';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    const client = new NotionClient(env.NOTION_API_KEY);
    const results = await client.search(query || '');

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
```

**Validation:**
- [ ] POST returns search results
- [ ] Empty query returns all accessible pages
- [ ] Results include page titles and IDs

---

#### 2.4 Create Settings Page - Notion Connection UI
**Description:** Build UI for connecting Notion account.

**Files to Modify:**
- `app/settings/page.tsx`

**Files to Create:**
- `components/notion-connector.tsx`

**Implementation:**
- Input field for API key (masked input)
- "Test Connection" button
- Connection status indicator (connected/disconnected)
- Instructions for creating Notion integration
- Store API key in localStorage using `useLocalStorage` hook
- **Note**: API routes will receive API key from request body (not env var) during development

**API Key Strategy:**
- Development: Store in localStorage, pass to API routes via request body
- Production: User can optionally set NOTION_API_KEY env var
- API routes accept both: env var OR request body

**Validation:**
- [ ] Can enter API key
- [ ] API key is masked (password input)
- [ ] Test button triggers connection test
- [ ] Success/failure message displayed
- [ ] API key persisted to localStorage using hook
- [ ] Connection status shown on page load

---

#### 2.5 Create Notion Page Search Component
**Description:** Search input with results dropdown for finding Notion pages.

**Files to Create:**
- `components/notion-page-search.tsx`

**Implementation:**
- Search input with debounce (300ms)
- Dropdown showing matching pages
- Page icon, title, and type (page/database)
- Click to select page
- Loading state while searching

**Validation:**
- [ ] Typing triggers search after debounce
- [ ] Results displayed in dropdown
- [ ] Can select a page
- [ ] Loading spinner shown during search
- [ ] Empty state when no results

---

### Sprint 2 Completion Criteria
- [ ] User can enter Notion API key in settings
- [ ] Connection test works and shows status
- [ ] Can search for Notion pages
- [ ] API routes return correct data
- [ ] Error states handled gracefully

---

## Sprint 3: Notion Integration - Page Content & Theme Parsing

**Goal:** Fetch and parse Notion page content, specifically theme hierarchy.

**Demo:** User can select theme page and see parsed theme hierarchy displayed.

### Tasks

#### 3.1 Add Notion Block Fetching to Client
**Description:** Extend Notion client to fetch page blocks recursively.

**Files to Modify:**
- `lib/notion/client.ts`

**Files to Create:**
- `lib/notion/parsers.ts`

**Implementation:**
```typescript
// Add to NotionClient
async getPageContent(pageId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const response = await this.request<NotionBlocksResponse>(
      `/blocks/${pageId}/children${cursor ? `?start_cursor=${cursor}` : ''}`
    );
    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return blocks;
}

async getBlockChildren(blockId: string): Promise<NotionBlock[]> {
  // Same pagination logic
}
```

**Validation:**
- [ ] Fetches all blocks from a page
- [ ] Handles pagination correctly
- [ ] Returns typed block objects
- Unit tests:
  - [ ] Test with mocked paginated responses

---

#### 3.2 Create Block Content Parser
**Description:** Parse different Notion block types to extract text content.

**Files to Create:**
- `lib/notion/block-parser.ts`

**Implementation:**
```typescript
// lib/notion/block-parser.ts
export function extractBlockText(block: NotionBlock): string {
  const richTextBlocks = [
    'paragraph', 'heading_1', 'heading_2', 'heading_3',
    'bulleted_list_item', 'numbered_list_item', 'toggle', 'quote'
  ];

  if (richTextBlocks.includes(block.type)) {
    const content = block[block.type as keyof NotionBlock];
    if (content && 'rich_text' in content) {
      return content.rich_text.map((rt: RichText) => rt.plain_text).join('');
    }
  }

  // Handle special blocks
  switch (block.type) {
    case 'child_page':
      return block.child_page.title;
    case 'child_database':
      return block.child_database.title;
    default:
      return '';
  }
}

export function parseBlocksToText(blocks: NotionBlock[]): string {
  return blocks.map(extractBlockText).filter(Boolean).join('\n');
}
```

**Validation:**
- [ ] Extracts text from paragraph blocks
- [ ] Extracts text from heading blocks
- [ ] Extracts text from list items
- [ ] Handles toggle blocks
- [ ] Returns empty string for unsupported types
- Unit tests:
  - [ ] Test each block type

---

#### 3.3 Create Theme Parser
**Description:** Parse theme page structure into hierarchy (Main Theme → Mini Theme → Questions).

**Files to Create:**
- `lib/notion/theme-parser.ts`

**Implementation:**
```typescript
// lib/notion/theme-parser.ts
import { MainTheme, MiniTheme, EssayQuestion } from '@/types';

export async function parseThemePage(
  client: NotionClient,
  pageId: string
): Promise<MainTheme[]> {
  const blocks = await client.getPageContent(pageId);
  return parseThemeBlocks(blocks, client);
}

async function parseThemeBlocks(
  blocks: NotionBlock[],
  client: NotionClient
): Promise<MainTheme[]> {
  const themes: MainTheme[] = [];
  let currentMainTheme: MainTheme | null = null;
  let currentMiniTheme: MiniTheme | null = null;

  for (const block of blocks) {
    const text = extractBlockText(block);

    // Detect main theme (toggle or h1)
    if (block.type === 'toggle' || block.type === 'heading_1') {
      currentMainTheme = {
        id: block.id,
        title: text,
        miniThemes: [],
      };
      themes.push(currentMainTheme);
      currentMiniTheme = null;

      // If toggle, parse children for mini themes
      if (block.type === 'toggle' && block.has_children) {
        const children = await client.getBlockChildren(block.id);
        currentMainTheme.miniThemes = await parseMiniThemes(children, client, currentMainTheme.id);
      }
    }
    // Detect mini theme (nested toggle or h2)
    else if ((block.type === 'toggle' || block.type === 'heading_2') && currentMainTheme) {
      currentMiniTheme = {
        id: block.id,
        parentId: currentMainTheme.id,
        title: text,
        questions: [],
      };
      currentMainTheme.miniThemes.push(currentMiniTheme);

      if (block.type === 'toggle' && block.has_children) {
        const children = await client.getBlockChildren(block.id);
        currentMiniTheme.questions = parseQuestions(children);
      }
    }
    // Detect questions (bullet points with year pattern)
    else if (isQuestionBlock(block) && currentMiniTheme) {
      const question = parseQuestion(text);
      if (question) {
        currentMiniTheme.questions.push(question);
      }
    }
  }

  return themes;
}

function parseQuestion(text: string): EssayQuestion | null {
  const match = text.match(/^(\d{4}):\s*(.+)$/);
  if (!match) return null;

  return {
    id: crypto.randomUUID(),
    year: parseInt(match[1], 10),
    text: match[2].trim(),
    fullText: text,
  };
}
```

**Validation:**
- [ ] Parses heading-based structure
- [ ] Parses toggle-based structure
- [ ] Extracts year from question text
- [ ] Builds correct hierarchy
- Unit tests:
  - [ ] Test with sample block structures
- Integration test:
  - [ ] Test with real Notion page (manual)

---

#### 3.4 Create Themes API Route
**Description:** API endpoint to fetch and parse themes from configured Notion page.

**Files to Create:**
- `app/api/themes/route.ts`

**Implementation:**
```typescript
// app/api/themes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { NotionClient } from '@/lib/notion/client';
import { parseThemePage } from '@/lib/notion/theme-parser';
import { env } from '@/lib/env';

export async function GET(request: NextRequest) {
  const pageId = request.nextUrl.searchParams.get('pageId');

  if (!pageId) {
    return NextResponse.json({ error: 'pageId required' }, { status: 400 });
  }

  try {
    const client = new NotionClient(env.NOTION_API_KEY);
    const themes = await parseThemePage(client, pageId);

    return NextResponse.json({ themes });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse themes' }, { status: 500 });
  }
}
```

**Validation:**
- [ ] GET with pageId returns parsed themes
- [ ] Returns 400 if pageId missing
- [ ] Returns 500 on parse errors

---

#### 3.5 Create Theme Tree Component
**Description:** Collapsible tree view for displaying theme hierarchy.

**Files to Create:**
- `components/theme-tree.tsx`

**Implementation:**
- Collapsible main themes (accordion style)
- Nested mini themes (also collapsible)
- Questions with year badges
- Click handlers for selection
- Search/filter capability

**Validation:**
- [ ] Renders theme hierarchy correctly
- [ ] Collapse/expand works
- [ ] Year badges displayed
- [ ] Can select themes
- [ ] Search filters themes

---

#### 3.6 Create Themes Page with Data Fetching
**Description:** Page that displays parsed themes from selected Notion page.

**Files to Modify:**
- `app/themes/page.tsx`

**Implementation:**
- Page selector (if no theme page configured)
- Theme tree display
- Loading state while fetching
- Error state if parsing fails
- Stats (total themes, questions, years covered)

**Validation:**
- [ ] Shows page selector if not configured
- [ ] Fetches and displays themes
- [ ] Loading spinner while fetching
- [ ] Error message if fetch fails
- [ ] Stats displayed correctly

---

#### 3.7 Persist Theme Page Configuration
**Description:** Save selected theme page ID to localStorage so it persists.

**Files to Create:**
- `lib/hooks/use-settings.ts`

**Implementation:**
```typescript
// lib/hooks/use-settings.ts
'use client';

import { useLocalStorage } from './use-local-storage';

interface AppSettings {
  notionApiKey?: string;
  themePageId?: string;
  strategyPageId?: string;
  outputPageId?: string;
}

export function useSettings() {
  const [settings, setSettings] = useLocalStorage<AppSettings>('betternotes:settings', {});

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  return { settings, updateSetting };
}
```

**Validation:**
- [ ] Theme page ID persists after page reload
- [ ] Settings hook provides typed access
- [ ] Can update individual settings

---

#### 3.8 Add Theme Refresh Capability
**Description:** Button to re-fetch themes from Notion (if page content updated).

**Files to Modify:**
- `app/themes/page.tsx`

**Implementation:**
- "Refresh Themes" button
- Shows loading state while refetching
- Updates display with new data
- Toast/notification on success/failure

**Validation:**
- [ ] Refresh button visible
- [ ] Click triggers refetch
- [ ] UI updates with new data
- [ ] Loading state shown during fetch

---

### Sprint 3 Completion Criteria
- [ ] Can select a Notion page as theme source
- [ ] Theme page selection persists
- [ ] Themes parsed into correct hierarchy
- [ ] Theme tree displays with collapse/expand
- [ ] Questions show with year badges
- [ ] Can refresh themes from Notion
- [ ] Loading and error states work

---

## Sprint 4: Project Management

**Goal:** Implement project creation, listing, and content source management.

**Demo:** User can create projects and add Notion page URLs as content sources.

### Tasks

#### 4.1 Create Local Storage Persistence Layer
**Description:** Utility for persisting data to localStorage with type safety.

**Files to Create:**
- `lib/storage.ts`

**Implementation:**
```typescript
// lib/storage.ts
export class LocalStorage<T> {
  constructor(private key: string, private defaultValue: T) {}

  get(): T {
    if (typeof window === 'undefined') return this.defaultValue;
    const stored = localStorage.getItem(this.key);
    return stored ? JSON.parse(stored) : this.defaultValue;
  }

  set(value: T): void {
    localStorage.setItem(this.key, JSON.stringify(value));
  }

  update(updater: (current: T) => T): void {
    this.set(updater(this.get()));
  }
}

// Instances
export const projectsStorage = new LocalStorage<Project[]>('betternotes:projects', []);
export const settingsStorage = new LocalStorage<AppSettings>('betternotes:settings', defaultSettings);
```

**Validation:**
- [ ] get() returns default when empty
- [ ] set() persists data
- [ ] update() modifies existing data
- [ ] Works with complex objects
- Unit tests:
  - [ ] Test CRUD operations

---

#### 4.2 Create Projects API Routes
**Description:** CRUD API for projects.

**Files to Create:**
- `app/api/projects/route.ts`
- `app/api/projects/[id]/route.ts`
- `app/api/projects/[id]/sources/route.ts`

**Implementation:**
```typescript
// app/api/projects/route.ts
// GET - list all projects
// POST - create new project

// app/api/projects/[id]/route.ts
// GET - get single project
// PUT - update project
// DELETE - delete project

// app/api/projects/[id]/sources/route.ts
// POST - add content source to project
// DELETE - remove content source
```

**Validation:**
- [ ] Can create project
- [ ] Can list projects
- [ ] Can get single project
- [ ] Can add source to project
- [ ] Can delete project
- API tests for each endpoint

---

#### 4.3 Create Projects List Page
**Description:** Page showing all projects with create button.

**Files to Modify:**
- `app/projects/page.tsx`

**Files to Create:**
- `components/project-card.tsx`
- `components/create-project-dialog.tsx`

**Implementation:**
- Grid/list of project cards
- Each card shows: name, created date, source count
- "New Project" button opens dialog
- Click card navigates to project detail

**Validation:**
- [ ] Projects list displayed
- [ ] Can create new project via dialog
- [ ] Cards show correct info
- [ ] Navigation works

---

#### 4.4 Create Project Detail Page
**Description:** Workspace page for a single project.

**Files to Modify:**
- `app/projects/[id]/page.tsx`

**Files to Create:**
- `components/add-source-dialog.tsx`
- `components/source-list.tsx`

**Implementation:**
- Project header (name, edit button)
- "Add Content Source" button
- List of added sources (Notion pages, files)
- Source status indicators (pending, processing, completed)
- Delete source button

**Validation:**
- [ ] Shows project details
- [ ] Can add Notion page as source
- [ ] Sources listed with status
- [ ] Can remove sources

---

#### 4.5 Create Notion Page Fetcher
**Description:** Fetch content from a Notion page URL and extract text.

**Files to Create:**
- `lib/notion/page-fetcher.ts`

**Implementation:**
```typescript
// lib/notion/page-fetcher.ts
export function extractPageIdFromUrl(url: string): string | null {
  // Handle various Notion URL formats
  const patterns = [
    /notion\.so\/.*?([a-f0-9]{32})/i,
    /notion\.so\/.*?([a-f0-9-]{36})/i,
    /^([a-f0-9]{32})$/i,
    /^([a-f0-9-]{36})$/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1].replace(/-/g, '');
  }
  return null;
}

export async function fetchPageContent(
  client: NotionClient,
  pageIdOrUrl: string
): Promise<{ title: string; content: string; blocks: NotionBlock[] }> {
  const pageId = extractPageIdFromUrl(pageIdOrUrl) || pageIdOrUrl;

  // Get page metadata
  const page = await client.getPage(pageId);
  const title = extractPageTitle(page);

  // Get all blocks
  const blocks = await client.getPageContent(pageId);
  const content = parseBlocksToText(blocks);

  return { title, content, blocks };
}
```

**Validation:**
- [ ] Extracts page ID from various URL formats
- [ ] Fetches page title
- [ ] Fetches all block content
- [ ] Returns combined text
- Unit tests:
  - [ ] URL parsing tests

---

### Sprint 4 Completion Criteria
- [ ] Can create and list projects
- [ ] Can add Notion pages as content sources
- [ ] Page content fetched and stored
- [ ] Source status tracking works
- [ ] Project detail page functional

---

## Sprint 5: File Upload Infrastructure

**Goal:** Implement file upload for PDFs and images using Vercel Blob.

**Demo:** User can upload PDF/image files to a project.

### Tasks

#### 5.1 Create File Upload API Route
**Description:** Handle file uploads to Vercel Blob storage.

**Files to Create:**
- `app/api/upload/route.ts`

**Implementation:**
```typescript
// app/api/upload/route.ts
import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('projectId') as string;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  // Upload to Vercel Blob
  const blob = await put(`${projectId}/${file.name}`, file, {
    access: 'public',
  });

  return NextResponse.json({
    url: blob.url,
    filename: file.name,
    size: file.size,
    type: file.type,
  });
}
```

**Validation:**
- [ ] Accepts PDF files
- [ ] Accepts PNG/JPEG images
- [ ] Rejects other file types
- [ ] Returns blob URL
- [ ] File accessible at returned URL

---

#### 5.2 Create Upload Zone Component
**Description:** Drag-and-drop file upload component.

**Files to Create:**
- `components/upload-zone.tsx`

**Implementation:**
- Drag-and-drop area
- Click to browse files
- File type validation
- Upload progress indicator
- Preview for images
- File name display

**Validation:**
- [ ] Drag-and-drop works
- [ ] Click to browse works
- [ ] Shows upload progress
- [ ] Displays file preview/name
- [ ] Invalid files rejected with message

---

#### 5.3 Integrate File Upload into Project
**Description:** Add file upload option to project content sources.

**Files to Modify:**
- `components/add-source-dialog.tsx`

**Implementation:**
- Tab interface: "Notion Page" | "Upload File"
- File upload tab uses UploadZone
- After upload, adds as content source
- Shows uploaded files in source list

**Validation:**
- [ ] Can switch between Notion and file upload
- [ ] Files upload successfully
- [ ] Uploaded files appear in sources list
- [ ] Can view uploaded files

---

#### 5.4 Create Upload Page
**Description:** Dedicated page for bulk file uploads.

**Files to Modify:**
- `app/upload/page.tsx`

**Implementation:**
- Multiple file upload support
- Select target project
- Upload queue with progress
- Batch upload results

**Validation:**
- [ ] Can upload multiple files
- [ ] Progress shown per file
- [ ] Success/failure indicated
- [ ] Files added to selected project

---

#### 5.5 Add File Size Validation
**Description:** Client-side validation for file size limits.

**Files to Modify:**
- `components/upload-zone.tsx`

**Implementation:**
- Max file size: 10MB (Vercel Blob limit consideration)
- Show error for oversized files before upload attempt
- Display file size in human-readable format

**Validation:**
- [ ] Files over 10MB rejected with message
- [ ] File size shown during selection
- [ ] Error message is user-friendly

---

#### 5.6 Add File Deletion
**Description:** Allow users to delete uploaded files from project.

**Files to Create:**
- `app/api/upload/[id]/route.ts`

**Files to Modify:**
- `components/source-list.tsx`

**Implementation:**
- DELETE endpoint for removing files from Vercel Blob
- Delete button on each file in source list
- Confirmation dialog before deletion
- Remove from project sources after successful delete

**Validation:**
- [ ] Delete button visible per file
- [ ] Confirmation dialog appears
- [ ] File removed from Blob storage
- [ ] File removed from project sources
- [ ] UI updates after deletion

---

### Sprint 5 Completion Criteria
- [ ] Can upload PDFs and images
- [ ] Files stored in Vercel Blob
- [ ] Upload progress visible
- [ ] Files appear as content sources
- [ ] Bulk upload works
- [ ] File size limits enforced
- [ ] Can delete uploaded files

---

## Sprint 6: LLM Infrastructure & Model Configuration

**Goal:** Set up LLM provider with OpenRouter and create model configuration UI.

**Demo:** User can configure which models to use for different tasks.

### Tasks

#### 6.1 Create LLM Provider Setup
**Description:** Configure AI SDK with OpenRouter.

**Files to Create:**
- `lib/llm/provider.ts`

**Implementation:**
```typescript
// lib/llm/provider.ts
import { createOpenAI } from '@ai-sdk/openai';

export function createLLMProvider() {
  return createOpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
  });
}

export const AVAILABLE_MODELS = [
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', capabilities: ['text', 'vision'] },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', capabilities: ['text'] },
  { id: 'google/gemini-2.0-flash', name: 'Gemini 2.0 Flash', capabilities: ['text', 'vision'] },
  { id: 'openai/gpt-4o', name: 'GPT-4o', capabilities: ['text', 'vision'] },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', capabilities: ['text', 'vision'] },
] as const;

export const TASK_TYPES = [
  { id: 'ocr', name: 'OCR / Text Extraction', requiresVision: true },
  { id: 'pattern_extraction', name: 'Pattern Extraction', requiresVision: false },
  { id: 'classification', name: 'Content Classification', requiresVision: false },
  { id: 'comparison', name: 'Comparison Analysis', requiresVision: false },
  { id: 'generation', name: 'Note Generation', requiresVision: false },
] as const;

export const DEFAULT_MODEL_CONFIG: Record<string, string> = {
  ocr: 'google/gemini-2.0-flash',
  pattern_extraction: 'anthropic/claude-3.5-sonnet',
  classification: 'anthropic/claude-3-haiku',
  comparison: 'anthropic/claude-3.5-sonnet',
  generation: 'anthropic/claude-3.5-sonnet',
};
```

**Validation:**
- [ ] Provider creates successfully
- [ ] Models list is accurate
- [ ] Default config covers all tasks
- [ ] Vision models flagged correctly

---

#### 6.2 Create Model Configuration API Route
**Description:** API for getting and updating model configuration.

**Files to Create:**
- `app/api/models/route.ts`

**Implementation:**
```typescript
// app/api/models/route.ts
// GET - return current model config
// POST - update model config
```

**Validation:**
- [ ] GET returns current config
- [ ] POST updates config
- [ ] Invalid model IDs rejected
- [ ] Config persisted

---

#### 6.3 Create Model Configuration Page
**Description:** UI for selecting models per task via dropdown.

**Files to Modify:**
- `app/settings/models/page.tsx`

**Files to Create:**
- `components/model-selector.tsx`

**Implementation:**
- List of tasks with current model selection
- **Dropdown to select model per task** (no API key input - key is in env var)
- Available models loaded from `AVAILABLE_MODELS` constant
- Only show vision-capable models for OCR task
- Save button persists selection to localStorage
- Reset to defaults button
- **Note**: OpenRouter API key is stored in environment variable only (OPENROUTER_API_KEY)
- User cannot view or modify the API key

**Validation:**
- [ ] All tasks displayed with dropdowns
- [ ] Dropdown shows available models
- [ ] Can change model per task
- [ ] Vision filter works for OCR (only vision models shown)
- [ ] Changes persist after save
- [ ] Reset restores defaults
- [ ] No API key input visible anywhere

---

#### 6.4 Create LLM Test Utility
**Description:** Simple test to verify LLM connection works.

**Files to Create:**
- `lib/llm/test.ts`
- `app/api/llm/test/route.ts`

**Implementation:**
```typescript
// Simple completion test
export async function testLLMConnection(modelId: string): Promise<{
  success: boolean;
  responseTime: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const provider = createLLMProvider();
    const model = provider(modelId);
    const result = await generateText({
      model,
      prompt: 'Say "Hello, BetterNotes!" in exactly those words.',
      maxTokens: 20,
    });
    return {
      success: result.text.includes('Hello'),
      responseTime: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - start,
      error: String(error),
    };
  }
}
```

**Validation:**
- [ ] Test passes with valid API key
- [ ] Test fails gracefully with invalid key
- [ ] Response time measured
- [ ] Error message captured

---

#### 6.5 Add LLM Test to Settings
**Description:** Add "Test Connection" button for LLM in settings.

**Files to Modify:**
- `app/settings/models/page.tsx`

**Implementation:**
- "Test Connection" button per model
- Shows response time on success
- Shows error on failure
- Loading state during test

**Validation:**
- [ ] Test button triggers API call
- [ ] Success shows response time
- [ ] Failure shows error message
- [ ] Loading spinner during test

---

### Sprint 6 Completion Criteria
- [ ] LLM provider configured with OpenRouter
- [ ] Can select models per task
- [ ] Model config persists
- [ ] Can test LLM connection
- [ ] Vision models filtered for OCR task

---

## Sprint 7: Dashboard & Overview (Foundation Complete)

**Goal:** Build functional dashboard showing overview of all data.

**Demo:** Dashboard shows themes summary, recent projects, and system status.

### Tasks

#### 7.1 Create Dashboard Stats Component
**Description:** Display key statistics.

**Files to Create:**
- `components/dashboard-stats.tsx`

**Implementation:**
- Total themes count
- Total questions count
- Total projects count
- Connected services status (Notion, LLM)

**Validation:**
- [ ] Stats displayed correctly
- [ ] Updates when data changes
- [ ] Loading state

---

#### 7.2 Create Recent Projects Component
**Description:** Show recently updated projects.

**Files to Create:**
- `components/recent-projects.tsx`

**Implementation:**
- List of 5 most recent projects
- Shows name, last updated, source count
- Click to navigate to project
- "View All" link

**Validation:**
- [ ] Shows recent projects
- [ ] Sorted by updated date
- [ ] Navigation works

---

#### 7.3 Create Quick Actions Component
**Description:** Quick action buttons for common tasks.

**Files to Create:**
- `components/quick-actions.tsx`

**Implementation:**
- "New Project" button
- "Upload Files" button
- "View Themes" button
- "Settings" button

**Validation:**
- [ ] Buttons navigate correctly
- [ ] Actions work

---

#### 7.4 Build Dashboard Page
**Description:** Assemble dashboard with all components.

**Files to Modify:**
- `app/page.tsx`

**Implementation:**
- Grid layout
- Stats at top
- Recent projects section
- Quick actions section
- Setup wizard if not configured

**Validation:**
- [ ] All sections displayed
- [ ] Responsive layout
- [ ] Data loads correctly
- [ ] Setup prompt if unconfigured

---

### Sprint 7 Completion Criteria
- [ ] Dashboard shows all sections
- [ ] Stats are accurate
- [ ] Quick actions work
- [ ] Recent projects listed
- [ ] Setup wizard for new users

---

## Future Considerations

---

## Sprint 8: PDF Processing & OCR Infrastructure

**Goal:** Process large PDFs (190MB+) with R2 storage and OCR via LLM Vision.

**Demo:** Upload 190MB topper PDF → see pages processing with progress → view extracted text per page.

### Tasks

#### 8.1 Create R2 Storage Client
**Description:** Set up Cloudflare R2 client with S3-compatible SDK.

**Files to Create:**
- `lib/storage/r2-client.ts`

**Implementation:**
```typescript
// lib/storage/r2-client.ts
import { S3Client } from '@aws-sdk/client-s3';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET = process.env.R2_BUCKET_NAME!;
```

**Validation:**
- [ ] Client instantiates without error
- [ ] Can connect to R2 bucket
- [ ] Environment variables documented

---

#### 8.2 Create Signed URL Utilities
**Description:** Generate signed URLs for upload and read operations.

**Files to Create:**
- `lib/storage/signed-urls.ts`

**Implementation:**
```typescript
// lib/storage/signed-urls.ts
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function getUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}

export async function getReadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  return getSignedUrl(r2Client, command, { expiresIn });
}
```

**Validation:**
- [ ] Upload URL allows browser direct upload
- [ ] Read URL allows file download
- [ ] URLs expire after specified time
- Unit tests:
  - [ ] URL generation with mocked client

---

#### 8.3 Create Upload URL API Route
**Description:** API endpoint to get signed upload URL for browser direct upload.

**Files to Create:**
- `app/api/storage/upload-url/route.ts`

**Implementation:**
```typescript
// Returns signed URL for browser to upload directly to R2
// No file passes through server - better for large files
export async function POST(request: NextRequest) {
  const { filename, contentType, projectId } = await request.json();
  const key = `projects/${projectId}/${Date.now()}-${filename}`;
  const uploadUrl = await getUploadUrl(key, contentType);
  return NextResponse.json({ uploadUrl, key });
}
```

**Validation:**
- [ ] Returns valid signed URL
- [ ] Browser can upload directly to URL
- [ ] File appears in R2 bucket

---

#### 8.4 Create Read URL API Route
**Description:** API endpoint to get signed read URL for accessing files.

**Files to Create:**
- `app/api/storage/read-url/route.ts`

**Implementation:**
```typescript
export async function POST(request: NextRequest) {
  const { key } = await request.json();
  const readUrl = await getReadUrl(key);
  return NextResponse.json({ readUrl });
}
```

**Validation:**
- [ ] Returns valid signed URL
- [ ] URL allows file access
- [ ] URL expires correctly

---

#### 8.5 Update Upload Zone for R2
**Description:** Modify UploadZone to use R2 direct upload instead of Vercel Blob.

**Files to Modify:**
- `components/upload-zone.tsx`

**Implementation:**
- Request signed URL from API
- Upload directly to R2 from browser
- Show upload progress (XMLHttpRequest for progress events)
- Handle large files (190MB+)

**Validation:**
- [ ] Large files (190MB) upload successfully
- [ ] Progress bar shows actual progress
- [ ] Upload completes without timeout
- [ ] File accessible via read URL

---

#### 8.6 Create PDF Streaming Utility
**Description:** Stream PDF from R2 for processing without loading entire file.

**Files to Create:**
- `lib/pdf/stream.ts`

**Implementation:**
```typescript
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function streamPdfFromR2(key: string): Promise<ReadableStream> {
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });
  const response = await r2Client.send(command);
  return response.Body as ReadableStream;
}
```

**Validation:**
- [ ] Can stream large PDF
- [ ] Memory usage stays bounded
- [ ] Stream can be piped to processing

---

#### 8.7 Create PDF Page Renderer
**Description:** Convert PDF pages to images for OCR.

**Files to Create:**
- `lib/pdf/renderer.ts`

**Implementation:**
- Use pdf.js or similar for page extraction
- Convert pages to PNG images
- Handle page-by-page to manage memory
- Return base64 or buffer for LLM

**Validation:**
- [ ] Extracts individual pages
- [ ] Images are readable quality
- [ ] Handles multi-hundred page PDFs

---

#### 8.8 Create Processing Job Types
**Description:** Define types for processing job management.

**Files to Create:**
- `types/processing.ts`

**Implementation:**
```typescript
export interface ProcessingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  type: 'ocr' | 'extraction' | 'classification';
  progress: number;
  totalItems: number;
  processedItems: number;
  sourceKey: string;       // R2 key
  results: unknown[];
  errors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OcrResult {
  pageNumber: number;
  text: string;
  confidence: number;
}
```

**Validation:**
- [ ] Types compile without errors
- [ ] Types exported from barrel

---

#### 8.9 Create Processing Job Manager
**Description:** Manage processing jobs with status tracking.

**Files to Create:**
- `lib/processing/job-manager.ts`

**Implementation:**
```typescript
// Store jobs in Notion database or localStorage for MVP
export class JobManager {
  async createJob(type: string, sourceKey: string): Promise<ProcessingJob>;
  async updateProgress(jobId: string, progress: number): Promise<void>;
  async addResult(jobId: string, result: unknown): Promise<void>;
  async completeJob(jobId: string): Promise<void>;
  async failJob(jobId: string, error: string): Promise<void>;
  async getJob(jobId: string): Promise<ProcessingJob | null>;
  async listJobs(): Promise<ProcessingJob[]>;
}
```

**Validation:**
- [ ] Can create and track jobs
- [ ] Progress updates work
- [ ] Job status transitions correctly
- Unit tests for job lifecycle

---

#### 8.10 Create OCR API Route
**Description:** OCR endpoint that processes PDF pages with Gemini Vision.

**Files to Create:**
- `app/api/ocr/route.ts`

**Implementation:**
```typescript
// POST: Start OCR job for a PDF
// GET: Get OCR results for a job
export async function POST(request: NextRequest) {
  const { sourceKey, projectId } = await request.json();

  // Create job
  const job = await jobManager.createJob('ocr', sourceKey);

  // Process in background (or queue)
  processOcrJob(job.id, sourceKey);

  return NextResponse.json({ jobId: job.id });
}

async function processOcrJob(jobId: string, sourceKey: string) {
  // Stream PDF from R2
  // For each page: render to image → send to Gemini → store result
  // Update job progress
}
```

**Validation:**
- [ ] Starts OCR job
- [ ] Processes pages incrementally
- [ ] Returns job ID for tracking
- [ ] Results stored correctly

---

#### 8.11 Create Processing Status Component
**Description:** UI component showing processing job progress.

**Files to Create:**
- `components/processing-status.tsx`

**Implementation:**
- Progress bar with percentage
- Page count (X of Y pages)
- Status badge (pending, processing, completed, failed)
- Error display if failed
- Auto-refresh while processing

**Validation:**
- [ ] Shows accurate progress
- [ ] Updates in real-time
- [ ] Handles error states
- [ ] Completion state clear

---

#### 8.12 Create OCR Viewer Component
**Description:** View OCR results page by page.

**Files to Create:**
- `components/ocr-viewer.tsx`

**Implementation:**
- Page navigation (prev/next)
- Side-by-side: original image + extracted text
- Text editing capability (for corrections)
- Export/copy text

**Validation:**
- [ ] Can navigate pages
- [ ] Shows image and text together
- [ ] Text is editable
- [ ] Can export results

---

#### 8.13 Integrate OCR into Upload Flow
**Description:** After upload, prompt user to start OCR processing.

**Files to Modify:**
- `app/upload/page.tsx`
- `components/upload-content.tsx`

**Implementation:**
- After successful upload, show "Start OCR" button
- Navigate to processing status page
- Show results when complete

**Validation:**
- [ ] Upload → OCR flow is seamless
- [ ] User can track progress
- [ ] Results viewable after completion

---

### Sprint 8 Completion Criteria ✅ COMPLETED
- [x] Can upload 190MB PDF to R2
- [x] PDF streams from R2 for processing
- [x] OCR extracts text from handwritten pages
- [x] Processing progress visible to user
- [x] OCR results viewable and exportable
- [ ] All tests passing (pending - Sprint 8 infrastructure tests)

---

## Sprint 9: Content Extraction Engine ✅ COMPLETED

**Goal:** Extract structured content (intros, examples, quotes, etc.) from OCR'd text.

**Demo:** OCR'd text → extracted intros, examples, quotes with categories → configurable parameters.

### Tasks

#### 9.1 Create Extraction Types
**Description:** Define types for extracted content.

**Files to Create:**
- `types/extraction.ts`

**Implementation:**
```typescript
export type ContentType =
  | 'introduction'
  | 'conclusion'
  | 'example'
  | 'quote'
  | 'thinker'
  | 'argument'
  | 'book_poem'
  | 'keyword_phrase';

export type ExampleCategory =
  | 'individual'
  | 'ethical'
  | 'governance'
  | 'societal'
  | 'environment'
  | 'mythological'
  | 'sports'
  | 'religion'
  | 'business'
  | 'international_relations'
  | 'science_tech';

export interface ExtractedContent {
  id: string;
  sourceType: 'topper' | 'user';
  sourceRef: string;
  contentType: ContentType;
  exampleCategory?: ExampleCategory;
  content: string;
  context?: string;
  quality: 'high' | 'medium' | 'low';
  isOverused: boolean;
  multiUse: boolean;
  themes: ThemeMapping[];
  createdAt: string;
}

export interface ThemeMapping {
  mainThemeId: string;
  miniThemeId: string;
  relevanceScore: number;
}

export interface ExtractionParameters {
  enabledCategories: ExampleCategory[];
  thinkerPriority: 'indian' | 'western' | 'balanced';
  quoteStyle: 'multi_use_preferred' | 'theme_specific';
  overusedExamples: string[];
  minQualityThreshold: 'high' | 'medium' | 'low';
}
```

**Validation:**
- [ ] Types compile without errors
- [ ] Covers all content types from strategy doc
- [ ] Exported from barrel

---

#### 9.2 Create Essay Boundary Detector
**Description:** Detect where essays start and end in OCR'd text.

**Files to Create:**
- `lib/extraction/essay-detector.ts`

**Implementation:**
```typescript
export interface EssayBoundary {
  startPage: number;
  endPage: number;
  title?: string;
  wordCount: number;
}

export async function detectEssayBoundaries(
  ocrResults: OcrResult[]
): Promise<EssayBoundary[]> {
  // Combine OCR text
  // Send to Claude Sonnet to identify essay boundaries
  // Look for: new essay indicators, title patterns, significant gaps
  // Return boundaries
}
```

**Validation:**
- [ ] Correctly identifies essay starts/ends
- [ ] Handles various formats
- [ ] Returns useful boundaries
- Unit tests with sample OCR text

---

#### 9.3 Create Extraction Prompts
**Description:** LLM prompts for extracting different content types.

**Files to Create:**
- `lib/llm/prompts/extraction.ts`

**Implementation:**
```typescript
export const EXTRACTION_SYSTEM_PROMPT = `
You are an expert at analyzing UPSC topper essays and extracting valuable content.

Extract the following types of content:
1. INTRODUCTIONS: Anecdotes, quotes, movie/book references, catchy phrases
2. CONCLUSIONS: Quote-based, ellipse back, Sanskrit shlokas, summaries
3. EXAMPLES: Categorize by type (ethical, governance, societal, etc.)
4. QUOTES: Note if multi-use or theme-specific
5. THINKERS: Name, key idea, can be used as quote or anecdote
6. ARGUMENTS: Core reasoning, WHY/HOW/WHAT IF framing
7. BOOKS/POEMS: Literary references with relevance
8. KEYWORDS/PHRASES: Reusable multi-theme phrases

Quality criteria:
- HIGH: Unique, insightful, directly usable
- MEDIUM: Good but common
- LOW: Generic or overused

Flag as OVERUSED: Gandhi (in generic contexts), Buddha, Ashoka, Mandela
Flag as MULTI-USE: Content applicable across multiple themes
`;

export function createExtractionPrompt(essayText: string, parameters: ExtractionParameters): string {
  // Build prompt with essay text and parameters
}
```

**Validation:**
- [ ] Prompts extract all content types
- [ ] Quality scoring works
- [ ] Overused flagging works
- [ ] Parameters respected

---

#### 9.4 Create Extraction Schemas
**Description:** Zod schemas for validating LLM extraction output.

**Files to Create:**
- `lib/llm/schemas/extraction.ts`

**Implementation:**
```typescript
import { z } from 'zod';

export const ExtractedContentSchema = z.object({
  contentType: z.enum([...]),
  exampleCategory: z.enum([...]).optional(),
  content: z.string(),
  context: z.string().optional(),
  quality: z.enum(['high', 'medium', 'low']),
  isOverused: z.boolean(),
  multiUse: z.boolean(),
});

export const ExtractionResultSchema = z.object({
  items: z.array(ExtractedContentSchema),
  essayTitle: z.string().optional(),
  overallQuality: z.enum(['high', 'medium', 'low']),
});
```

**Validation:**
- [ ] Schemas validate correctly
- [ ] Invalid data rejected
- [ ] Types inferred correctly

---

#### 9.5 Create Content Extractor
**Description:** Main extraction logic using LLM.

**Files to Create:**
- `lib/extraction/content-extractor.ts`

**Implementation:**
```typescript
export async function extractContentFromEssay(
  essayText: string,
  parameters: ExtractionParameters,
  sourceRef: string
): Promise<ExtractedContent[]> {
  const prompt = createExtractionPrompt(essayText, parameters);
  const result = await generateObject({
    model: provider(getModelForTask('pattern_extraction')),
    schema: ExtractionResultSchema,
    prompt,
  });

  return result.items.map(item => ({
    ...item,
    id: crypto.randomUUID(),
    sourceType: 'topper',
    sourceRef,
    themes: [], // Classified later
    createdAt: new Date().toISOString(),
  }));
}
```

**Validation:**
- [ ] Extracts all content types
- [ ] Respects parameters
- [ ] Returns valid ExtractedContent[]
- Integration test with real essay

---

#### 9.6 Create Quality Scorer
**Description:** Score and flag content quality.

**Files to Create:**
- `lib/extraction/quality.ts`

**Implementation:**
```typescript
const OVERUSED_PATTERNS = [
  /gandhi/i,
  /buddha/i,
  /ashoka/i,
  /mandela/i,
  /vasudhaiva kutumbakam/i,
];

export function flagOverused(content: string): boolean {
  return OVERUSED_PATTERNS.some(pattern => pattern.test(content));
}

export function assessMultiUse(content: string, contentType: ContentType): boolean {
  // Quotes and arguments more likely to be multi-use
  // Check for universal themes
}
```

**Validation:**
- [ ] Flags known overused examples
- [ ] Multi-use detection reasonable
- Unit tests for patterns

---

#### 9.7 Create Extract API Route
**Description:** API endpoint to run extraction on OCR results.

**Files to Create:**
- `app/api/extract/route.ts`

**Implementation:**
```typescript
export async function POST(request: NextRequest) {
  const { ocrJobId, parameters } = await request.json();

  // Get OCR results
  const ocrResults = await getOcrResults(ocrJobId);

  // Detect essay boundaries
  const boundaries = await detectEssayBoundaries(ocrResults);

  // Create extraction job
  const job = await jobManager.createJob('extraction', ocrJobId);

  // Extract from each essay
  for (const boundary of boundaries) {
    const essayText = getEssayText(ocrResults, boundary);
    const content = await extractContentFromEssay(essayText, parameters, ocrJobId);
    await jobManager.addResult(job.id, content);
    await jobManager.updateProgress(job.id, ...);
  }

  return NextResponse.json({ jobId: job.id });
}
```

**Validation:**
- [ ] Processes all essays
- [ ] Returns extraction results
- [ ] Progress tracking works
- [ ] Handles errors gracefully

---

#### 9.8 Create Extraction Parameters Page
**Description:** UI to configure extraction parameters.

**Files to Modify:**
- `app/settings/parameters/page.tsx`

**Files to Create:**
- `components/parameters-config.tsx`

**Implementation:**
- Checkbox list for example categories
- Radio for thinker priority
- Radio for quote style
- Text area for custom overused examples
- Dropdown for quality threshold
- Save to localStorage/Notion

**Validation:**
- [ ] All parameters editable
- [ ] Changes persist
- [ ] Defaults sensible
- [ ] Reset to defaults works

---

#### 9.9 Create Extracted Content Browser
**Description:** Browse and filter extracted content.

**Files to Create:**
- `components/extracted-content.tsx`

**Implementation:**
- Filter by content type
- Filter by example category
- Filter by quality
- Search content
- Show source reference
- Expand to see full content + context

**Validation:**
- [ ] Filters work correctly
- [ ] Search finds content
- [ ] Displays all metadata
- [ ] Good UX for browsing

---

#### 9.10 Integrate Extraction into Patterns Page
**Description:** Show extracted content on patterns page.

**Files to Modify:**
- `app/patterns/page.tsx`

**Implementation:**
- List extraction jobs
- Show extracted content per job
- Group by content type
- Stats (total intros, examples, etc.)

**Validation:**
- [ ] Shows all extracted content
- [ ] Grouping works
- [ ] Stats accurate

---

### Sprint 9 Completion Criteria ✅ COMPLETED
- [x] Essay boundaries detected correctly
- [x] All content types extracted
- [x] Quality scoring works
- [x] Overused examples flagged
- [x] Parameters configurable via UI
- [x] Extracted content browsable
- [x] Markdown highlights rendered (ai-elements)
- [x] Re-extract from OCR without reprocessing PDFs
- [ ] All tests passing (not verified in this update)

---

## Sprint 10: Theme Classification

**Goal:** Classify extracted content into theme hierarchy with cross-theme support.

**Demo:** Extracted content → classified into themes → user can review/adjust → see content per theme.

### Tasks

#### 10.1 Create Classification Prompts
**Description:** LLM prompts for classifying content into themes.

**Files to Create:**
- `lib/llm/prompts/classification.ts`

**Implementation:**
```typescript
export const CLASSIFICATION_SYSTEM_PROMPT = `
You are classifying UPSC essay content into themes.

Given content and the theme hierarchy, determine which themes it applies to.
Content can apply to MULTIPLE themes (cross-cutting content is valuable).

Return relevance scores (0-1) for each applicable theme.
Only include themes with score > 0.4.

Theme hierarchy:
{themes}
`;

export function createClassificationPrompt(
  content: ExtractedContent,
  themes: MainTheme[]
): string {
  // Build prompt with content and theme hierarchy
}
```

**Validation:**
- [ ] Classifications are sensible
- [ ] Cross-theme content identified
- [ ] Relevance scores meaningful

---

#### 10.2 Create Classification Schemas
**Description:** Zod schemas for classification output.

**Files to Create:**
- `lib/llm/schemas/classification.ts`

**Implementation:**
```typescript
export const ClassificationResultSchema = z.object({
  mappings: z.array(z.object({
    mainThemeId: z.string(),
    miniThemeId: z.string(),
    relevanceScore: z.number().min(0).max(1),
    reasoning: z.string().optional(),
  })),
});
```

**Validation:**
- [ ] Schema validates correctly
- [ ] Scores in valid range

---

#### 10.3 Create Classifier
**Description:** Main classification logic.

**Files to Create:**
- `lib/classification/classifier.ts`

**Implementation:**
```typescript
export async function classifyContent(
  content: ExtractedContent,
  themes: MainTheme[]
): Promise<ThemeMapping[]> {
  const prompt = createClassificationPrompt(content, themes);
  const result = await generateObject({
    model: provider(getModelForTask('classification')),
    schema: ClassificationResultSchema,
    prompt,
  });

  return result.mappings.filter(m => m.relevanceScore > 0.6);
}

export async function classifyBatch(
  contents: ExtractedContent[],
  themes: MainTheme[]
): Promise<Map<string, ThemeMapping[]>> {
  // Classify in parallel batches
}
```

**Validation:**
- [ ] Single classification works
- [ ] Batch processing efficient
- [ ] Cross-theme handling correct

---

#### 10.4 Create Cross-Theme Handler
**Description:** Handle content appearing in multiple themes.

**Files to Create:**
- `lib/classification/cross-theme.ts`

**Implementation:**
```typescript
export function handleCrossThemeContent(
  content: ExtractedContent,
  mappings: ThemeMapping[]
): ExtractedContent[] {
  // Content appears in ALL mapped themes
  // Each theme gets a reference to the content
  // Maintain single source of truth
}

export function findCrossThemeContent(
  allContent: ExtractedContent[]
): ExtractedContent[] {
  return allContent.filter(c => c.themes.length > 1);
}
```

**Validation:**
- [ ] Content in multiple themes
- [ ] Single source of truth maintained
- [ ] Can query cross-theme content

---

#### 10.5 Create Content Aggregator
**Description:** Aggregate all content per theme.

**Files to Create:**
- `lib/classification/aggregator.ts`

**Implementation:**
```typescript
export interface ThemeContent {
  themeId: string;
  themeName: string;
  miniThemeId: string;
  miniThemeName: string;
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
  stats: {
    total: number;
    bySource: { topper: number; user: number };
    byQuality: { high: number; medium: number; low: number };
  };
}

export function aggregateContentByTheme(
  content: ExtractedContent[],
  themes: MainTheme[]
): ThemeContent[] {
  // Group content by theme
  // Calculate stats
}
```

**Validation:**
- [ ] Content grouped correctly
- [ ] Stats accurate
- [ ] All content types included

---

#### 10.6 Create User Content Fetcher
**Description:** Fetch and extract content from user's Notion pages.

**Files to Create:**
- `lib/notion/content-fetcher.ts`

**Implementation:**
```typescript
export async function fetchUserContent(
  pageId: string,
  apiKey: string
): Promise<{ text: string; images: string[] }> {
  const client = new NotionClient(apiKey);
  const blocks = await client.getPageContent(pageId);

  const text = parseBlocksToText(blocks);
  const images = extractImageUrls(blocks);

  return { text, images };
}

export async function extractUserContent(
  pageId: string,
  apiKey: string,
  parameters: ExtractionParameters
): Promise<ExtractedContent[]> {
  const { text } = await fetchUserContent(pageId, apiKey);
  const content = await extractContentFromEssay(text, parameters, pageId);
  return content.map(c => ({ ...c, sourceType: 'user' }));
}
```

**Validation:**
- [ ] Fetches Notion page content
- [ ] Handles images (for future OCR)
- [ ] Extracts user content correctly

---

#### 10.7 Create Classify API Route
**Description:** API endpoint to classify content into themes.

**Files to Create:**
- `app/api/classify/route.ts`

**Implementation:**
```typescript
export async function POST(request: NextRequest) {
  const { extractionJobId, themePageId, apiKey } = await request.json();

  // Get extracted content
  const content = await getExtractionResults(extractionJobId);

  // Get themes
  const themes = await fetchThemes(themePageId, apiKey);

  // Create classification job
  const job = await jobManager.createJob('classification', extractionJobId);

  // Classify each content item
  for (const item of content) {
    const mappings = await classifyContent(item, themes);
    item.themes = mappings;
    await jobManager.addResult(job.id, item);
    await jobManager.updateProgress(job.id, ...);
  }

  return NextResponse.json({ jobId: job.id });
}
```

**Validation:**
- [ ] Classifies all content
- [ ] Returns classified content
- [ ] Progress tracking works

---

#### 10.8 Create Classification Review Component
**Description:** UI to review and adjust classifications.

**Files to Create:**
- `components/classification-review.tsx`

**Implementation:**
- List content items
- Show current theme mappings
- Allow adding/removing themes
- Adjust relevance scores
- Bulk actions (apply same mapping to similar)
- Save changes

**Validation:**
- [ ] Can view all classifications
- [ ] Can adjust mappings
- [ ] Changes persist
- [ ] Good UX for review

---

#### 10.9 Create Theme Content View
**Description:** View all content for a specific theme.

**Files to Modify:**
- `app/themes/[id]/page.tsx`

**Implementation:**
- Fetch aggregated content for theme
- Show by content type
- Filter by source (topper/user)
- Filter by quality
- Show cross-theme indicator

**Validation:**
- [ ] Shows all theme content
- [ ] Filters work
- [ ] Cross-theme content visible

---

#### 10.10 Integrate Classification into Workflow
**Description:** Connect extraction → classification flow.

**Files to Modify:**
- `app/patterns/page.tsx`
- `app/themes/page.tsx`

**Implementation:**
- After extraction, prompt to classify
- Show classification progress
- Navigate to theme view after completion

**Validation:**
- [ ] Smooth workflow
- [ ] Progress visible
- [ ] Results accessible

---

### Sprint 10 Completion Criteria
- [ ] Content classified into themes
- [ ] Cross-theme content handled
- [ ] User content extracted and classified
- [ ] Classification reviewable/adjustable
- [ ] Content viewable per theme
- [ ] All tests passing

---

## Sprint 11: Comparison & Gap Analysis

**Goal:** Compare user content vs topper content per theme, identify gaps.

**Demo:** Select theme → see what user has vs what toppers have → gap analysis with suggestions.

### Tasks

#### 11.1 Create Comparison Types
**Description:** Define types for comparison results.

**Files to Modify:**
- `types/comparison.ts`

**Implementation:**
```typescript
export interface ComparisonResult {
  themeId: string;
  themeName: string;

  coverage: {
    introductions: CoverageStat;
    conclusions: CoverageStat;
    examples: CoverageStat;
    quotes: CoverageStat;
    thinkers: CoverageStat;
    arguments: CoverageStat;
  };

  gaps: Gap[];
  suggestions: Suggestion[];
  overallScore: number; // 0-100
}

export interface CoverageStat {
  userCount: number;
  topperCount: number;
  userHas: string[];      // Content IDs
  topperUnique: string[]; // Content IDs user is missing
  overlapCount: number;
}

export interface Gap {
  type: ContentType;
  category?: ExampleCategory;
  description: string;
  severity: 'high' | 'medium' | 'low';
  topperExamples: string[]; // Content IDs
}

export interface Suggestion {
  type: 'add' | 'improve' | 'diversify';
  description: string;
  relatedContent: string[]; // Content IDs to reference
}
```

**Validation:**
- [ ] Types compile
- [ ] Cover all comparison aspects

---

#### 11.2 Create Comparison Prompts
**Description:** LLM prompts for comparison analysis.

**Files to Create:**
- `lib/llm/prompts/comparison.ts`

**Implementation:**
```typescript
export const COMPARISON_SYSTEM_PROMPT = `
You are comparing a UPSC aspirant's content against topper content for a theme.

Analyze:
1. COVERAGE: What types of content does user have vs toppers?
2. GAPS: What valuable content are toppers using that user lacks?
3. QUALITY: How does user content quality compare?
4. SUGGESTIONS: Specific actionable improvements

Focus on:
- Diversity of examples (across categories)
- Uniqueness (avoiding overused)
- Cross-theme applicability
- Revision-readiness
`;
```

**Validation:**
- [ ] Comparison is useful
- [ ] Gaps identified correctly
- [ ] Suggestions actionable

---

#### 11.3 Create Gap Analyzer
**Description:** Analyze gaps between user and topper content.

**Files to Create:**
- `lib/comparison/gap-analyzer.ts`

**Implementation:**
```typescript
export async function analyzeGaps(
  userContent: ExtractedContent[],
  topperContent: ExtractedContent[],
  theme: MainTheme
): Promise<ComparisonResult> {
  // Calculate coverage stats
  const coverage = calculateCoverage(userContent, topperContent);

  // Use LLM to identify meaningful gaps
  const gaps = await identifyGaps(userContent, topperContent, theme);

  // Generate suggestions
  const suggestions = await generateSuggestions(gaps, topperContent);

  // Calculate overall score
  const overallScore = calculateScore(coverage, gaps);

  return { themeId: theme.id, themeName: theme.title, coverage, gaps, suggestions, overallScore };
}
```

**Validation:**
- [ ] Coverage calculated correctly
- [ ] Gaps are meaningful
- [ ] Score reflects reality

---

#### 11.4 Create Suggestion Generator
**Description:** Generate actionable suggestions based on gaps.

**Files to Create:**
- `lib/comparison/suggestions.ts`

**Implementation:**
```typescript
export async function generateSuggestions(
  gaps: Gap[],
  topperContent: ExtractedContent[]
): Promise<Suggestion[]> {
  // For each gap, suggest specific content to add
  // Reference topper content as examples
  // Prioritize by gap severity
}

export function prioritizeSuggestions(
  suggestions: Suggestion[]
): Suggestion[] {
  // High impact, low effort first
  // Diversification over quantity
}
```

**Validation:**
- [ ] Suggestions are specific
- [ ] Reference real content
- [ ] Prioritization sensible

---

#### 11.5 Create Compare API Route
**Description:** API endpoint to run comparison.

**Files to Create:**
- `app/api/compare/route.ts`

**Implementation:**
```typescript
export async function POST(request: NextRequest) {
  const { themeId, userContentIds, topperContentIds } = await request.json();

  // Get content
  const userContent = await getContentByIds(userContentIds);
  const topperContent = await getContentByIds(topperContentIds);
  const theme = await getTheme(themeId);

  // Run comparison
  const result = await analyzeGaps(userContent, topperContent, theme);

  return NextResponse.json(result);
}
```

**Validation:**
- [ ] Returns comparison result
- [ ] Handles missing content gracefully

---

#### 11.6 Create Comparison Results Component
**Description:** Display comparison results visually.

**Files to Modify:**
- `components/comparison-results.tsx`

**Implementation:**
- Coverage chart (user vs topper by type)
- Gaps list with severity badges
- Suggestions with expandable details
- Overall score display
- Link to topper content examples

**Validation:**
- [ ] Clear visualization
- [ ] Gaps easy to understand
- [ ] Suggestions actionable
- [ ] Good UX

---

#### 11.7 Create Per-Theme Comparison Page
**Description:** Dedicated comparison page per theme.

**Files to Create:**
- `app/themes/[id]/compare/page.tsx`

**Implementation:**
- Select user content sources
- Show comparison results
- Navigate to specific content
- Actions to add missing content

**Validation:**
- [ ] Theme-specific comparison
- [ ] Easy to navigate results
- [ ] Actions work

---

#### 11.8 Create Global Comparison View
**Description:** Compare across all themes at once.

**Files to Modify:**
- `app/compare/page.tsx`

**Implementation:**
- Summary cards per theme
- Overall gaps across themes
- Priority recommendations
- Export comparison report

**Validation:**
- [ ] Shows all themes
- [ ] Highlights biggest gaps
- [ ] Export works

---

### Sprint 11 Completion Criteria
- [ ] Comparison analysis works
- [ ] Gaps identified per theme
- [ ] Suggestions generated
- [ ] Comparison UI complete
- [ ] Per-theme and global views
- [ ] All tests passing

---

## Sprint 12: Note Generation & Notion Sync

**Goal:** Generate dual-section revision notes and sync to Notion.

**Demo:** Generate notes for theme → preview dual-section format → sync to Notion → verify in Notion.

### Tasks

#### 12.1 Create Generation Types
**Description:** Define types for generated notes.

**Files to Create:**
- `types/generation.ts`

**Implementation:**
```typescript
export interface GeneratedNote {
  id: string;
  themeId: string;
  themeName: string;
  miniThemeId: string;
  miniThemeName: string;

  yourNotes: NoteSection;
  topperInsights: NoteSection;

  crossThemeRefs: CrossThemeRef[];
  generatedAt: string;
  syncedAt?: string;
  notionPageId?: string;
}

export interface NoteSection {
  content: string;        // Markdown formatted
  items: NoteItem[];      // Structured items
  wordCount: number;
}

export interface NoteItem {
  type: 'key_point' | 'example' | 'quote' | 'argument' | 'thinker';
  content: string;
  sourceContentId?: string;
}

export interface CrossThemeRef {
  content: string;
  applicableThemes: string[];
}
```

**Validation:**
- [ ] Types compile
- [ ] Cover dual-section format

---

#### 12.2 Create Generation Prompts
**Description:** LLM prompts for note generation.

**Files to Create:**
- `lib/llm/prompts/generation.ts`

**Implementation:**
```typescript
export const GENERATION_SYSTEM_PROMPT = `
You are generating REVISION-READY notes for UPSC essay preparation.

Generate TWO sections:

## Your Notes
- Distill user's content into KEY POINTS
- Keep examples CONCISE
- Format for quick scanning
- Target: 200-300 words

## Topper Insights
- Add UNIQUE content user is missing
- Focus on HIGH-QUALITY additions
- Include cross-theme references
- Target: 150-250 words

CRITICAL: Both sections must be REVISION-READY.
- Bullet points, not paragraphs
- Scannable before an exam
- Quality over quantity
- No verbose explanations
`;
```

**Validation:**
- [ ] Notes are concise
- [ ] Both sections balanced
- [ ] Revision-ready format

---

#### 12.3 Create Note Generator
**Description:** Main note generation logic.

**Files to Create:**
- `lib/generation/note-generator.ts`

**Implementation:**
```typescript
export async function generateNotes(
  theme: MainTheme,
  miniTheme: MiniTheme,
  userContent: ExtractedContent[],
  topperContent: ExtractedContent[]
): Promise<GeneratedNote> {
  const prompt = createGenerationPrompt(theme, miniTheme, userContent, topperContent);

  const result = await generateObject({
    model: provider(getModelForTask('generation')),
    schema: GeneratedNoteSchema,
    prompt,
  });

  // Enforce conciseness
  const finalNote = enforceConciseness(result);

  // Find cross-theme references
  const crossThemeRefs = findCrossThemeRefs(topperContent);

  return {
    id: crypto.randomUUID(),
    themeId: theme.id,
    themeName: theme.title,
    miniThemeId: miniTheme.id,
    miniThemeName: miniTheme.title,
    ...finalNote,
    crossThemeRefs,
    generatedAt: new Date().toISOString(),
  };
}
```

**Validation:**
- [ ] Notes generated correctly
- [ ] Dual-section format
- [ ] Cross-theme refs included

---

#### 12.4 Create Conciseness Enforcer
**Description:** Ensure notes are revision-ready length.

**Files to Create:**
- `lib/generation/conciseness.ts`

**Implementation:**
```typescript
const MAX_YOUR_NOTES_WORDS = 350;
const MAX_TOPPER_INSIGHTS_WORDS = 300;

export function enforceConciseness(note: GeneratedNote): GeneratedNote {
  // Count words
  // If over limit, use LLM to trim
  // Preserve most important points
  // Return trimmed version
}

export function validateConciseness(note: GeneratedNote): {
  valid: boolean;
  yourNotesWords: number;
  topperInsightsWords: number;
} {
  // Check word counts
}
```

**Validation:**
- [ ] Notes within word limits
- [ ] Important content preserved
- [ ] Trimming maintains quality

---

#### 12.5 Create Notion Block Builder
**Description:** Convert notes to Notion blocks.

**Files to Create:**
- `lib/notion/block-builder.ts`

**Implementation:**
```typescript
export function noteToNotionBlocks(note: GeneratedNote): NotionBlock[] {
  return [
    // Theme header
    createHeading2(`${note.themeName} > ${note.miniThemeName}`),

    // Your Notes section
    createHeading3('Your Notes'),
    ...note.yourNotes.items.map(item => createBullet(item.content)),

    // Divider
    createDivider(),

    // Topper Insights section
    createHeading3('Topper Insights'),
    ...note.topperInsights.items.map(item => createBullet(item.content)),

    // Cross-theme references
    ...(note.crossThemeRefs.length > 0 ? [
      createCallout('Cross-applicable', note.crossThemeRefs.map(r => r.content).join(', ')),
    ] : []),
  ];
}
```

**Validation:**
- [ ] Valid Notion blocks
- [ ] Formatting preserved
- [ ] All sections included

---

#### 12.6 Create Notion Destination Config
**Description:** UI to configure where notes sync to.

**Files to Modify:**
- `app/settings/page.tsx`

**Implementation:**
- Add "Output Destination" section
- Notion page search/select
- Test connection to destination
- Show currently configured destination

**Validation:**
- [ ] Can select destination page
- [ ] Selection persists
- [ ] Test connection works

---

#### 12.7 Create Notion Sync API
**Description:** API endpoint to sync notes to Notion.

**Files to Modify:**
- `app/api/notion/sync/route.ts`

**Implementation:**
```typescript
export async function POST(request: NextRequest) {
  const { noteId, destinationPageId, apiKey } = await request.json();

  // Get note
  const note = await getNote(noteId);

  // Convert to Notion blocks
  const blocks = noteToNotionBlocks(note);

  // Append to destination page
  const client = new NotionClient(apiKey);
  await client.appendBlocks(destinationPageId, blocks);

  // Update note with sync info
  note.syncedAt = new Date().toISOString();
  note.notionPageId = destinationPageId;
  await saveNote(note);

  return NextResponse.json({ success: true });
}
```

**Validation:**
- [ ] Notes appear in Notion
- [ ] Formatting correct
- [ ] Sync timestamp updated

---

#### 12.8 Create Generate API Route
**Description:** API endpoint to generate notes.

**Files to Create:**
- `app/api/generate/route.ts`

**Implementation:**
```typescript
export async function POST(request: NextRequest) {
  const { themeId, miniThemeId } = await request.json();

  // Get theme and content
  const theme = await getTheme(themeId);
  const miniTheme = theme.miniThemes.find(m => m.id === miniThemeId);
  const content = await getThemeContent(themeId, miniThemeId);

  // Generate notes
  const note = await generateNotes(
    theme,
    miniTheme,
    content.filter(c => c.sourceType === 'user'),
    content.filter(c => c.sourceType === 'topper')
  );

  // Save note
  await saveNote(note);

  return NextResponse.json(note);
}
```

**Validation:**
- [ ] Notes generated for theme
- [ ] Both sections present
- [ ] Note saved correctly

---

#### 12.9 Create Notes Preview Component
**Description:** Preview generated notes before sync.

**Files to Modify:**
- `components/revision-note.tsx`

**Implementation:**
- Dual-section display
- Markdown rendering
- Word count display
- Edit capability (optional)
- Sync to Notion button
- Regenerate button

**Validation:**
- [ ] Shows both sections
- [ ] Markdown rendered
- [ ] Actions work

---

#### 12.10 Create Sync Status Component
**Description:** Show sync status and history.

**Files to Create:**
- `components/sync-status.tsx`

**Implementation:**
- Last sync timestamp
- Sync in progress indicator
- Error display
- Link to Notion page
- Sync all notes button

**Validation:**
- [ ] Status accurate
- [ ] Errors displayed
- [ ] Links work

---

#### 12.11 Integrate Notes into Theme Page
**Description:** Show/generate notes on theme detail page.

**Files to Modify:**
- `app/themes/[id]/page.tsx`

**Implementation:**
- "Generate Notes" button per mini-theme
- Show existing notes
- Regenerate option
- Sync button

**Validation:**
- [ ] Can generate from theme page
- [ ] Notes displayed
- [ ] Sync works

---

#### 12.12 Create Notes List Page
**Description:** Browse all generated notes.

**Files to Modify:**
- `app/notes/page.tsx`

**Implementation:**
- List all generated notes
- Group by theme
- Show sync status
- Bulk sync option
- Search/filter

**Validation:**
- [ ] All notes listed
- [ ] Grouping correct
- [ ] Bulk actions work

---

### Sprint 12 Completion Criteria
- [ ] Notes generated in dual-section format
- [ ] Notes are concise and revision-ready
- [ ] Notion destination configurable
- [ ] Notes sync to Notion correctly
- [ ] Sync status tracked
- [ ] All tests passing

---

## Testing Strategy

### Unit Tests
- `lib/storage/*.test.ts` - R2 client and signed URLs
- `lib/pdf/*.test.ts` - PDF streaming and rendering
- `lib/extraction/*.test.ts` - Content extraction
- `lib/classification/*.test.ts` - Theme classification
- `lib/comparison/*.test.ts` - Gap analysis
- `lib/generation/*.test.ts` - Note generation
- `lib/notion/*.test.ts` - Notion client and parsers
- `lib/llm/*.test.ts` - LLM provider and utilities

### API Tests
- Test each API route with various inputs
- Mock LLM responses for deterministic tests
- Test error handling and edge cases

### Component Tests
- Render tests with React Testing Library
- Interaction tests for forms and buttons
- Loading and error state tests

### Integration Tests
- Full pipeline: Upload → OCR → Extract → Classify → Generate → Sync
- Notion integration with real API (manual)
- R2 integration (manual)

### Validation Checklist Per Task
Each task includes specific validation criteria that serve as acceptance tests.

### Unit Tests
- `lib/notion/*.test.ts` - Notion client and parsers
- `lib/llm/*.test.ts` - LLM provider and utilities
- `lib/storage.test.ts` - Storage utilities

### API Tests
- Test each API route with various inputs
- Use test fixtures for Notion responses

### Component Tests
- Render tests with React Testing Library
- Interaction tests for forms

### Integration Tests
- End-to-end flow tests (manual initially)
- Notion integration with real API (manual)

### Validation Checklist Per Task
Each task includes specific validation criteria that serve as acceptance tests.
