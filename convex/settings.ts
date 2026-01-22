import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get a setting by key.
 */
export const get = query({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		const setting = await ctx.db
			.query("settings")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();

		return setting?.value ?? null;
	},
});

/**
 * Get all settings.
 */
export const getAll = query({
	args: {},
	handler: async (ctx) => {
		const settings = await ctx.db.query("settings").collect();
		const result: Record<string, unknown> = {};
		for (const setting of settings) {
			result[setting.key] = setting.value;
		}
		return result;
	},
});

/**
 * Set a setting value.
 */
export const set = mutation({
	args: {
		key: v.string(),
		value: v.any(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("settings")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();

		if (existing) {
			await ctx.db.patch(existing._id, { value: args.value });
		} else {
			await ctx.db.insert("settings", {
				key: args.key,
				value: args.value,
			});
		}

		return true;
	},
});

/**
 * Delete a setting.
 */
export const remove = mutation({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("settings")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();

		if (existing) {
			await ctx.db.delete(existing._id);
		}

		return true;
	},
});
