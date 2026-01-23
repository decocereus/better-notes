import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Processing status values for validation.
 */
const processingStatusValidator = v.union(
	v.literal("pending"),
	v.literal("conversion_queued"),
	v.literal("conversion_processing"),
	v.literal("conversion_completed"),
	v.literal("conversion_failed"),
	v.literal("ocr_queued"),
	v.literal("ocr_processing"),
	v.literal("ocr_completed"),
	v.literal("ocr_failed"),
	v.literal("extraction_queued"),
	v.literal("extraction_processing"),
	v.literal("extraction_completed"),
	v.literal("extraction_failed")
);

/**
 * List all assets with optional filters.
 */
export const list = query({
	args: {
		projectId: v.optional(v.id("projects")),
		status: v.optional(processingStatusValidator),
		unassignedOnly: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		// Build different queries based on filters
		if (args.projectId) {
			const assets = await ctx.db
				.query("assets")
				.withIndex("by_project", (q) => q.eq("projectId", args.projectId))
				.order("desc")
				.collect();
			const filtered = args.unassignedOnly
				? assets.filter((a) => !a.projectId)
				: assets;
			return filtered.map((asset) => ({ ...asset, id: asset._id }));
		}

		if (args.status !== undefined) {
			const statusValue = args.status;
			const assets = await ctx.db
				.query("assets")
				.withIndex("by_status", (q) => q.eq("processingStatus", statusValue))
				.order("desc")
				.collect();
			const filtered = args.unassignedOnly
				? assets.filter((a) => !a.projectId)
				: assets;
			return filtered.map((asset) => ({ ...asset, id: asset._id }));
		}

		const assets = await ctx.db
			.query("assets")
			.withIndex("by_uploaded")
			.order("desc")
			.collect();

		// Filter for unassigned if requested
		const filtered = args.unassignedOnly
			? assets.filter((a) => !a.projectId)
			: assets;

		return filtered.map((asset) => ({
			...asset,
			id: asset._id,
		}));
	},
});

/**
 * Get a single asset by ID.
 */
export const get = query({
	args: { id: v.id("assets") },
	handler: async (ctx, args) => {
		const asset = await ctx.db.get(args.id);
		if (!asset) {
			return null;
		}
		return {
			...asset,
			id: asset._id,
		};
	},
});

/**
 * Get an asset by its R2 key.
 */
export const getByKey = query({
	args: { key: v.string() },
	handler: async (ctx, args) => {
		const asset = await ctx.db
			.query("assets")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();

		if (!asset) {
			return null;
		}
		return {
			...asset,
			id: asset._id,
		};
	},
});

/**
 * Get statistics for the asset library.
 */
export const getStats = query({
	args: {},
	handler: async (ctx) => {
		const allAssets = await ctx.db.query("assets").collect();

		const stats = {
			total: allAssets.length,
			unassigned: 0,
			byStatus: {
				pending: 0,
				conversion_queued: 0,
				conversion_processing: 0,
				conversion_completed: 0,
				conversion_failed: 0,
				ocr_queued: 0,
				ocr_processing: 0,
				ocr_completed: 0,
				ocr_failed: 0,
				extraction_queued: 0,
				extraction_processing: 0,
				extraction_completed: 0,
				extraction_failed: 0,
			} as Record<string, number>,
			bySourceType: {
				pdf: 0,
				image: 0,
			} as Record<string, number>,
		};

		for (const asset of allAssets) {
			if (!asset.projectId) {
				stats.unassigned++;
			}
			stats.byStatus[asset.processingStatus]++;
			stats.bySourceType[asset.sourceType]++;
		}

		return stats;
	},
});

/**
 * Create a new asset record.
 */
export const create = mutation({
	args: {
		filename: v.string(),
		key: v.string(),
		size: v.number(),
		mimeType: v.string(),
		sourceType: v.union(v.literal("pdf"), v.literal("image")),
		projectId: v.optional(v.id("projects")),
	},
	handler: async (ctx, args) => {
		// Check if asset with this key already exists
		const existing = await ctx.db
			.query("assets")
			.withIndex("by_key", (q) => q.eq("key", args.key))
			.first();

		if (existing) {
			return existing._id;
		}

		const now = new Date().toISOString();
		const assetId = await ctx.db.insert("assets", {
			filename: args.filename,
			key: args.key,
			size: args.size,
			mimeType: args.mimeType,
			sourceType: args.sourceType,
			projectId: args.projectId,
			processingStatus: "pending",
			uploadedAt: now,
			updatedAt: now,
		});

		return assetId;
	},
});

/**
 * Assign an asset to a project (or unassign by passing undefined).
 */
export const assignToProject = mutation({
	args: {
		id: v.id("assets"),
		projectId: v.optional(v.id("projects")),
	},
	handler: async (ctx, args) => {
		const asset = await ctx.db.get(args.id);
		if (!asset) {
			throw new Error("Asset not found");
		}

		// Verify project exists if assigning
		if (args.projectId) {
			const project = await ctx.db.get(args.projectId);
			if (!project) {
				throw new Error("Project not found");
			}
		}

		await ctx.db.patch(args.id, {
			projectId: args.projectId,
			updatedAt: new Date().toISOString(),
		});

		return args.id;
	},
});

/**
 * Update the processing status of an asset.
 */
export const updateStatus = mutation({
	args: {
		id: v.id("assets"),
		status: processingStatusValidator,
		ocrJobId: v.optional(v.string()),
		extractionJobId: v.optional(v.string()),
		ocrWordCount: v.optional(v.number()),
		extractedItemCount: v.optional(v.number()),
		lastError: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const asset = await ctx.db.get(args.id);
		if (!asset) {
			throw new Error("Asset not found");
		}

		const now = new Date().toISOString();
		const updates: Record<string, unknown> = {
			processingStatus: args.status,
			updatedAt: now,
		};

		if (args.ocrJobId !== undefined) {
			updates.ocrJobId = args.ocrJobId;
		}
		if (args.extractionJobId !== undefined) {
			updates.extractionJobId = args.extractionJobId;
		}
		if (args.ocrWordCount !== undefined) {
			updates.ocrWordCount = args.ocrWordCount;
		}
		if (args.extractedItemCount !== undefined) {
			updates.extractedItemCount = args.extractedItemCount;
		}
		if (args.lastError !== undefined) {
			updates.lastError = args.lastError;
		}

		// Set processedAt when completed
		if (
			args.status === "extraction_completed" ||
			args.status === "ocr_completed"
		) {
			updates.processedAt = now;
		}

		await ctx.db.patch(args.id, updates);
		return args.id;
	},
});

/**
 * Remove an asset and its extraction results.
 */
export const remove = mutation({
	args: { id: v.id("assets") },
	handler: async (ctx, args) => {
		const asset = await ctx.db.get(args.id);
		if (!asset) {
			throw new Error("Asset not found");
		}

		// Delete extraction results for this asset
		const extractionResults = await ctx.db
			.query("extractionResults")
			.withIndex("by_asset", (q) => q.eq("assetId", args.id))
			.collect();

		for (const result of extractionResults) {
			await ctx.db.delete(result._id);
		}

		// Delete the asset
		await ctx.db.delete(args.id);

		return { key: asset.key };
	},
});

/**
 * Get assets for a specific project (used by project detail page).
 */
export const listByProject = query({
	args: { projectId: v.id("projects") },
	handler: async (ctx, args) => {
		const assets = await ctx.db
			.query("assets")
			.withIndex("by_project", (q) => q.eq("projectId", args.projectId))
			.order("desc")
			.collect();

		return assets.map((asset) => ({
			...asset,
			id: asset._id,
		}));
	},
});
