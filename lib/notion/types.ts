/**
 * Notion API type definitions.
 * Based on Notion API version 2025-09-03
 */

// Rich text types
export interface RichText {
	type: "text" | "mention" | "equation";
	plain_text: string;
	href: string | null;
	annotations: {
		bold: boolean;
		italic: boolean;
		strikethrough: boolean;
		underline: boolean;
		code: boolean;
		color: string;
	};
	text?: {
		content: string;
		link: { url: string } | null;
	};
}

// Block types
export interface NotionBlock {
	id: string;
	type: string;
	has_children: boolean;
	created_time: string;
	last_edited_time: string;
	// Block-specific content
	paragraph?: { rich_text: RichText[] };
	heading_1?: { rich_text: RichText[] };
	heading_2?: { rich_text: RichText[] };
	heading_3?: { rich_text: RichText[] };
	bulleted_list_item?: { rich_text: RichText[] };
	numbered_list_item?: { rich_text: RichText[] };
	toggle?: { rich_text: RichText[] };
	quote?: { rich_text: RichText[] };
	callout?: { rich_text: RichText[]; icon?: { emoji?: string } };
	code?: { rich_text: RichText[]; language: string };
	child_page?: { title: string };
	child_database?: { title: string };
	image?: {
		type: "external" | "file";
		external?: { url: string };
		file?: { url: string };
	};
	divider?: Record<string, never>;
	table_of_contents?: Record<string, never>;
}

// API Response types
export interface NotionBlocksResponse {
	object: "list";
	results: NotionBlock[];
	has_more: boolean;
	next_cursor: string | null;
}

export interface NotionUser {
	object: "user";
	id: string;
	name: string;
	avatar_url: string | null;
	type: "person" | "bot";
}

export interface NotionPage {
	object: "page";
	id: string;
	created_time: string;
	last_edited_time: string;
	archived: boolean;
	url: string;
	properties: Record<string, NotionProperty>;
	parent: NotionParent;
	icon: NotionIcon | null;
}

export interface NotionProperty {
	id: string;
	type: string;
	title?: RichText[];
	rich_text?: RichText[];
	[key: string]: unknown;
}

export interface NotionParent {
	type: "workspace" | "page_id" | "database_id";
	workspace?: boolean;
	page_id?: string;
	database_id?: string;
}

export interface NotionIcon {
	type: "emoji" | "external" | "file";
	emoji?: string;
	external?: { url: string };
	file?: { url: string };
}

export interface NotionDatabase {
	object: "database";
	id: string;
	title: RichText[];
	icon: NotionIcon | null;
	url: string;
}

export interface NotionSearchResult {
	object: "list";
	results: (NotionPage | NotionDatabase)[];
	has_more: boolean;
	next_cursor: string | null;
}

// Simplified search result for UI
export interface SearchResultItem {
	id: string;
	title: string;
	type: "page" | "database";
	icon: string | null;
	url: string;
}
