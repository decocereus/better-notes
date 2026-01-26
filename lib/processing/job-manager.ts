/**
 * Processing Job Manager
 * Manages long-running processing jobs (OCR, extraction, classification).
 * Jobs are stored in R2 for persistence and can be queried for status.
 */

import {
	downloadFromR2,
	generateProcessingResultKey,
	getR2FileInfo,
	uploadToR2,
} from "@/lib/storage";
import type {
	ProcessingError,
	ProcessingJob,
	ProcessingJobResult,
	ProcessingJobStatus,
	ProcessingJobSummary,
	ProcessingJobType,
} from "@/types";

/** In-memory cache for active jobs (server-side only) */
const activeJobsCache = new Map<string, ProcessingJob>();
const jobPersistQueue = new Map<string, Promise<void>>();
const jobPersistLast = new Map<string, number>();

const JOB_PERSIST_MIN_INTERVAL_MS = 1500;

function sleep(durationMs: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, durationMs);
	});
}

function isServiceUnavailableError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	const errorWithCode = error as Error & { Code?: string; $metadata?: object };
	return (
		error.name === "ServiceUnavailable" ||
		errorWithCode.Code === "ServiceUnavailable"
	);
}

async function uploadWithRetry(
	key: string,
	body: Buffer,
	contentType: string,
	attempts = 3
): Promise<void> {
	let attempt = 0;
	let delayMs = 250;

	while (attempt < attempts) {
		try {
			await uploadToR2(key, body, contentType);
			return;
		} catch (error) {
			attempt += 1;
			if (!isServiceUnavailableError(error) || attempt >= attempts) {
				throw error;
			}

			await sleep(delayMs);
			delayMs *= 2;
		}
	}
}

/**
 * Creates a new processing job.
 */
export async function createJob(
	type: ProcessingJobType,
	sourceKey: string,
	projectId?: string,
	totalItems = 0
): Promise<ProcessingJob> {
	const job: ProcessingJob = {
		id: crypto.randomUUID(),
		type,
		status: "pending",
		progress: 0,
		totalItems,
		processedItems: 0,
		sourceKey,
		projectId,
		results: [],
		errors: [],
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	};

	// Cache the job
	activeJobsCache.set(job.id, job);

	// Persist to R2
	await persistJob(job, { force: true });

	return job;
}

/**
 * Gets a job by ID.
 */
export async function getJob(jobId: string): Promise<ProcessingJob | null> {
	// Check cache first
	if (activeJobsCache.has(jobId)) {
		return activeJobsCache.get(jobId) ?? null;
	}

	// Load from R2
	const key = generateProcessingResultKey(jobId, "job");
	const fileInfo = await getR2FileInfo(key);

	if (!fileInfo.exists) {
		return null;
	}

	try {
		const { body } = await downloadFromR2(key);
		const text = await streamToString(body);
		const job = JSON.parse(text) as ProcessingJob;

		// Cache if active
		if (job.status === "pending" || job.status === "processing") {
			activeJobsCache.set(jobId, job);
		}

		return job;
	} catch {
		return null;
	}
}

/**
 * Updates a job's status.
 */
export async function updateJobStatus(
	jobId: string,
	status: ProcessingJobStatus
): Promise<void> {
	const job = await getJob(jobId);
	if (!job) {
		throw new Error(`Job not found: ${jobId}`);
	}

	job.status = status;
	job.updatedAt = new Date().toISOString();

	if (status === "completed" || status === "failed") {
		job.completedAt = new Date().toISOString();
		// Remove from active cache
		activeJobsCache.delete(jobId);
	}

	activeJobsCache.set(jobId, job);
	await persistJob(job, { force: true });

	if (status === "completed" || status === "failed") {
		jobPersistQueue.delete(jobId);
		jobPersistLast.delete(jobId);
	}
}

/**
 * Updates a job's progress.
 */
export async function updateJobProgress(
	jobId: string,
	processedItems: number,
	totalItems?: number
): Promise<void> {
	const job = await getJob(jobId);
	if (!job) {
		throw new Error(`Job not found: ${jobId}`);
	}

	job.processedItems = processedItems;
	if (totalItems !== undefined) {
		job.totalItems = totalItems;
	}

	// Calculate progress percentage
	if (job.totalItems > 0) {
		job.progress = Math.round((job.processedItems / job.totalItems) * 100);
	}

	job.updatedAt = new Date().toISOString();

	// Update status to processing if not already
	if (job.status === "pending") {
		job.status = "processing";
	}

	activeJobsCache.set(jobId, job);
	await persistJob(job, { bestEffort: true });
}

/**
 * Adds a result to a job.
 */
export async function addJobResult(
	jobId: string,
	data: unknown,
	itemIndex?: number
): Promise<void> {
	const job = await getJob(jobId);
	if (!job) {
		throw new Error(`Job not found: ${jobId}`);
	}

	const result: ProcessingJobResult = {
		itemIndex: itemIndex ?? job.results.length,
		data,
		processedAt: new Date().toISOString(),
	};

	job.results.push(result);
	job.processedItems = job.results.length;
	job.updatedAt = new Date().toISOString();

	// Update progress
	if (job.totalItems > 0) {
		job.progress = Math.round((job.processedItems / job.totalItems) * 100);
	}

	activeJobsCache.set(jobId, job);
	await persistJob(job, { bestEffort: true });
}

/**
 * Adds an error to a job.
 */
export async function addJobError(
	jobId: string,
	message: string,
	itemIndex?: number,
	code?: string
): Promise<void> {
	const job = await getJob(jobId);
	if (!job) {
		throw new Error(`Job not found: ${jobId}`);
	}

	const error: ProcessingError = {
		itemIndex,
		message,
		code,
		timestamp: new Date().toISOString(),
	};

	job.errors.push(error);
	job.updatedAt = new Date().toISOString();

	activeJobsCache.set(jobId, job);
	await persistJob(job, { bestEffort: true });
}

/**
 * Marks a job as completed.
 */
export async function completeJob(jobId: string): Promise<void> {
	await updateJobStatus(jobId, "completed");
}

/**
 * Marks a job as failed.
 */
export async function failJob(
	jobId: string,
	errorMessage: string
): Promise<void> {
	await addJobError(jobId, errorMessage);
	await updateJobStatus(jobId, "failed");
}

/**
 * Gets a summary of a job for display.
 */
export function getJobSummary(job: ProcessingJob): ProcessingJobSummary {
	return {
		id: job.id,
		type: job.type,
		status: job.status,
		progress: job.progress,
		sourceKey: job.sourceKey,
		createdAt: job.createdAt,
		completedAt: job.completedAt,
		errorCount: job.errors.length,
	};
}

/**
 * Lists all jobs for a project.
 */
export function listProjectJobs(projectId: string): ProcessingJobSummary[] {
	// For now, return cached jobs that match the project
	// In production, this would query R2 or a database
	const jobs: ProcessingJobSummary[] = [];

	for (const job of activeJobsCache.values()) {
		if (job.projectId === projectId) {
			jobs.push(getJobSummary(job));
		}
	}

	return jobs.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);
}

/**
 * Lists active (pending/processing) jobs.
 */
export function listActiveJobs(): ProcessingJobSummary[] {
	const jobs: ProcessingJobSummary[] = [];

	for (const job of activeJobsCache.values()) {
		if (job.status === "pending" || job.status === "processing") {
			jobs.push(getJobSummary(job));
		}
	}

	return jobs.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
	);
}

/**
 * Persists a job to R2.
 */
async function persistJob(
	job: ProcessingJob,
	options: { force?: boolean; bestEffort?: boolean } = {}
): Promise<void> {
	const key = generateProcessingResultKey(job.id, "job");
	const data = JSON.stringify(job, null, 2);
	const { force = false, bestEffort = false } = options;

	const previous = jobPersistQueue.get(job.id) ?? Promise.resolve();
	const next = previous
		.catch(() => undefined)
		.then(async () => {
			const now = Date.now();
			const lastPersist = jobPersistLast.get(job.id) ?? 0;
			const waitMs = Math.max(
				0,
				(force ? 0 : JOB_PERSIST_MIN_INTERVAL_MS) - (now - lastPersist)
			);

			if (bestEffort && waitMs > 0) {
				return;
			}

			if (waitMs > 0) {
				await sleep(waitMs);
			}

			try {
				await uploadWithRetry(key, Buffer.from(data), "application/json");
				jobPersistLast.set(job.id, Date.now());
			} catch (error) {
				if (bestEffort) {
					console.warn(`[Jobs] Failed to persist job ${job.id}:`, error);
					return;
				}
				throw error;
			}
		});

	jobPersistQueue.set(job.id, next);
	await next;
}

/**
 * Converts a ReadableStream to string.
 */
async function streamToString(stream: ReadableStream): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	let done = false;
	while (!done) {
		const result = await reader.read();
		done = result.done;
		if (result.value) {
			chunks.push(result.value);
		}
	}

	const combined = new Uint8Array(
		chunks.reduce((acc, chunk) => acc + chunk.length, 0)
	);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}

	return new TextDecoder().decode(combined);
}
