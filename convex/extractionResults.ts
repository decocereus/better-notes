import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create extraction result metadata.
 */
export const create = mutation({
	args: {
		assetId: v.id("assets"),
		ocrJobId: v.optional(v.string()),
		extractionJobId: v.string(),
		totalEssays: v.number(),
		totalItems: v.number(),
		stats: v.any(),
		resultsKey: v.string(),
	},
	handler: async (ctx, args) => {
		// Verify asset exists
		const asset = await ctx.db.get(args.assetId);
		if (!asset) {
			throw new Error("Asset not found");
		}

		// Check for existing results for this asset
		const existing = await ctx.db
			.query("extractionResults")
			.withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
			.first();

		// If exists, update instead of creating duplicate
		if (existing) {
			const updates: Record<string, unknown> = {
				extractionJobId: args.extractionJobId,
				totalEssays: args.totalEssays,
				totalItems: args.totalItems,
				stats: args.stats,
				resultsKey: args.resultsKey,
				createdAt: new Date().toISOString(),
			};
			if (args.ocrJobId !== undefined) {
				updates.ocrJobId = args.ocrJobId;
			}
			await ctx.db.patch(existing._id, updates);
			return existing._id;
		}

		const resultId = await ctx.db.insert("extractionResults", {
			assetId: args.assetId,
			ocrJobId: args.ocrJobId,
			extractionJobId: args.extractionJobId,
			totalEssays: args.totalEssays,
			totalItems: args.totalItems,
			stats: args.stats,
			resultsKey: args.resultsKey,
			createdAt: new Date().toISOString(),
		});

		return resultId;
	},
});

/**
 * Get extraction results by asset ID.
 */
export const getByAsset = query({
	args: { assetId: v.id("assets") },
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query("extractionResults")
			.withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
			.first();

		if (!result) {
			return null;
		}

		return {
			...result,
			id: result._id,
		};
	},
});

/**
 * Get all extraction results (for patterns page).
 */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const results = await ctx.db.query("extractionResults").collect();

		return results.map((result) => ({
			...result,
			id: result._id,
		}));
	},
});

/**
 * Delete extraction results for an asset.
 */
export const removeByAsset = mutation({
	args: { assetId: v.id("assets") },
	handler: async (ctx, args) => {
		const results = await ctx.db
			.query("extractionResults")
			.withIndex("by_asset", (q) => q.eq("assetId", args.assetId))
			.collect();

		for (const result of results) {
			await ctx.db.delete(result._id);
		}

		return results.length;
	},
});
