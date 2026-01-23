import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get all projects sorted by most recently updated.
 */
export const list = query({
	args: {},
	handler: async (ctx) => {
		const projects = await ctx.db
			.query("projects")
			.withIndex("by_updated")
			.order("desc")
			.collect();

		// Get sources for each project
		const projectsWithSources = await Promise.all(
			projects.map(async (project) => {
				const sources = await ctx.db
					.query("contentSources")
					.withIndex("by_project", (q) => q.eq("projectId", project._id))
					.collect();

				return {
					...project,
					id: project._id,
					sources: sources.map((s) => ({ ...s, id: s._id })),
				};
			})
		);

		return projectsWithSources;
	},
});

/**
 * Get a single project by ID.
 */
export const get = query({
	args: { id: v.id("projects") },
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.id);
		if (!project) {
			return null;
		}

		const sources = await ctx.db
			.query("contentSources")
			.withIndex("by_project", (q) => q.eq("projectId", args.id))
			.collect();

		return {
			...project,
			id: project._id,
			sources: sources.map((s) => ({ ...s, id: s._id })),
		};
	},
});

/**
 * Get projects using a specific theme page.
 * Used to warn users before deleting a theme page.
 */
export const listByThemePage = query({
	args: { themePageId: v.id("themePages") },
	handler: async (ctx, args) => {
		const projects = await ctx.db
			.query("projects")
			.withIndex("by_theme_page", (q) => q.eq("themePageId", args.themePageId))
			.collect();

		return projects.map((project) => ({
			...project,
			id: project._id,
		}));
	},
});

/**
 * Get recent projects (limited).
 */
export const recent = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = args.limit ?? 5;
		const projects = await ctx.db
			.query("projects")
			.withIndex("by_updated")
			.order("desc")
			.take(limit);

		// Get sources count for each project
		const projectsWithSources = await Promise.all(
			projects.map(async (project) => {
				const sources = await ctx.db
					.query("contentSources")
					.withIndex("by_project", (q) => q.eq("projectId", project._id))
					.collect();

				return {
					...project,
					id: project._id,
					sources: sources.map((s) => ({ ...s, id: s._id })),
				};
			})
		);

		return projectsWithSources;
	},
});

/**
 * Create a new project.
 * Requires a themePageId - projects must have a theme page.
 */
export const create = mutation({
	args: {
		name: v.string(),
		description: v.optional(v.string()),
		themePageId: v.id("themePages"),
	},
	handler: async (ctx, args) => {
		// Verify theme page exists
		const themePage = await ctx.db.get(args.themePageId);
		if (!themePage) {
			throw new Error("Theme page not found");
		}

		const now = new Date().toISOString();
		const projectId = await ctx.db.insert("projects", {
			name: args.name.trim(),
			description: args.description?.trim() || undefined,
			themePageId: args.themePageId,
			createdAt: now,
			updatedAt: now,
		});

		return projectId;
	},
});

/**
 * Update a project.
 */
export const update = mutation({
	args: {
		id: v.id("projects"),
		name: v.optional(v.string()),
		description: v.optional(v.string()),
		themePageId: v.optional(v.id("themePages")),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing) {
			throw new Error("Project not found");
		}

		const updates: Record<string, unknown> = {
			updatedAt: new Date().toISOString(),
		};

		if (args.name !== undefined) {
			updates.name = args.name.trim();
		}
		if (args.description !== undefined) {
			updates.description = args.description.trim() || undefined;
		}
		if (args.themePageId !== undefined) {
			// Verify theme page exists
			const themePage = await ctx.db.get(args.themePageId);
			if (!themePage) {
				throw new Error("Theme page not found");
			}
			updates.themePageId = args.themePageId;
		}

		await ctx.db.patch(args.id, updates);
		return args.id;
	},
});

/**
 * Delete a project and all its sources.
 */
export const remove = mutation({
	args: { id: v.id("projects") },
	handler: async (ctx, args) => {
		const existing = await ctx.db.get(args.id);
		if (!existing) {
			throw new Error("Project not found");
		}

		// Delete all sources first
		const sources = await ctx.db
			.query("contentSources")
			.withIndex("by_project", (q) => q.eq("projectId", args.id))
			.collect();

		for (const source of sources) {
			await ctx.db.delete(source._id);
		}

		// Delete the project
		await ctx.db.delete(args.id);
		return true;
	},
});

/**
 * Add a content source to a project.
 */
export const addSource = mutation({
	args: {
		projectId: v.id("projects"),
		type: v.union(
			v.literal("notion"),
			v.literal("pdf"),
			v.literal("image"),
			v.literal("url")
		),
		reference: v.string(),
		name: v.string(),
	},
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId);
		if (!project) {
			throw new Error("Project not found");
		}

		const sourceId = await ctx.db.insert("contentSources", {
			projectId: args.projectId,
			type: args.type,
			reference: args.reference,
			name: args.name,
			addedAt: new Date().toISOString(),
			status: "pending",
		});

		// Update project's updatedAt
		await ctx.db.patch(args.projectId, {
			updatedAt: new Date().toISOString(),
		});

		return sourceId;
	},
});

/**
 * Update a content source status.
 */
export const updateSource = mutation({
	args: {
		id: v.id("contentSources"),
		status: v.optional(
			v.union(
				v.literal("pending"),
				v.literal("processing"),
				v.literal("completed"),
				v.literal("failed")
			)
		),
		metadata: v.optional(v.any()),
	},
	handler: async (ctx, args) => {
		const source = await ctx.db.get(args.id);
		if (!source) {
			throw new Error("Source not found");
		}

		const updates: Record<string, unknown> = {};
		if (args.status !== undefined) {
			updates.status = args.status;
		}
		if (args.metadata !== undefined) {
			updates.metadata = args.metadata;
		}

		await ctx.db.patch(args.id, updates);

		// Update project's updatedAt
		await ctx.db.patch(source.projectId, {
			updatedAt: new Date().toISOString(),
		});

		return args.id;
	},
});

/**
 * Remove a content source.
 */
export const removeSource = mutation({
	args: { id: v.id("contentSources") },
	handler: async (ctx, args) => {
		const source = await ctx.db.get(args.id);
		if (!source) {
			throw new Error("Source not found");
		}

		// Update project's updatedAt before deleting
		await ctx.db.patch(source.projectId, {
			updatedAt: new Date().toISOString(),
		});

		await ctx.db.delete(args.id);
		return true;
	},
});
