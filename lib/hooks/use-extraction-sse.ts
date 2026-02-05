"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Events that can be received from the SSE stream.
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

interface UseExtractionSseOptions {
	jobId: string | null;
	onProgress?: (progress: number, message?: string) => void;
	onChunkComplete?: (chunkIndex: number, essaysProcessed: number) => void;
	onEssayComplete?: (essay: {
		essayIndex: number;
		essayTitle?: string;
		itemsExtracted: number;
		quality: "high" | "medium" | "low";
	}) => void;
	onCompleted?: () => void;
	onError?: (message: string, code?: string) => void;
}

interface UseExtractionSseReturn {
	/** Whether SSE is currently connected */
	isConnected: boolean;
	/** Current progress percentage (0-100) */
	progress: number;
	/** Number of items processed so far */
	processedItems: number;
	/** Total number of items to process */
	totalItems: number;
	/** Current status message */
	message: string;
	/** Whether the job has completed */
	isCompleted: boolean;
	/** Whether an error occurred */
	error: string | null;
	/** Manually disconnect the SSE connection */
	disconnect: () => void;
	/** Manually reconnect the SSE connection */
	reconnect: () => void;
}

/**
 * Hook for tracking extraction job progress via Server-Sent Events.
 * Replaces polling with a persistent connection for real-time updates.
 *
 * @example
 * ```tsx
 * const { progress, isConnected, isCompleted } = useExtractionSse({
 *   jobId: activeJobId,
 *   onProgress: (p) => console.log(`${p}% complete`),
 *   onCompleted: () => console.log("Done!"),
 * });
 * ```
 */
export function useExtractionSse({
	jobId,
	onProgress,
	onChunkComplete,
	onEssayComplete,
	onCompleted,
	onError,
}: UseExtractionSseOptions): UseExtractionSseReturn {
	const [isConnected, setIsConnected] = useState(false);
	const [progress, setProgress] = useState(0);
	const [processedItems, setProcessedItems] = useState(0);
	const [totalItems, setTotalItems] = useState(0);
	const [message, setMessage] = useState("");
	const [isCompleted, setIsCompleted] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const eventSourceRef = useRef<EventSource | null>(null);

	const callbacksRef = useRef({
		onProgress,
		onChunkComplete,
		onEssayComplete,
		onCompleted,
		onError,
	});

	useEffect(() => {
		callbacksRef.current = {
			onProgress,
			onChunkComplete,
			onEssayComplete,
			onCompleted,
			onError,
		};
	}, [onProgress, onChunkComplete, onEssayComplete, onCompleted, onError]);

	const disconnect = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
		setIsConnected(false);
	}, []);

	const connect = useCallback(() => {
		if (!jobId) {
			return;
		}
		if (eventSourceRef.current) {
			return; // Already connected
		}

		// Reset state
		setError(null);
		setIsCompleted(false);

		const eventSource = new EventSource(
			`/api/extract/sse?jobId=${encodeURIComponent(jobId)}`
		);
		eventSourceRef.current = eventSource;

		eventSource.onopen = () => {
			setIsConnected(true);
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as ExtractionEvent;

				switch (data.type) {
					case "connected":
						setIsConnected(true);
						break;

					case "progress":
						setProgress(data.progress);
						setProcessedItems(data.processedItems);
						setTotalItems(data.totalItems);
						if (data.message) {
							setMessage(data.message);
						}
						callbacksRef.current.onProgress?.(data.progress, data.message);
						break;

					case "chunk_complete":
						callbacksRef.current.onChunkComplete?.(
							data.chunkIndex,
							data.essaysProcessed
						);
						break;

					case "essay_complete":
						callbacksRef.current.onEssayComplete?.({
							essayIndex: data.essayIndex,
							essayTitle: data.essayTitle,
							itemsExtracted: data.itemsExtracted,
							quality: data.quality,
						});
						break;

					case "completed":
						setIsCompleted(true);
						setProgress(100);
						setIsConnected(false);
						eventSource.close();
						eventSourceRef.current = null;
						callbacksRef.current.onCompleted?.();
						break;

					case "error":
						setError(data.message);
						setIsConnected(false);
						eventSource.close();
						eventSourceRef.current = null;
						callbacksRef.current.onError?.(data.message, data.code);
						break;

					case "ping":
						// Keep-alive ping, no action needed
						break;

					default:
						// Ignore unknown event types
						break;
				}
			} catch (err) {
				console.error("Failed to parse SSE event:", err);
			}
		};

		eventSource.onerror = (err) => {
			console.error("SSE error:", err);
			setIsConnected(false);
		};
	}, [jobId]);

	const reconnect = useCallback(() => {
		disconnect();
		connect();
	}, [disconnect, connect]);

	// Connect when jobId changes
	useEffect(() => {
		if (jobId) {
			connect();
		} else {
			disconnect();
		}

		return () => {
			disconnect();
		};
	}, [jobId, connect, disconnect]);

	return {
		isConnected,
		progress,
		processedItems,
		totalItems,
		message,
		isCompleted,
		error,
		disconnect,
		reconnect,
	};
}
