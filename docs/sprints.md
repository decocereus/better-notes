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

### Cloudflare R2 CDN (Deferred)
Currently using Vercel Blob for file storage. In future, may migrate to Cloudflare R2:
- Better for long-term file storage and referencing
- User can easily reference back to uploaded images/PDFs
- CDN distribution for faster access
- Cost-effective for larger storage needs

**Migration path**: Replace Vercel Blob with R2 in Sprint 5 tasks when ready.

---

## Future Sprints (Strategy-Dependent)

These sprints will be detailed after the strategy document is provided:

### Sprint 8: OCR & Text Extraction
- Process uploaded PDFs with LLM Vision
- Extract text from images
- Store extracted content

### Sprint 9: Topper Pattern Extraction
- Analyze topper essays
- Extract patterns (intro, body, conclusion)
- Store patterns database

### Sprint 10: Content Classification
- Auto-classify content into themes
- Cross-theme mapping
- User review/adjustment UI

### Sprint 11: Comparison & Analysis
- Compare user vs topper content
- Apply extraction parameters (from strategy doc)
- Generate gap analysis

### Sprint 12: Note Generation
- Generate dual-section notes
- User content + Topper insights
- Notion sync

---

## Testing Strategy

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
