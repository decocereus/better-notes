"use client";

import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { ProcessingJobStatus, ProcessingJobSummary } from "@/types";

interface ProcessingStatusProps {
	/** Job ID to poll status for */
	jobId: string;
	/** Polling interval in ms (default: 2000) */
	pollInterval?: number;
	/** Called when job completes */
	onComplete?: (jobId: string) => void;
	/** Called when job fails */
	onError?: (jobId: string, error: string) => void;
	/** Custom class name */
	className?: string;
}

interface JobState {
	status: ProcessingJobStatus;
	progress: number;
	processedItems: number;
	totalItems: number;
	errors: Array<{ message: string }>;
	createdAt: string;
	completedAt?: string;
}

const STATUS_CONFIG: Record<
	ProcessingJobStatus,
	{
		icon: typeof Loader2;
		label: string;
		color: string;
		bgColor: string;
	}
> = {
	pending: {
		icon: Clock,
		label: "Waiting to start",
		color: "text-muted-foreground",
		bgColor: "bg-muted",
	},
	processing: {
		icon: Loader2,
		label: "Processing",
		color: "text-primary",
		bgColor: "bg-primary/10",
	},
	completed: {
		icon: CheckCircle2,
		label: "Completed",
		color: "text-green-600",
		bgColor: "bg-green-50",
	},
	failed: {
		icon: AlertCircle,
		label: "Failed",
		color: "text-destructive",
		bgColor: "bg-destructive/10",
	},
};

export function ProcessingStatus({
	jobId,
	pollInterval = 2000,
	onComplete,
	onError,
	className,
}: ProcessingStatusProps) {
	const [jobState, setJobState] = useState<JobState | null>(null);
	const [isPolling, setIsPolling] = useState(true);
	const [fetchError, setFetchError] = useState<string | null>(null);

	const fetchStatus = useCallback(async () => {
		try {
			const response = await fetch(`/api/ocr?jobId=${jobId}`);

			if (!response.ok) {
				throw new Error("Failed to fetch job status");
			}

			const data = await response.json();
			const job = data.job as JobState;

			setJobState(job);
			setFetchError(null);

			// Stop polling when job is done
			if (job.status === "completed") {
				setIsPolling(false);
				onComplete?.(jobId);
			} else if (job.status === "failed") {
				setIsPolling(false);
				const errorMessage = job.errors[0]?.message || "Processing failed";
				onError?.(jobId, errorMessage);
			}
		} catch (error) {
			setFetchError(error instanceof Error ? error.message : "Unknown error");
		}
	}, [jobId, onComplete, onError]);

	useEffect(() => {
		// Initial fetch
		fetchStatus();

		// Set up polling
		if (!isPolling) {
			return;
		}

		const intervalId = setInterval(fetchStatus, pollInterval);
		return () => clearInterval(intervalId);
	}, [fetchStatus, isPolling, pollInterval]);

	if (fetchError && !jobState) {
		return (
			<div
				className={cn(
					"rounded-lg border border-destructive/50 bg-destructive/5 p-4",
					className
				)}
			>
				<div className="flex items-center gap-2 text-destructive">
					<AlertCircle className="size-5" />
					<span>Failed to load job status: {fetchError}</span>
				</div>
			</div>
		);
	}

	if (!jobState) {
		return (
			<div className={cn("rounded-lg border p-4", className)}>
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="size-5 animate-spin" />
					<span>Loading job status...</span>
				</div>
			</div>
		);
	}

	const config = STATUS_CONFIG[jobState.status];
	const Icon = config.icon;
	const isAnimated = jobState.status === "processing";

	return (
		<div className={cn("rounded-lg border p-4", config.bgColor, className)}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Icon
						className={cn("size-5", config.color, isAnimated && "animate-spin")}
					/>
					<span className={cn("font-medium", config.color)}>
						{config.label}
					</span>
				</div>
				<span className="text-muted-foreground text-sm">
					{jobState.processedItems} / {jobState.totalItems} pages
				</span>
			</div>

			{/* Progress bar */}
			{(jobState.status === "processing" ||
				jobState.status === "completed") && (
				<div className="mt-3">
					<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
						<div
							className={cn(
								"h-full transition-all duration-500",
								jobState.status === "completed" ? "bg-green-500" : "bg-primary"
							)}
							style={{ width: `${jobState.progress}%` }}
						/>
					</div>
					<div className="mt-1 flex justify-between text-muted-foreground text-xs">
						<span>{jobState.progress}% complete</span>
						{jobState.status === "processing" && (
							<span>
								Est. remaining:{" "}
								{formatRemainingTime(
									jobState.processedItems,
									jobState.totalItems
								)}
							</span>
						)}
					</div>
				</div>
			)}

			{/* Errors */}
			{jobState.errors.length > 0 && (
				<div className="mt-3 space-y-1">
					{jobState.errors.slice(0, 3).map((error, index) => (
						<div
							className="flex items-start gap-1.5 text-destructive text-xs"
							key={`error-${index}-${error.message.slice(0, 20)}`}
						>
							<AlertCircle className="mt-0.5 size-3 shrink-0" />
							<span>{error.message}</span>
						</div>
					))}
					{jobState.errors.length > 3 && (
						<span className="text-muted-foreground text-xs">
							+{jobState.errors.length - 3} more errors
						</span>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Formats remaining time estimate.
 */
function formatRemainingTime(processed: number, total: number): string {
	if (processed === 0) {
		return "Calculating...";
	}

	const remaining = total - processed;
	// Estimate ~2.5 seconds per page
	const estimatedSeconds = remaining * 2.5;

	if (estimatedSeconds < 60) {
		return `~${Math.ceil(estimatedSeconds)}s`;
	}

	const minutes = Math.floor(estimatedSeconds / 60);
	const seconds = Math.ceil(estimatedSeconds % 60);

	if (seconds === 0) {
		return `~${minutes}m`;
	}

	return `~${minutes}m ${seconds}s`;
}

/**
 * Compact processing status for lists.
 */
export function ProcessingStatusBadge({
	summary,
}: {
	summary: ProcessingJobSummary;
}) {
	const config = STATUS_CONFIG[summary.status];
	const Icon = config.icon;
	const isAnimated = summary.status === "processing";

	return (
		<div
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
				config.bgColor
			)}
		>
			<Icon
				className={cn("size-3.5", config.color, isAnimated && "animate-spin")}
			/>
			<span className={cn("font-medium text-xs", config.color)}>
				{summary.status === "processing"
					? `${summary.progress}%`
					: config.label}
			</span>
		</div>
	);
}
