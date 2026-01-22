import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	projects: defineTable({
		name: v.string(),
		description: v.optional(v.string()),
		createdAt: v.string(),
		updatedAt: v.string(),
	}).index("by_updated", ["updatedAt"]),

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
