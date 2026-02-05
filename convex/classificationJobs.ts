import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByProject = query({
	args: { projectId: v.id("projects") },
	handler: async (ctx, { projectId }) => {
		const jobs = await ctx.db
			.query("classificationJobs")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.order("desc")
			.collect();
		return jobs.map((job) => ({ ...job, id: job._id }));
	},
});

export const getLatestByProject = query({
	args: { projectId: v.id("projects") },
	handler: async (ctx, { projectId }) => {
		const job = await ctx.db
			.query("classificationJobs")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.order("desc")
			.first();
		if (!job) {
			return null;
		}
		return { ...job, id: job._id };
	},
});

export const upsert = mutation({
	args: {
		projectId: v.id("projects"),
		themePageId: v.id("themePages"),
		jobId: v.string(),
		status: v.union(
			v.literal("pending"),
			v.literal("processing"),
			v.literal("completed"),
			v.literal("failed")
		),
		progress: v.number(),
		totalItems: v.number(),
		classifiedItems: v.number(),
		resultsKey: v.string(),
		stats: v.optional(
			v.object({
				classified: v.number(),
				unclassified: v.number(),
				multiTheme: v.number(),
				themesWithContent: v.number(),
			})
		),
		error: v.optional(v.string()),
		completedAt: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("classificationJobs")
			.withIndex("by_job_id", (q) => q.eq("jobId", args.jobId))
			.first();

		const now = new Date().toISOString();

		if (existing) {
			await ctx.db.patch(existing._id, {
				status: args.status,
				progress: args.progress,
				totalItems: args.totalItems,
				classifiedItems: args.classifiedItems,
				resultsKey: args.resultsKey,
				stats: args.stats,
				error: args.error,
				completedAt: args.completedAt,
			});
			return existing._id;
		}

		return await ctx.db.insert("classificationJobs", {
			...args,
			createdAt: now,
		});
	},
});

export const remove = mutation({
	args: { id: v.id("classificationJobs") },
	handler: async (ctx, { id }) => {
		await ctx.db.delete(id);
	},
});

export const removeByProject = mutation({
	args: { projectId: v.id("projects") },
	handler: async (ctx, { projectId }) => {
		const jobs = await ctx.db
			.query("classificationJobs")
			.withIndex("by_project", (q) => q.eq("projectId", projectId))
			.collect();
		for (const job of jobs) {
			await ctx.db.delete(job._id);
		}
		return jobs.length;
	},
});
