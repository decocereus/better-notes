import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByProject = query({
	args: { projectId: v.id("projects") },
	handler: async (ctx, { projectId }) => {
		const notes = await ctx.db
			.query("generatedNotes")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.collect();
		return notes.map((n) => ({ ...n, id: n._id }));
	},
});

export const getByMiniTheme = query({
	args: { projectId: v.id("projects"), miniThemeId: v.string() },
	handler: async (ctx, { projectId, miniThemeId }) => {
		const note = await ctx.db
			.query("generatedNotes")
			.withIndex("by_mini_theme", (q) =>
				q.eq("projectId", projectId).eq("miniThemeId", miniThemeId)
			)
			.first();
		if (!note) {
			return null;
		}
		return { ...note, id: note._id };
	},
});

export const upsert = mutation({
	args: {
		projectId: v.id("projects"),
		miniThemeId: v.string(),
		mainThemeId: v.string(),
		mainThemeTitle: v.string(),
		miniThemeTitle: v.string(),
		resultsKey: v.string(),
		syncStatus: v.union(
			v.literal("not_synced"),
			v.literal("synced"),
			v.literal("failed")
		),
		notionPageId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("generatedNotes")
			.withIndex("by_mini_theme", (q) =>
				q.eq("projectId", args.projectId).eq("miniThemeId", args.miniThemeId)
			)
			.first();

		const now = new Date().toISOString();

		if (existing) {
			await ctx.db.patch(existing._id, {
				mainThemeTitle: args.mainThemeTitle,
				miniThemeTitle: args.miniThemeTitle,
				resultsKey: args.resultsKey,
				syncStatus: args.syncStatus,
				notionPageId: args.notionPageId,
				updatedAt: now,
			});
			return existing._id;
		}

		return await ctx.db.insert("generatedNotes", {
			...args,
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const updateSyncStatus = mutation({
	args: {
		id: v.id("generatedNotes"),
		syncStatus: v.union(
			v.literal("not_synced"),
			v.literal("synced"),
			v.literal("failed")
		),
		notionPageId: v.optional(v.string()),
	},
	handler: async (ctx, { id, syncStatus, notionPageId }) => {
		await ctx.db.patch(id, {
			syncStatus,
			notionPageId,
			updatedAt: new Date().toISOString(),
		});
	},
});

export const removeByProject = mutation({
	args: { projectId: v.id("projects") },
	handler: async (ctx, { projectId }) => {
		const notes = await ctx.db
			.query("generatedNotes")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.collect();
		for (const n of notes) {
			await ctx.db.delete(n._id);
		}
		return notes.length;
	},
});
