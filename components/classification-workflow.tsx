"use client";

import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	Play,
	RefreshCw,
	Tag,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSettings } from "@/lib/hooks/use-settings";
import { cn } from "@/lib/utils";
import type { ProcessingJobStatus } from "@/types";

interface ClassificationWorkflowProps {
	/** Extraction job ID to classify content from */
	extractionJobId: string;
	/** Called when classification completes */
	onComplete?: (classificationJobId: string) => void;
	/** Called when classification fails */
	onError?: (error: string) => void;
	/** Custom class name */
	className?: string;
}

interface ClassificationJobState {
	jobId: string;
	status: ProcessingJobStatus;
	progress: number;
	processedItems: number;
	totalItems: number;
	errors: Array<{ message: string }>;
}

interface ClassificationResults {
	stats: {
		classification: {
			totalClassified: number;
			unclassified: number;
			multiThemeCount: number;
			averageMappings: number;
		};
		aggregation: {
			themesWithContent: number;
			totalContent: number;
		};
		crossTheme: {
			totalCrossTheme: number;
			totalSingleTheme: number;
		};
	};
}

/**
 * Gets background color for job status.
 */
function getStatusBgColor(status: ProcessingJobStatus): string {
	if (status === "completed") {
		return "bg-green-100";
	}
	if (status === "failed") {
		return "bg-destructive/10";
	}
	return "bg-primary/10";
}

/**
 * Gets status title text.
 */
function getStatusTitle(status: ProcessingJobStatus): string {
	if (status === "completed") {
		return "Classification Complete";
	}
	if (status === "failed") {
		return "Classification Failed";
	}
	return "Classifying Content...";
}

/**
 * Renders the status icon based on job state.
 */
function StatusIcon({ status }: { status: ProcessingJobStatus }) {
	if (status === "processing") {
		return <Loader2 className="size-5 animate-spin text-primary" />;
	}
	if (status === "completed") {
		return <CheckCircle2 className="size-5 text-green-600" />;
	}
	return <AlertCircle className="size-5 text-destructive" />;
}

/**
 * Workflow component for classifying extracted content into themes.
 */
export function ClassificationWorkflow({
	extractionJobId,
	onComplete,
	onError,
	className,
}: ClassificationWorkflowProps) {
	const { settings } = useSettings();

	const [jobState, setJobState] = useState<ClassificationJobState | null>(null);
	const [results, setResults] = useState<ClassificationResults | null>(null);
	const [isStarting, setIsStarting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const hasThemePage = Boolean(settings.themePageId);

	const startClassification = useStartClassification({
		extractionJobId,
		themePageId: settings.themePageId,
		setJobState,
		setError,
		setIsStarting,
		onError,
	});

	const pollJobStatus = usePollJobStatus({
		jobState,
		setJobState,
		setResults,
		setError,
		onComplete,
		onError,
	});

	// Poll for job status
	useEffect(() => {
		const shouldPoll =
			jobState &&
			jobState.status !== "completed" &&
			jobState.status !== "failed";

		if (!shouldPoll) {
			return;
		}

		const intervalId = setInterval(pollJobStatus, 2000);
		return () => clearInterval(intervalId);
	}, [jobState, pollJobStatus]);

	// Not started state
	if (!(jobState || error)) {
		return (
			<NotStartedState
				className={className}
				hasThemePage={hasThemePage}
				isStarting={isStarting}
				onStart={startClassification}
			/>
		);
	}

	// Error state without job
	if (error && !jobState) {
		return (
			<ErrorState
				className={className}
				error={error}
				onRetry={startClassification}
			/>
		);
	}

	// Processing/completed/failed state
	if (jobState) {
		return (
			<ProcessingState
				className={className}
				jobState={jobState}
				onRetry={startClassification}
				results={results}
			/>
		);
	}

	return null;
}

/**
 * Hook to handle starting classification.
 */
function useStartClassification({
	extractionJobId,
	themePageId,
	setJobState,
	setError,
	setIsStarting,
	onError,
}: {
	extractionJobId: string;
	themePageId: string | undefined;
	setJobState: (state: ClassificationJobState | null) => void;
	setError: (error: string | null) => void;
	setIsStarting: (starting: boolean) => void;
	onError?: (error: string) => void;
}) {
	return useCallback(async () => {
		if (!themePageId) {
			setError("No theme page selected. Please configure in Themes settings.");
			return;
		}

		setIsStarting(true);
		setError(null);

		try {
			const response = await fetch("/api/classify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ extractionJobId, themePageId }),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error || "Failed to start classification");
			}

			const data = (await response.json()) as {
				jobId: string;
				status: ProcessingJobStatus;
				totalItems: number;
			};

			setJobState({
				jobId: data.jobId,
				status: data.status,
				progress: 0,
				processedItems: 0,
				totalItems: data.totalItems,
				errors: [],
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to start classification";
			setError(message);
			onError?.(message);
		} finally {
			setIsStarting(false);
		}
	}, [
		extractionJobId,
		themePageId,
		setJobState,
		setError,
		setIsStarting,
		onError,
	]);
}

/**
 * Handles the job status response and calls appropriate callbacks.
 */
function handleJobStatusResponse(
	data: { job: ClassificationJobState; results?: ClassificationResults },
	jobId: string,
	callbacks: {
		setJobState: (state: ClassificationJobState) => void;
		setResults: (results: ClassificationResults | null) => void;
		setError: (error: string | null) => void;
		onComplete?: (jobId: string) => void;
		onError?: (error: string) => void;
	}
) {
	const { setJobState, setResults, setError, onComplete, onError } = callbacks;

	setJobState({
		jobId,
		status: data.job.status,
		progress: data.job.progress,
		processedItems: data.job.processedItems,
		totalItems: data.job.totalItems,
		errors: data.job.errors || [],
	});

	if (data.job.status === "completed" && data.results) {
		setResults(data.results);
		onComplete?.(jobId);
	} else if (data.job.status === "failed") {
		const errorMessage =
			data.job.errors?.[0]?.message || "Classification failed";
		setError(errorMessage);
		onError?.(errorMessage);
	}
}

/**
 * Hook to handle polling job status.
 */
function usePollJobStatus({
	jobState,
	setJobState,
	setResults,
	setError,
	onComplete,
	onError,
}: {
	jobState: ClassificationJobState | null;
	setJobState: (state: ClassificationJobState) => void;
	setResults: (results: ClassificationResults | null) => void;
	setError: (error: string | null) => void;
	onComplete?: (jobId: string) => void;
	onError?: (error: string) => void;
}) {
	return useCallback(async () => {
		if (!jobState?.jobId) {
			return;
		}

		try {
			const response = await fetch(`/api/classify?jobId=${jobState.jobId}`);

			if (!response.ok) {
				throw new Error("Failed to fetch job status");
			}

			const data = (await response.json()) as {
				job: ClassificationJobState;
				results?: ClassificationResults;
			};

			handleJobStatusResponse(data, jobState.jobId, {
				setJobState,
				setResults,
				setError,
				onComplete,
				onError,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to poll status");
		}
	}, [jobState?.jobId, setJobState, setResults, setError, onComplete, onError]);
}

/**
 * Not started state component.
 */
function NotStartedState({
	hasThemePage,
	isStarting,
	onStart,
	className,
}: {
	hasThemePage: boolean;
	isStarting: boolean;
	onStart: () => void;
	className?: string;
}) {
	return (
		<Card className={cn("p-4", className)}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<div className="rounded-lg bg-muted p-2">
						<Tag className="size-5 text-muted-foreground" />
					</div>
					<div>
						<h4 className="font-medium">Theme Classification</h4>
						<p className="text-muted-foreground text-sm">
							{hasThemePage
								? "Classify extracted content into themes"
								: "Configure theme page in Themes settings first"}
						</p>
					</div>
				</div>
				<Button disabled={!hasThemePage || isStarting} onClick={onStart}>
					{isStarting ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							Starting...
						</>
					) : (
						<>
							<Play className="size-4" />
							Start Classification
						</>
					)}
				</Button>
			</div>
		</Card>
	);
}

/**
 * Error state component.
 */
function ErrorState({
	error,
	onRetry,
	className,
}: {
	error: string;
	onRetry: () => void;
	className?: string;
}) {
	return (
		<Card
			className={cn("border-destructive/50 bg-destructive/5 p-4", className)}
		>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<AlertCircle className="size-5 text-destructive" />
					<div>
						<h4 className="font-medium text-destructive">
							Classification Failed
						</h4>
						<p className="text-destructive/80 text-sm">{error}</p>
					</div>
				</div>
				<Button onClick={onRetry} variant="outline">
					<RefreshCw className="size-4" />
					Retry
				</Button>
			</div>
		</Card>
	);
}

/**
 * Processing state component.
 */
function ProcessingState({
	jobState,
	results,
	onRetry,
	className,
}: {
	jobState: ClassificationJobState;
	results: ClassificationResults | null;
	onRetry: () => void;
	className?: string;
}) {
	const isProcessing = jobState.status === "processing";
	const isCompleted = jobState.status === "completed";
	const isFailed = jobState.status === "failed";

	return (
		<Card className={cn("p-4", className)}>
			<div className="space-y-4">
				{/* Header */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className={cn(
								"rounded-lg p-2",
								getStatusBgColor(jobState.status)
							)}
						>
							<StatusIcon status={jobState.status} />
						</div>
						<div>
							<h4 className="font-medium">{getStatusTitle(jobState.status)}</h4>
							<p className="text-muted-foreground text-sm">
								{jobState.processedItems} / {jobState.totalItems} items
							</p>
						</div>
					</div>
					{isFailed && (
						<Button onClick={onRetry} variant="outline">
							<RefreshCw className="size-4" />
							Retry
						</Button>
					)}
				</div>

				{/* Progress bar */}
				{(isProcessing || isCompleted) && (
					<ProgressBar isComplete={isCompleted} progress={jobState.progress} />
				)}

				{/* Results */}
				{isCompleted && results && <ResultsSummary results={results} />}

				{/* Errors */}
				{jobState.errors.length > 0 && <ErrorList errors={jobState.errors} />}
			</div>
		</Card>
	);
}

/**
 * Progress bar component.
 */
function ProgressBar({
	progress,
	isComplete,
}: {
	progress: number;
	isComplete: boolean;
}) {
	return (
		<div>
			<div className="h-2 w-full overflow-hidden rounded-full bg-muted">
				<div
					className={cn(
						"h-full transition-all duration-500",
						isComplete ? "bg-green-500" : "bg-primary"
					)}
					style={{ width: `${progress}%` }}
				/>
			</div>
			<p className="mt-1 text-muted-foreground text-xs">{progress}% complete</p>
		</div>
	);
}

/**
 * Results summary component.
 */
function ResultsSummary({ results }: { results: ClassificationResults }) {
	return (
		<div className="rounded-lg border bg-muted/30 p-3">
			<div className="flex flex-wrap gap-2">
				<Badge variant="secondary">
					{results.stats.classification.totalClassified} classified
				</Badge>
				<Badge variant="outline">
					{results.stats.aggregation.themesWithContent} themes covered
				</Badge>
				<Badge className="bg-blue-500/10 text-blue-700" variant="outline">
					{results.stats.classification.multiThemeCount} multi-theme
				</Badge>
				<Badge variant="outline">
					{results.stats.classification.averageMappings.toFixed(1)} avg
					themes/item
				</Badge>
			</div>
		</div>
	);
}

/**
 * Error list component.
 */
function ErrorList({ errors }: { errors: Array<{ message: string }> }) {
	return (
		<div className="space-y-1">
			{errors.slice(0, 3).map((err, index) => (
				<div
					className="flex items-start gap-1.5 text-destructive text-xs"
					key={`error-${index}-${err.message.slice(0, 20)}`}
				>
					<AlertCircle className="mt-0.5 size-3 shrink-0" />
					<span>{err.message}</span>
				</div>
			))}
		</div>
	);
}

/**
 * Compact badge for showing classification status.
 */
export function ClassificationStatusBadge({
	status,
	progress,
}: {
	status: ProcessingJobStatus;
	progress: number;
}) {
	const config = {
		pending: { color: "bg-muted text-muted-foreground", label: "Pending" },
		processing: { color: "bg-primary/10 text-primary", label: `${progress}%` },
		completed: { color: "bg-green-100 text-green-700", label: "Classified" },
		failed: { color: "bg-destructive/10 text-destructive", label: "Failed" },
	};

	const { color, label } = config[status];

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs",
				color
			)}
		>
			{status === "processing" && <Loader2 className="size-3 animate-spin" />}
			{status === "completed" && <Tag className="size-3" />}
			{label}
		</span>
	);
}
