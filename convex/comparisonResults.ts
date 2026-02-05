import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByProject = query({
	args: { projectId: v.id("projects") },
	handler: async (ctx, { projectId }) => {
		const results = await ctx.db
			.query("comparisonResults")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.collect();
		return results.map((r) => ({ ...r, id: r._id }));
	},
});

export const getByMiniTheme = query({
	args: { projectId: v.id("projects"), miniThemeId: v.string() },
	handler: async (ctx, { projectId, miniThemeId }) => {
		const result = await ctx.db
			.query("comparisonResults")
			.withIndex("by_mini_theme", (q) =>
				q.eq("projectId", projectId).eq("miniThemeId", miniThemeId)
			)
			.first();
		if (!result) {
			return null;
		}
		return { ...result, id: result._id };
	},
});

export const upsert = mutation({
	args: {
		projectId: v.id("projects"),
		themePageId: v.id("themePages"),
		miniThemeId: v.string(),
		mainThemeId: v.string(),
		score: v.number(),
		jobId: v.string(),
		resultsKey: v.string(),
		status: v.union(
			v.literal("pending"),
			v.literal("completed"),
			v.literal("failed")
		),
		error: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("comparisonResults")
			.withIndex("by_mini_theme", (q) =>
				q.eq("projectId", args.projectId).eq("miniThemeId", args.miniThemeId)
			)
			.first();

		const now = new Date().toISOString();

		if (existing) {
			await ctx.db.patch(existing._id, {
				score: args.score,
				jobId: args.jobId,
				resultsKey: args.resultsKey,
				status: args.status,
				error: args.error,
				createdAt: now,
			});
			return existing._id;
		}

		return await ctx.db.insert("comparisonResults", {
			...args,
			createdAt: now,
		});
	},
});

export const removeByProject = mutation({
	args: { projectId: v.id("projects") },
	handler: async (ctx, { projectId }) => {
		const results = await ctx.db
			.query("comparisonResults")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.collect();
		for (const r of results) {
			await ctx.db.delete(r._id);
		}
		return results.length;
	},
});
