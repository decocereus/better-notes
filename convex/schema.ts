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
});
