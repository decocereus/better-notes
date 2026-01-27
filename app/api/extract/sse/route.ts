/**
 * SSE Endpoint for Extraction Job Progress
 * Streams real-time updates instead of requiring polling.
 */

import type { NextRequest } from "next/server";
import { getJob } from "@/lib/processing";

/**
 * Events that can be emitted during extraction.
 */
type ExtractionEvent =
	| { type: "connected"; jobId: string; status: string }
	| {
			type: "progress";
			progress: number;
			processedItems: number;
			totalItems: number;
			currentChunk?: number;
			totalChunks?: number;
			message?: string;
	  }
	| { type: "chunk_complete"; chunkIndex: number; essaysProcessed: number }
	| {
			type: "essay_complete";
			essayIndex: number;
			essayTitle?: string;
			itemsExtracted: number;
			quality: "high" | "medium" | "low";
	  }
	| {
			type: "completed";
			results?: {
				totalEssays: number;
				totalItems: number;
				stats: {
					byType: Record<string, number>;
					byQuality: Record<string, number>;
				};
			};
	  }
	| { type: "error"; message: string; code?: string }
	| { type: "ping" };

/**
 * GET /api/extract/sse?jobId=xxx
 * Establishes SSE connection for real-time extraction updates.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const jobId = searchParams.get("jobId");

	if (!jobId) {
		return new Response(JSON.stringify({ error: "jobId is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Verify job exists
	const job = await getJob(jobId);
	if (!job) {
		return new Response(JSON.stringify({ error: "Job not found" }), {
			status: 404,
			headers: { "Content-Type": "application/json" },
		});
	}

	// Create SSE stream
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			// Helper to send events
			const sendEvent = (event: ExtractionEvent) => {
				const data = JSON.stringify(event);
				controller.enqueue(encoder.encode(`data: ${data}\n\n`));
			};

			// Send initial connection event
			sendEvent({
				type: "connected",
				jobId,
				status: job.status,
			});

			// Send current progress if job is active
			if (job.status === "processing" && job.totalItems > 0) {
				sendEvent({
					type: "progress",
					progress: job.progress,
					processedItems: job.processedItems,
					totalItems: job.totalItems,
					message: `Processing essay ${job.processedItems} of ${job.totalItems}`,
				});
			}

			// If already completed, send completion event
			if (job.status === "completed") {
				sendEvent({ type: "completed" });
				controller.close();
				return;
			}

			// If failed, send error event
			if (job.status === "failed") {
				sendEvent({
					type: "error",
					message: job.errors[0]?.message || "Extraction failed",
					code: "EXTRACTION_FAILED",
				});
				controller.close();
				return;
			}

			// Set up ping interval to keep connection alive
			const pingInterval = setInterval(() => {
				sendEvent({ type: "ping" });
			}, 30_000); // Ping every 30 seconds

			// Poll for updates until job completes or errors
			const pollInterval = setInterval(async () => {
				try {
					const currentJob = await getJob(jobId);
					if (!currentJob) {
						clearInterval(pollInterval);
						clearInterval(pingInterval);
						controller.close();
						return;
					}

					// Send progress update if changed
					if (currentJob.status === "processing" && currentJob.totalItems > 0) {
						sendEvent({
							type: "progress",
							progress: currentJob.progress,
							processedItems: currentJob.processedItems,
							totalItems: currentJob.totalItems,
							message: `Processing essay ${currentJob.processedItems} of ${currentJob.totalItems}`,
						});
					}

					// Handle completion
					if (currentJob.status === "completed") {
						clearInterval(pollInterval);
						clearInterval(pingInterval);
						sendEvent({ type: "completed" });
						controller.close();
						return;
					}

					// Handle failure
					if (currentJob.status === "failed") {
						clearInterval(pollInterval);
						clearInterval(pingInterval);
						sendEvent({
							type: "error",
							message: currentJob.errors[0]?.message || "Extraction failed",
							code: "EXTRACTION_FAILED",
						});
						controller.close();
						return;
					}
				} catch (error) {
					// Log error but keep polling
					console.error("SSE poll error:", error);
				}
			}, 2000); // Poll every 2 seconds

			// Cleanup on client disconnect
			request.signal.addEventListener("abort", () => {
				clearInterval(pollInterval);
				clearInterval(pingInterval);
				controller.close();
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
		},
	});
}
