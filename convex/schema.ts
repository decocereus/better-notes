import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	themePages: defineTable({
		notionPageId: v.string(), // Notion page UUID
		title: v.string(), // From Notion page title
		themes: v.array(v.any()), // MainTheme[] - full parsed hierarchy
		stats: v.object({
			mainThemes: v.number(),
			miniThemes: v.number(),
			questions: v.number(),
			yearRange: v.optional(
				v.object({
					min: v.number(),
					max: v.number(),
				})
			),
		}),
		lastSyncedAt: v.string(), // ISO timestamp of last Notion fetch
		createdAt: v.string(),
	})
		.index("by_notion_page", ["notionPageId"]) // Prevent duplicates
		.index("by_created", ["createdAt"]), // Sort by date added

	projects: defineTable({
		name: v.string(),
		description: v.optional(v.string()),
		themePageId: v.id("themePages"), // Required reference to theme page
		createdAt: v.string(),
		updatedAt: v.string(),
	})
		.index("by_updated", ["updatedAt"])
		.index("by_theme_page", ["themePageId"]), // Find projects using a theme

	contentSources: defineTable({
		projectId: v.id("projects"),
		type: v.union(
			v.literal("notion"),
			v.literal("pdf"),
			v.literal("image"),
			v.literal("url")
		),
		reference: v.string(),
		name: v.string(),
		addedAt: v.string(),
		status: v.union(
			v.literal("pending"),
			v.literal("processing"),
			v.literal("completed"),
			v.literal("failed")
		),
		metadata: v.optional(v.any()),
	}).index("by_project", ["projectId"]),

	// Settings stored per-user (for future auth)
	settings: defineTable({
		key: v.string(),
		value: v.any(),
	}).index("by_key", ["key"]),

	// Global asset library - tracks ALL uploaded files
	assets: defineTable({
		filename: v.string(),
		key: v.string(), // R2 key
		size: v.number(),
		mimeType: v.string(),
		sourceType: v.union(v.literal("pdf"), v.literal("image")),
		projectId: v.optional(v.id("projects")),
		processingStatus: v.union(
			v.literal("pending"),
			v.literal("ocr_queued"),
			v.literal("ocr_processing"),
			v.literal("ocr_completed"),
			v.literal("ocr_failed"),
			v.literal("extraction_queued"),
			v.literal("extraction_processing"),
			v.literal("extraction_completed"),
			v.literal("extraction_failed")
		),
		ocrJobId: v.optional(v.string()),
		extractionJobId: v.optional(v.string()),
		ocrWordCount: v.optional(v.number()),
		extractedItemCount: v.optional(v.number()),
		lastError: v.optional(v.string()),
		uploadedAt: v.string(),
		processedAt: v.optional(v.string()),
		updatedAt: v.string(),
	})
		.index("by_project", ["projectId"])
		.index("by_status", ["processingStatus"])
		.index("by_uploaded", ["uploadedAt"])
		.index("by_key", ["key"]),

	// Extraction results metadata (full results stored in R2)
	extractionResults: defineTable({
		assetId: v.id("assets"),
		ocrJobId: v.string(),
		extractionJobId: v.string(),
		totalEssays: v.number(),
		totalItems: v.number(),
		stats: v.any(), // ExtractionStats
		resultsKey: v.string(), // R2 key for full results JSON
		createdAt: v.string(),
	}).index("by_asset", ["assetId"]),
});
