import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get all theme pages sorted by most recently created.
 */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const themePages = await ctx.db
			.query("themePages")
			.withIndex("by_created")
			.order("desc")
			.collect();

		return themePages.map((page) => ({
			...page,
			id: page._id,
		}));
	},
});

/**
 * Get a single theme page by ID.
 */
export const get = query({
	args: { id: v.id("themePages") },
	handler: async (ctx, args) => {
		const themePage = await ctx.db.get(args.id);
		if (!themePage) {
			return null;
		}

		return {
			...themePage,
			id: themePage._id,
		};
	},
});

/**
 * Check if a Notion page is already added as a theme page.
 * Used for duplicate prevention.
 */
export const getByNotionId = query({
	args: { notionPageId: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("themePages")
			.withIndex("by_notion_page", (q) =>
				q.eq("notionPageId", args.notionPageId)
			)
			.first();

		if (!existing) {
			return null;
		}

		return {
			...existing,
			id: existing._id,
		};
	},
});

/**
 * Create a new theme page from Notion.
 */
export const create = mutation({
	args: {
		notionPageId: v.string(),
		title: v.string(),
		themes: v.array(v.any()),
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
	},
	handler: async (ctx, args) => {
		// Check for duplicate
		const existing = await ctx.db
			.query("themePages")
			.withIndex("by_notion_page", (q) =>
				q.eq("notionPageId", args.notionPageId)
			)
			.first();

		if (existing) {
			throw new Error(
				`This Notion page is already added as "${existing.title}"`
			);
		}

		const now = new Date().toISOString();
		const themePageId = await ctx.db.insert("themePages", {
			notionPageId: args.notionPageId,
			title: args.title.trim(),
			themes: args.themes,
			stats: args.stats,
			lastSyncedAt: now,
			createdAt: now,
		});

		return themePageId;
	},
});

/**
 * Sync/update a theme page with fresh data from Notion.
 * Updates themes, stats, and lastSyncedAt.
 */
export const sync = mutation({
	args: {
		id: v.id("themePages"),
		title: v.string(),
		themes: v.array(v.any()),
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
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing) {
			throw new Error("Theme page not found");
		}

		await ctx.db.patch(args.id, {
			title: args.title.trim(),
			themes: args.themes,
			stats: args.stats,
			lastSyncedAt: new Date().toISOString(),
		});

		return args.id;
	},
});

/**
 * Delete a theme page.
 * Note: Projects using this theme will become invalid.
 */
export const remove = mutation({
	args: { id: v.id("themePages") },
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing) {
			throw new Error("Theme page not found");
		}

		await ctx.db.delete(args.id);
		return true;
	},
});
