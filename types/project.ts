/**
 * Project and content source types.
 * A project is a session for working on themes with content sources.
 */

import type { ExtractedContent, ExtractionParameters } from "./extraction";

export type ContentSourceType = "notion" | "pdf" | "image" | "text";
export type ContentSourceStatus =
	| "pending"
	| "processing"
	| "completed"
	| "failed";

export interface ContentSource {
	id: string;
	type: ContentSourceType;
	/** URL, file path, or blob URL */
	reference: string;
	/** Display name for the source */
	name: string;
	addedAt: string;
	status: ContentSourceStatus;
	/** Error message if status is 'failed' */
	error?: string;
	/** Extracted content after processing */
	content?: string;
	/** Additional metadata from processing */
	metadata?: {
		content?: string;
		pageTitle?: string;
		pageId?: string;
		blockCount?: number;
		url?: string;
		wordCount?: number;
		imageCount?: number;
		processedAt?: string;
		error?: string;
		failedAt?: string;
		extraction?: {
			items?: ExtractedContent[];
			stats?: {
				totalItems?: number;
				byType?: Record<string, number>;
				byQuality?: Record<string, number>;
			};
			parameters?: ExtractionParameters;
			extractedAt?: string;
		};
	};
}

export interface Project {
	id: string;
	name: string;
	description?: string;
	themePageId?: string;
	createdAt: string;
	updatedAt: string;
	sources: ContentSource[];
}

/**
 * Project creation input
 */
export interface CreateProjectInput {
	name: string;
	description?: string;
}

/**
 * Content source creation input
 */
export interface AddSourceInput {
	type: ContentSourceType;
	reference: string;
	name: string;
}
