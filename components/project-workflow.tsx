"use client";

import { useQuery } from "convex/react";
import {
	AlertCircle,
	BarChart3,
	BookOpen,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	FileText,
	Link as LinkIcon,
	Loader2,
	type LucideIcon,
	Play,
	RefreshCw,
	Sparkles,
	Tag,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ClassificationReview } from "@/components/classification-review";
import { ComparisonResults } from "@/components/comparison-results";
import { NoteGenerationPanel } from "@/components/note-generation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/convex/_generated/api";
import { aggregateContentByTheme } from "@/lib/classification/aggregator";
import { useSettings } from "@/lib/hooks/use-settings";
import type { Asset } from "@/types/asset";
import type { ThemeComparisonResult } from "@/types/comparison";
import type {
	ExtractedContent,
	ExtractionParameters,
} from "@/types/extraction";
import type { GeneratedNote } from "@/types/generation";
import type { ContentSource } from "@/types/project";
import type { MainTheme, MiniTheme } from "@/types/theme";

// ============================================================================
// TYPES
// ============================================================================

interface ProjectWorkflowProps {
	projectId: string;
	themePageId: string;
	assets: Asset[];
	sources: ContentSource[];
	themes: MainTheme[];
}

interface ClassificationState {
	jobId: string | null;
	status: "idle" | "processing" | "completed" | "failed";
	progress: number;
	totalItems: number;
	processedItems: number;
	error?: string;
	results: ClassificationResults | null;
}

interface ClassificationResults {
	themes: MainTheme[];
	classifiedContent: ExtractedContent[];
	stats: {
		classification?: {
			totalClassified: number;
			unclassified: number;
			multiThemeCount: number;
			averageMappings: number;
		};
		aggregation?: {
			themesWithContent: number;
			totalContent: number;
		};
	};
}

interface ComparisonState {
	[themeId: string]: {
		jobId: string | null;
		status: "idle" | "processing" | "completed" | "failed";
		result: ThemeComparisonResult | null;
		error?: string;
	};
}

interface StatusItem {
	id: string;
	label: string;
	icon: LucideIcon;
	error?: string;
}

interface RetryFailedItemsInput {
	failedSources: ContentSource[];
	failedAssets: Asset[];
	projectId: string;
	modelConfig?: Record<string, string>;
	parameters?: ExtractionParameters;
	setIsRetryingFailed: (value: boolean) => void;
	setRetryError: (value: string | null) => void;
}

interface StartComparisonInput {
	classificationJobId: string | null;
	mainTheme: MainTheme;
	miniTheme: MiniTheme;
	modelConfig?: Record<string, string>;
	setComparisons: (
		value: ComparisonState | ((prev: ComparisonState) => ComparisonState)
	) => void;
}

async function startComparisonForTheme({
	classificationJobId,
	mainTheme,
	miniTheme,
	modelConfig,
	setComparisons,
}: StartComparisonInput) {
	if (!classificationJobId) {
		return;
	}

	const themeKey = `${mainTheme.id}-${miniTheme.id}`;

	setComparisons((prev) => ({
		...prev,
		[themeKey]: {
			jobId: null,
			status: "processing",
			result: null,
			error: undefined,
		},
	}));

	try {
		const response = await fetch("/api/compare", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				classificationJobId,
				mainThemeId: mainTheme.id,
				miniThemeId: miniTheme.id,
				userContentIds: "all",
				topperContentIds: "all",
				modelConfig,
			}),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || "Failed to start comparison");
		}

		const data = await response.json();

		// Poll for comparison result
		const pollComparison = async () => {
			const statusRes = await fetch(`/api/compare?jobId=${data.jobId}`);
			const statusData = await statusRes.json();

			if (statusData.job.status === "completed" && statusData.results) {
				setComparisons((prev) => ({
					...prev,
					[themeKey]: {
						jobId: data.jobId,
						status: "completed",
						result: statusData.results.result,
						error: undefined,
					},
				}));
			} else if (statusData.job.status === "failed") {
				setComparisons((prev) => ({
					...prev,
					[themeKey]: {
						jobId: data.jobId,
						status: "failed",
						result: null,
						error: statusData.job.errors?.[0]?.message ?? "Comparison failed",
					},
				}));
			} else {
				setTimeout(pollComparison, 2000);
			}
		};

		pollComparison();
	} catch {
		setComparisons((prev) => ({
			...prev,
			[themeKey]: {
				jobId: null,
				status: "failed",
				result: null,
				error: "Failed to start comparison",
			},
		}));
	}
}

async function retryFailedItems({
	failedSources,
	failedAssets,
	projectId,
	modelConfig,
	parameters,
	setIsRetryingFailed,
	setRetryError,
}: RetryFailedItemsInput) {
	if (failedSources.length === 0 && failedAssets.length === 0) {
		return;
	}

	setIsRetryingFailed(true);
	setRetryError(null);

	try {
		const tasks: Promise<Response>[] = [];

		for (const source of failedSources) {
			tasks.push(
				fetch("/api/sources/process", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						projectId,
						pageId: source.reference,
						type: source.type,
						modelConfig,
						parameters,
					}),
				})
			);
		}

		for (const asset of failedAssets) {
			tasks.push(
				fetch(`/api/assets/${asset.id}/process`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						parameters,
						modelConfig,
					}),
				})
			);
		}

		const results = await Promise.allSettled(tasks);
		const failedCount = results.filter((result) => {
			if (result.status === "rejected") {
				return true;
			}
			return !result.value.ok;
		}).length;

		if (failedCount > 0) {
			setRetryError(`Failed to retry ${failedCount} item(s).`);
		}
	} finally {
		setIsRetryingFailed(false);
	}
}

// ============================================================================
// MAIN WORKFLOW COMPONENT
// ============================================================================

export function ProjectWorkflow(props: ProjectWorkflowProps) {
	const {
		projectId: projectIdValue,
		themePageId,
		assets,
		sources,
		themes,
	} = props;
	const { settings } = useSettings();

	// Load persisted pipeline state from Convex
	const latestClassification = useQuery(
		api.classificationJobs.getLatestByProject,
		projectIdValue ? { projectId: projectIdValue as never } : "skip"
	);
	const persistedComparisons = useQuery(
		api.comparisonResults.listByProject,
		projectIdValue ? { projectId: projectIdValue as never } : "skip"
	);
	const _persistedNotes = useQuery(
		api.generatedNotes.listByProject,
		projectIdValue ? { projectId: projectIdValue as never } : "skip"
	);

	// Get assets by processing status
	const completedAssets = assets.filter(
		(a) => a.processingStatus === "extraction_completed"
	);
	const processingAssets = assets.filter(
		(a) =>
			a.processingStatus === "extraction_processing" ||
			a.processingStatus === "ocr_processing" ||
			a.processingStatus === "conversion_processing"
	);
	const pendingAssets = assets.filter(
		(a) =>
			a.processingStatus === "pending" ||
			a.processingStatus === "conversion_queued" ||
			a.processingStatus === "ocr_queued" ||
			a.processingStatus === "extraction_queued"
	);
	const failedAssets = assets.filter(
		(a) =>
			a.processingStatus === "extraction_failed" ||
			a.processingStatus === "ocr_failed" ||
			a.processingStatus === "conversion_failed"
	);

	const notionSources = sources.filter((source) => source.type === "notion");
	const processingSources = notionSources.filter(
		(source) => source.status === "processing"
	);
	const pendingSources = notionSources.filter(
		(source) => source.status === "pending"
	);
	const failedSources = notionSources.filter(
		(source) => source.status === "failed"
	);

	const completedNotionSources = sources.filter(
		(source) =>
			source.type === "notion" &&
			source.status === "completed" &&
			(source.metadata?.extraction?.items?.length ?? 0) > 0
	);

	const processingItems: StatusItem[] = [
		...processingAssets.map((asset) => ({
			id: asset.id,
			label: asset.filename,
			icon: FileText,
		})),
		...processingSources.map((source) => ({
			id: source.id,
			label: source.name,
			icon: LinkIcon,
		})),
	];

	const pendingItems: StatusItem[] = [
		...pendingAssets.map((asset) => ({
			id: asset.id,
			label: asset.filename,
			icon: FileText,
		})),
		...pendingSources.map((source) => ({
			id: source.id,
			label: source.name,
			icon: LinkIcon,
		})),
	];

	const failedItems: StatusItem[] = [
		...failedAssets.map((asset) => ({
			id: asset.id,
			label: asset.filename,
			icon: FileText,
			error: asset.lastError,
		})),
		...failedSources.map((source) => ({
			id: source.id,
			label: source.name,
			icon: LinkIcon,
			error:
				source.error ??
				(typeof source.metadata?.error === "string"
					? source.metadata.error
					: undefined),
		})),
	];

	const hasExtractedContent =
		completedAssets.length > 0 || completedNotionSources.length > 0;
	const isExtracting = processingItems.length > 0 || pendingItems.length > 0;
	const hasInFlightSources =
		processingItems.length > 0 || pendingItems.length > 0;

	// Classification state
	const [classification, setClassification] = useState<ClassificationState>({
		jobId: null,
		status: "idle",
		progress: 0,
		totalItems: 0,
		processedItems: 0,
		error: undefined,
		results: null,
	});
	const [retryError, setRetryError] = useState<string | null>(null);
	const [isRetryingFailed, setIsRetryingFailed] = useState(false);

	// Comparison state per theme
	const [comparisons, setComparisons] = useState<ComparisonState>({});

	// Selected theme for actions
	const [_selectedMiniTheme, _setSelectedMiniTheme] = useState<{
		mainTheme: MainTheme;
		miniTheme: MiniTheme;
	} | null>(null);

	// Poll for classification status
	const pollClassificationStatus = useCallback(async (jobId: string) => {
		try {
			const response = await fetch(`/api/classify?jobId=${jobId}`);
			if (!response.ok) {
				return;
			}

			const data = await response.json();
			if (data.job) {
				setClassification((prev) => ({
					...prev,
					jobId,
					status: data.job.status,
					progress: data.job.progress,
					processedItems: data.job.processedItems,
					totalItems: data.job.totalItems,
					results: data.results || null,
					error:
						data.job.status === "failed"
							? (data.job.errors?.[0]?.message ?? "Classification failed")
							: undefined,
				}));

				// Continue polling while job is pending or processing
				if (data.job.status === "pending" || data.job.status === "processing") {
					setTimeout(() => pollClassificationStatus(jobId), 2000);
				}
			}
		} catch {
			// Ignore errors
		}
	}, []);

	// Initialize classification state from Convex
	useEffect(() => {
		if (latestClassification && latestClassification.status === "completed") {
			setClassification((prev) => ({
				...prev,
				jobId: latestClassification.jobId,
				status: "completed",
				progress: 100,
				totalItems: latestClassification.totalItems,
				processedItems: latestClassification.classifiedItems,
			}));
		}
	}, [latestClassification]);

	// Initialize comparison scores from Convex
	useEffect(() => {
		if (persistedComparisons && persistedComparisons.length > 0) {
			setComparisons((prev) => {
				const next = { ...prev };
				for (const comp of persistedComparisons) {
					if (comp.status === "completed") {
						next[comp.miniThemeId] = {
							...next[comp.miniThemeId],
							status: "completed",
							score: comp.score,
							jobId: comp.jobId,
						} as ComparisonState[string];
					}
				}
				return next;
			});
		}
	}, [persistedComparisons]);

	// Resume polling for in-progress classification from Convex
	useEffect(() => {
		if (
			latestClassification &&
			(latestClassification.status === "pending" ||
				latestClassification.status === "processing") &&
			classification.status === "idle"
		) {
			pollClassificationStatus(latestClassification.jobId);
		}
	}, [latestClassification, classification.status, pollClassificationStatus]);

	const startClassification = async () => {
		if (!hasExtractedContent || hasInFlightSources) {
			return;
		}

		// Clear previous results when starting new classification
		setClassification({
			jobId: null,
			status: "processing",
			progress: 0,
			totalItems: 0,
			processedItems: 0,
			error: undefined,
			results: null,
		});

		try {
			const response = await fetch("/api/classify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: projectIdValue,
					themePageId,
					modelConfig: settings.modelConfig,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to start classification");
			}

			const data = await response.json();
			pollClassificationStatus(data.jobId);
		} catch (_error) {
			setClassification((prev) => ({
				...prev,
				status: "failed",
				error:
					_error instanceof Error
						? _error.message
						: "Failed to start classification",
			}));
		}
	};

	const startComparison = useCallback(
		(mainTheme: MainTheme, miniTheme: MiniTheme) => {
			if (!classification.results) {
				return;
			}

			startComparisonForTheme({
				classificationJobId: classification.jobId,
				mainTheme,
				miniTheme,
				modelConfig: settings.modelConfig,
				setComparisons,
			});
		},
		[classification.jobId, classification.results, settings.modelConfig]
	);

	const getContentForTheme = (
		mainThemeId: string,
		miniThemeId: string
	): ExtractedContent[] => {
		if (!classification.results) {
			return [];
		}

		return classification.results.classifiedContent.filter((c) =>
			c.themes.some(
				(t) => t.mainThemeId === mainThemeId && t.miniThemeId === miniThemeId
			)
		);
	};

	const handleRetryFailedItems = useCallback(() => {
		retryFailedItems({
			failedSources,
			failedAssets,
			projectId: projectIdValue,
			modelConfig: settings.modelConfig,
			parameters: settings.extractionParameters,
			setIsRetryingFailed,
			setRetryError,
		});
	}, [
		failedSources,
		failedAssets,
		projectIdValue,
		settings.modelConfig,
		settings.extractionParameters,
	]);

	// ============================================================================
	// RENDER
	// ============================================================================

	const reviewStats = useMemo(() => {
		const stats = classification.results?.stats?.classification;
		if (!stats) {
			return null;
		}
		return {
			totalClassified: stats.totalClassified,
			unclassified: stats.unclassified,
			multiThemeCount: stats.multiThemeCount,
			averageMappings: stats.averageMappings,
		};
	}, [classification.results]);

	const aggregatedContent = useMemo(() => {
		if (!classification.results) {
			return [];
		}
		return aggregateContentByTheme(
			classification.results.classifiedContent,
			themes
		);
	}, [classification.results, themes]);

	return (
		<div className="space-y-6">
			<ExtractionStatusCard
				isExtracting={isExtracting}
				pendingItems={pendingItems}
				processingItems={processingItems}
			/>

			<FailedItemsCard
				failedItems={failedItems}
				isRetryingFailed={isRetryingFailed}
				onRetry={handleRetryFailedItems}
				retryError={retryError}
			/>

			{/* Step 1: Classification */}
			<ClassificationSection
				blockReason={
					hasInFlightSources
						? "Finish processing all sources before running classification."
						: undefined
				}
				classification={classification}
				hasExtractedContent={hasExtractedContent}
				isBlocked={hasInFlightSources}
				onStart={startClassification}
			/>

			<ClassificationReviewCard
				aggregatedContent={aggregatedContent}
				classification={classification}
				reviewStats={reviewStats}
			/>

			<ComparisonSectionContainer
				classification={classification}
				comparisons={comparisons}
				getContentForTheme={getContentForTheme}
				onCompare={startComparison}
				projectId={projectIdValue}
				themes={themes}
			/>
		</div>
	);
}

// ============================================================================
// STATUS & REVIEW CARDS
// ============================================================================

interface ExtractionStatusCardProps {
	isExtracting: boolean;
	processingItems: StatusItem[];
	pendingItems: StatusItem[];
}

function ExtractionStatusCard({
	isExtracting,
	processingItems,
	pendingItems,
}: ExtractionStatusCardProps) {
	if (!isExtracting) {
		return null;
	}

	return (
		<Card className="p-6">
			<div className="space-y-4">
				<div className="flex items-center gap-4">
					<div className="rounded-full bg-primary/10 p-3">
						<Loader2 className="size-6 animate-spin text-primary" />
					</div>
					<div className="flex-1">
						<h3 className="font-medium text-lg">Processing Content Sources</h3>
						<p className="text-muted-foreground text-sm">
							{processingItems.length > 0
								? `${processingItems.length} source${processingItems.length > 1 ? "s" : ""} currently processing...`
								: `${pendingItems.length} source${pendingItems.length > 1 ? "s" : ""} waiting to be processed...`}
						</p>
					</div>
				</div>
				<div className="space-y-2">
					{processingItems.map((item) => {
						const ItemIcon = item.icon;
						return (
							<div
								className="flex items-center gap-2 text-muted-foreground text-sm"
								key={item.id}
							>
								<ItemIcon className="size-4" />
								<span className="flex-1 truncate">{item.label}</span>
								<Badge className="animate-pulse" variant="secondary">
									Processing
								</Badge>
							</div>
						);
					})}
					{pendingItems.map((item) => {
						const ItemIcon = item.icon;
						return (
							<div
								className="flex items-center gap-2 text-muted-foreground text-sm"
								key={item.id}
							>
								<ItemIcon className="size-4" />
								<span className="flex-1 truncate">{item.label}</span>
								<Badge variant="outline">Queued</Badge>
							</div>
						);
					})}
				</div>
			</div>
		</Card>
	);
}

interface FailedItemsCardProps {
	failedItems: StatusItem[];
	retryError: string | null;
	isRetryingFailed: boolean;
	onRetry: () => void;
}

function FailedItemsCard({
	failedItems,
	retryError,
	isRetryingFailed,
	onRetry,
}: FailedItemsCardProps) {
	if (failedItems.length === 0) {
		return null;
	}

	return (
		<Card className="border-destructive/50 bg-destructive/5 p-6">
			<div className="space-y-3">
				<div className="flex items-center gap-4">
					<AlertCircle className="size-6 text-destructive" />
					<div>
						<h3 className="font-medium text-destructive text-lg">
							Processing Failed
						</h3>
						<p className="text-muted-foreground text-sm">
							{failedItems.length} source{failedItems.length > 1 ? "s" : ""}{" "}
							failed to process
						</p>
					</div>
				</div>
				<div className="space-y-2">
					{failedItems.map((item) => {
						const ItemIcon = item.icon;
						return (
							<div
								className="flex items-center gap-2 text-muted-foreground text-sm"
								key={item.id}
							>
								<ItemIcon className="size-4" />
								<span className="flex-1 truncate">{item.label}</span>
								<Badge variant="destructive">Failed</Badge>
							</div>
						);
					})}
					{failedItems.some((item) => item.error) && (
						<div className="text-destructive text-xs">
							Check the source list for error details and retry options.
						</div>
					)}
					{retryError && (
						<div className="text-destructive text-xs">{retryError}</div>
					)}
				</div>
				<Button
					disabled={isRetryingFailed}
					onClick={onRetry}
					size="sm"
					variant="outline"
				>
					{isRetryingFailed ? (
						<Loader2 className="mr-2 size-4 animate-spin" />
					) : (
						<RefreshCw className="mr-2 size-4" />
					)}
					Retry failed items
				</Button>
			</div>
		</Card>
	);
}

type ReviewStats = NonNullable<
	ClassificationResults["stats"]["classification"]
>;

interface ClassificationReviewCardProps {
	classification: ClassificationState;
	reviewStats: ReviewStats | null;
	aggregatedContent: ReturnType<typeof aggregateContentByTheme>;
}

function ClassificationReviewCard({
	classification,
	reviewStats,
	aggregatedContent,
}: ClassificationReviewCardProps) {
	const [showReview, setShowReview] = useState(false);

	if (
		classification.status !== "completed" ||
		!classification.results ||
		!reviewStats
	) {
		return null;
	}

	return (
		<Card className="p-6">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h3 className="font-medium text-lg">Classification Review</h3>
					<p className="text-muted-foreground text-sm">
						Review how your content mapped to themes before comparing.
					</p>
				</div>
				<Button
					onClick={() => setShowReview((prev) => !prev)}
					variant="outline"
				>
					{showReview ? "Hide Review" : "Review Classifications"}
				</Button>
			</div>
			{showReview && (
				<div className="mt-6">
					<ClassificationReview
						aggregatedContent={aggregatedContent}
						content={classification.results.classifiedContent}
						stats={reviewStats}
						themes={classification.results.themes}
					/>
				</div>
			)}
		</Card>
	);
}

interface ComparisonSectionContainerProps {
	classification: ClassificationState;
	themes: MainTheme[];
	comparisons: ComparisonState;
	projectId: string;
	onCompare: (mainTheme: MainTheme, miniTheme: MiniTheme) => void;
	getContentForTheme: (
		mainThemeId: string,
		miniThemeId: string
	) => ExtractedContent[];
}

function ComparisonSectionContainer({
	classification,
	themes,
	comparisons,
	projectId,
	onCompare,
	getContentForTheme,
}: ComparisonSectionContainerProps) {
	if (classification.status !== "completed" || !classification.results) {
		return null;
	}

	return (
		<ComparisonSection
			comparisons={comparisons}
			content={classification.results.classifiedContent}
			getContentForTheme={getContentForTheme}
			onCompare={onCompare}
			projectId={projectId}
			themes={themes}
		/>
	);
}

// ============================================================================
// CLASSIFICATION SECTION
// ============================================================================

interface ClassificationSectionProps {
	classification: ClassificationState;
	hasExtractedContent: boolean;
	isBlocked?: boolean;
	blockReason?: string;
	onStart: () => void;
}

function ClassificationSection({
	classification,
	hasExtractedContent,
	isBlocked,
	blockReason,
	onStart,
}: ClassificationSectionProps) {
	if (!hasExtractedContent) {
		return (
			<Card className="p-6">
				<div className="flex items-start gap-4">
					<div className="rounded-full bg-muted p-3">
						<Tag className="size-6 text-muted-foreground" />
					</div>
					<div className="flex-1">
						<h3 className="font-medium text-lg">
							Step 1: Theme Classification
						</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							Process your content sources first. Once extraction is complete,
							you can classify the content into themes.
						</p>
					</div>
				</div>
			</Card>
		);
	}

	if (classification.status === "idle" && isBlocked) {
		return (
			<Card className="border-primary/20 bg-primary/5 p-6">
				<div className="flex items-start gap-4">
					<div className="rounded-full bg-primary/10 p-3">
						<Loader2 className="size-6 animate-spin text-primary" />
					</div>
					<div className="flex-1">
						<h3 className="font-medium text-lg">
							Step 1: Theme Classification
						</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							{blockReason ??
								"Classification will be available after processing finishes."}
						</p>
					</div>
				</div>
			</Card>
		);
	}

	if (classification.status === "idle") {
		return (
			<Card className="p-6">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-4">
						<div className="rounded-full bg-primary/10 p-3">
							<Tag className="size-6 text-primary" />
						</div>
						<div>
							<h3 className="font-medium text-lg">
								Step 1: Theme Classification
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								Classify extracted content into your theme hierarchy. This maps
								each example, quote, and argument to the relevant themes.
							</p>
						</div>
					</div>
					<Button onClick={onStart}>
						<Play className="mr-2 size-4" />
						Start Classification
					</Button>
				</div>
			</Card>
		);
	}

	if (classification.status === "processing") {
		return (
			<Card className="p-6">
				<div className="space-y-4">
					<div className="flex items-center gap-4">
						<div className="rounded-full bg-primary/10 p-3">
							<Loader2 className="size-6 animate-spin text-primary" />
						</div>
						<div className="flex-1">
							<h3 className="font-medium text-lg">Classifying Content...</h3>
							<p className="text-muted-foreground text-sm">
								{classification.processedItems} / {classification.totalItems}{" "}
								items processed
							</p>
						</div>
						<Badge variant="secondary">{classification.progress}%</Badge>
					</div>
					<Progress value={classification.progress} />
				</div>
			</Card>
		);
	}

	if (classification.status === "failed") {
		return (
			<Card className="border-destructive/50 bg-destructive/5 p-6">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-4">
						<AlertCircle className="mt-1 size-6 text-destructive" />
						<div>
							<h3 className="font-medium text-destructive text-lg">
								Classification Failed
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								Something went wrong. You can try again.
							</p>
							{classification.error && (
								<p className="mt-2 text-destructive text-xs">
									{classification.error}
								</p>
							)}
						</div>
					</div>
					<Button onClick={onStart} variant="outline">
						<RefreshCw className="mr-2 size-4" />
						Retry
					</Button>
				</div>
			</Card>
		);
	}

	// Completed
	const stats = classification.results?.stats?.classification;
	const aggregation = classification.results?.stats?.aggregation;
	return (
		<Card className="border-green-500/30 bg-green-500/5 p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-start gap-4">
					<div className="rounded-full bg-green-500/10 p-3">
						<CheckCircle2 className="size-6 text-green-600" />
					</div>
					<div>
						<h3 className="font-medium text-lg">Classification Complete</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							Your content has been mapped to themes. Now you can compare
							specific themes or generate notes.
						</p>
						{stats && (
							<div className="mt-3 flex flex-wrap gap-2">
								<Badge variant="secondary">
									{stats.totalClassified} items classified
								</Badge>
								{aggregation && (
									<Badge variant="outline">
										{aggregation.themesWithContent} themes covered
									</Badge>
								)}
								{stats.multiThemeCount > 0 && (
									<Badge
										className="bg-blue-500/10 text-blue-700"
										variant="outline"
									>
										{stats.multiThemeCount} multi-theme items
									</Badge>
								)}
							</div>
						)}
					</div>
				</div>
				<Button onClick={onStart} size="sm" variant="outline">
					<RefreshCw className="mr-2 size-4" />
					Re-classify
				</Button>
			</div>
		</Card>
	);
}

// ============================================================================
// COMPARISON SECTION
// ============================================================================

interface ComparisonSectionProps {
	themes: MainTheme[];
	content: ExtractedContent[];
	comparisons: ComparisonState;
	projectId: string;
	onCompare: (mainTheme: MainTheme, miniTheme: MiniTheme) => void;
	getContentForTheme: (
		mainThemeId: string,
		miniThemeId: string
	) => ExtractedContent[];
}

function ComparisonSection({
	themes,
	comparisons,
	projectId,
	onCompare,
	getContentForTheme,
}: ComparisonSectionProps) {
	const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
	const [_selectedTheme, _setSelectedTheme] = useState<{
		mainTheme: MainTheme;
		miniTheme: MiniTheme;
	} | null>(null);

	const toggleTheme = (themeId: string) => {
		const newExpanded = new Set(expandedThemes);
		if (newExpanded.has(themeId)) {
			newExpanded.delete(themeId);
		} else {
			newExpanded.add(themeId);
		}
		setExpandedThemes(newExpanded);
	};

	return (
		<Card className="p-6">
			<div className="mb-6">
				<h3 className="flex items-center gap-2 font-medium text-lg">
					<BarChart3 className="size-5" />
					Step 2: Compare & Generate Notes
				</h3>
				<p className="text-muted-foreground text-sm">
					Select a theme to compare your content against topper content, then
					generate revision notes.
				</p>
			</div>

			<div className="space-y-3">
				{themes.map((mainTheme) => (
					<div className="rounded-lg border" key={mainTheme.id}>
						{/* Main Theme Header */}
						<button
							className="flex w-full items-center gap-2 p-4 text-left hover:bg-muted/50"
							onClick={() => toggleTheme(mainTheme.id)}
							type="button"
						>
							{expandedThemes.has(mainTheme.id) ? (
								<ChevronDown className="size-4" />
							) : (
								<ChevronRight className="size-4" />
							)}
							<BookOpen className="size-4 text-primary" />
							<span className="font-medium">{mainTheme.title}</span>
							<Badge className="ml-2" variant="secondary">
								{mainTheme.miniThemes.length} sub-themes
							</Badge>
						</button>

						{/* Mini Themes */}
						{expandedThemes.has(mainTheme.id) && (
							<div className="border-t">
								{mainTheme.miniThemes.map((miniTheme) => {
									const themeKey = `${mainTheme.id}-${miniTheme.id}`;
									const comparison = comparisons[themeKey];
									const contentCount = getContentForTheme(
										mainTheme.id,
										miniTheme.id
									).length;
									const compareLabel =
										comparison?.status === "failed" ? "Retry" : "Compare";
									const CompareIcon =
										comparison?.status === "failed" ? RefreshCw : BarChart3;

									return (
										<div
											className="flex items-center justify-between border-b p-4 last:border-b-0 hover:bg-muted/30"
											key={miniTheme.id}
										>
											<div className="flex items-center gap-3">
												<FileText className="size-4 text-muted-foreground" />
												<div>
													<p className="font-medium">{miniTheme.title}</p>
													<p className="text-muted-foreground text-xs">
														{miniTheme.questions.length} questions •{" "}
														{contentCount} content items
													</p>
													{comparison?.status === "failed" &&
														comparison.error && (
															<p className="mt-1 text-destructive text-xs">
																{comparison.error}
															</p>
														)}
												</div>
											</div>

											<div className="flex items-center gap-2">
												{/* Content count badge */}
												{contentCount > 0 ? (
													<Badge variant="secondary">
														{contentCount} items
													</Badge>
												) : (
													<Badge
														className="text-muted-foreground"
														variant="outline"
													>
														No content
													</Badge>
												)}

												{/* Comparison/Note actions */}
												{comparison?.status === "completed" &&
													comparison.result && (
														<ThemeActions
															comparison={comparison.result}
															content={getContentForTheme(
																mainTheme.id,
																miniTheme.id
															)}
															mainTheme={mainTheme}
															miniTheme={miniTheme}
															onRecompare={() =>
																onCompare(mainTheme, miniTheme)
															}
															projectId={projectId}
														/>
													)}
												{comparison?.status === "processing" && (
													<Button disabled size="sm" variant="outline">
														<Loader2 className="mr-2 size-4 animate-spin" />
														Comparing...
													</Button>
												)}
												{comparison?.status !== "completed" &&
													comparison?.status !== "processing" && (
														<Button
															disabled={contentCount === 0}
															onClick={() => onCompare(mainTheme, miniTheme)}
															size="sm"
															variant="outline"
														>
															<CompareIcon className="mr-2 size-4" />
															{compareLabel}
														</Button>
													)}
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				))}
			</div>
		</Card>
	);
}

// ============================================================================
// THEME ACTIONS (Comparison Result + Note Generation)
// ============================================================================

/**
 * Returns the appropriate color class based on comparison score.
 */
function getScoreColorClass(score: number): string {
	if (score >= 70) {
		return "bg-green-500/10 text-green-700";
	}
	if (score >= 40) {
		return "bg-yellow-500/10 text-yellow-700";
	}
	return "bg-red-500/10 text-red-700";
}

interface ThemeActionsProps {
	mainTheme: MainTheme;
	miniTheme: MiniTheme;
	content: ExtractedContent[];
	comparison: ThemeComparisonResult;
	projectId: string;
	onRecompare: () => void;
}

function ThemeActions({
	mainTheme,
	miniTheme,
	content,
	comparison,
	projectId,
	onRecompare,
}: ThemeActionsProps) {
	const [view, setView] = useState<"none" | "comparison" | "notes">("none");
	const [generatedNote, setGeneratedNote] = useState<GeneratedNote | null>(
		null
	);

	const handleNoteGenerated = (note: GeneratedNote) => {
		setGeneratedNote(note);
	};

	return (
		<div className="space-y-4">
			{/* Action buttons */}
			<div className="flex items-center gap-2">
				<Badge
					className={getScoreColorClass(comparison.overallScore)}
					variant="outline"
				>
					Score: {comparison.overallScore}
				</Badge>
				<Button
					onClick={() => setView("comparison")}
					size="sm"
					variant="outline"
				>
					<BarChart3 className="mr-2 size-4" />
					View Comparison
				</Button>
				<Button onClick={() => setView("notes")} size="sm" variant="default">
					<Sparkles className="mr-2 size-4" />
					Notes
				</Button>
			</div>

			{/* Comparison View */}
			{view === "comparison" && (
				<div className="mt-4 space-y-4">
					<div className="flex items-center justify-between">
						<h4 className="font-medium">
							Comparison: {mainTheme.title} &gt; {miniTheme.title}
						</h4>
						<div className="flex gap-2">
							<Button onClick={onRecompare} size="sm" variant="outline">
								<RefreshCw className="mr-2 size-4" />
								Re-run
							</Button>
							<Button onClick={() => setView("none")} size="sm" variant="ghost">
								Close
							</Button>
						</div>
					</div>
					<ComparisonResults result={comparison} />
				</div>
			)}

			{/* Notes View */}
			{view === "notes" && (
				<div className="mt-4">
					<NoteGenerationPanel
						content={content}
						existingNote={generatedNote}
						mainTheme={mainTheme}
						miniTheme={miniTheme}
						onNoteGenerated={handleNoteGenerated}
						projectId={projectId}
					/>
				</div>
			)}
		</div>
	);
}
