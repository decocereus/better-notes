"use client";

import {
	AlertCircle,
	BarChart3,
	BookOpen,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	FileText,
	Loader2,
	Play,
	RefreshCw,
	Sparkles,
	Tag,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { ComparisonResults } from "@/components/comparison-results";
import { NoteGenerationPanel } from "@/components/note-generation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Asset } from "@/types/asset";
import type { ThemeComparisonResult } from "@/types/comparison";
import type { ExtractedContent } from "@/types/extraction";
import type { GeneratedNote } from "@/types/generation";
import type { MainTheme, MiniTheme } from "@/types/theme";

// ============================================================================
// TYPES
// ============================================================================

interface ProjectWorkflowProps {
	projectId: string;
	themePageId: string;
	assets: Asset[];
	themes: MainTheme[];
}

interface ClassificationState {
	jobId: string | null;
	status: "idle" | "processing" | "completed" | "failed";
	progress: number;
	totalItems: number;
	processedItems: number;
	results: ClassificationResults | null;
}

interface ClassificationResults {
	themes: MainTheme[];
	classifiedContent: ExtractedContent[];
	stats: {
		totalClassified: number;
		multiThemeCount: number;
		themesWithContent: number;
	};
}

interface ComparisonState {
	[themeId: string]: {
		jobId: string | null;
		status: "idle" | "processing" | "completed" | "failed";
		result: ThemeComparisonResult | null;
	};
}

// ============================================================================
// MAIN WORKFLOW COMPONENT
// ============================================================================

export function ProjectWorkflow({
	projectId,
	themePageId,
	assets,
	themes,
}: ProjectWorkflowProps) {
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

	const hasExtractedContent = completedAssets.length > 0;
	const isExtracting = processingAssets.length > 0 || pendingAssets.length > 0;

	// Classification state
	const [classification, setClassification] = useState<ClassificationState>({
		jobId: null,
		status: "idle",
		progress: 0,
		totalItems: 0,
		processedItems: 0,
		results: null,
	});

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

	// Check for existing classification on mount
	useEffect(() => {
		if (hasExtractedContent && classification.status === "idle") {
			const checkExisting = async () => {
				const savedJobId = localStorage.getItem(
					`classification-job-${projectId}`
				);
				if (savedJobId) {
					await pollClassificationStatus(savedJobId);
				}
			};
			checkExisting();
		}
	}, [
		hasExtractedContent,
		classification.status,
		projectId,
		pollClassificationStatus,
	]);

	const startClassification = async () => {
		if (completedAssets.length === 0) {
			return;
		}

		// Clear previous results when starting new classification
		setClassification({
			jobId: null,
			status: "processing",
			progress: 0,
			totalItems: 0,
			processedItems: 0,
			results: null,
		});

		try {
			// Use the first completed asset's extraction job
			const asset = completedAssets[0];
			const extractionJobId = asset.extractionJobId;

			if (!extractionJobId) {
				throw new Error("No extraction job found for asset");
			}

			const response = await fetch("/api/classify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					extractionJobId,
					themePageId,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to start classification");
			}

			const data = await response.json();
			localStorage.setItem(`classification-job-${projectId}`, data.jobId);
			pollClassificationStatus(data.jobId);
		} catch (_error) {
			setClassification((prev) => ({
				...prev,
				status: "failed",
			}));
		}
	};

	const startComparison = async (
		mainTheme: MainTheme,
		miniTheme: MiniTheme
	) => {
		if (!classification.results) {
			return;
		}

		const themeKey = `${mainTheme.id}-${miniTheme.id}`;

		setComparisons((prev) => ({
			...prev,
			[themeKey]: { jobId: null, status: "processing", result: null },
		}));

		try {
			const response = await fetch("/api/compare", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					classificationJobId: classification.jobId,
					mainThemeId: mainTheme.id,
					miniThemeId: miniTheme.id,
					userContentIds: "all",
					topperContentIds: "all",
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
						},
					}));
				} else if (statusData.job.status === "failed") {
					setComparisons((prev) => ({
						...prev,
						[themeKey]: { jobId: data.jobId, status: "failed", result: null },
					}));
				} else {
					setTimeout(pollComparison, 2000);
				}
			};

			pollComparison();
		} catch {
			setComparisons((prev) => ({
				...prev,
				[themeKey]: { jobId: null, status: "failed", result: null },
			}));
		}
	};

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

	// ============================================================================
	// RENDER
	// ============================================================================

	return (
		<div className="space-y-6">
			{/* Extraction Status */}
			{isExtracting && (
				<Card className="p-6">
					<div className="space-y-4">
						<div className="flex items-center gap-4">
							<div className="rounded-full bg-primary/10 p-3">
								<Loader2 className="size-6 animate-spin text-primary" />
							</div>
							<div className="flex-1">
								<h3 className="font-medium text-lg">
									Processing Content Sources
								</h3>
								<p className="text-muted-foreground text-sm">
									{processingAssets.length > 0
										? `${processingAssets.length} source${processingAssets.length > 1 ? "s" : ""} currently processing...`
										: `${pendingAssets.length} source${pendingAssets.length > 1 ? "s" : ""} waiting to be processed...`}
								</p>
							</div>
						</div>
						<div className="space-y-2">
							{processingAssets.map((asset) => (
								<div
									className="flex items-center gap-2 text-muted-foreground text-sm"
									key={asset.id}
								>
									<FileText className="size-4" />
									<span className="flex-1 truncate">{asset.filename}</span>
									<Badge className="animate-pulse" variant="secondary">
										Processing
									</Badge>
								</div>
							))}
							{pendingAssets.map((asset) => (
								<div
									className="flex items-center gap-2 text-muted-foreground text-sm"
									key={asset.id}
								>
									<FileText className="size-4" />
									<span className="flex-1 truncate">{asset.filename}</span>
									<Badge variant="outline">Queued</Badge>
								</div>
							))}
						</div>
					</div>
				</Card>
			)}

			{/* Failed Assets */}
			{failedAssets.length > 0 && (
				<Card className="border-destructive/50 bg-destructive/5 p-6">
					<div className="space-y-3">
						<div className="flex items-center gap-4">
							<AlertCircle className="size-6 text-destructive" />
							<div>
								<h3 className="font-medium text-destructive text-lg">
									Processing Failed
								</h3>
								<p className="text-muted-foreground text-sm">
									{failedAssets.length} source
									{failedAssets.length > 1 ? "s" : ""} failed to process
								</p>
							</div>
						</div>
						<div className="space-y-2">
							{failedAssets.map((asset) => (
								<div
									className="flex items-center gap-2 text-muted-foreground text-sm"
									key={asset.id}
								>
									<FileText className="size-4" />
									<span className="flex-1 truncate">{asset.filename}</span>
									<Badge variant="destructive">Failed</Badge>
								</div>
							))}
						</div>
					</div>
				</Card>
			)}

			{/* Step 1: Classification */}
			<ClassificationSection
				classification={classification}
				hasExtractedContent={hasExtractedContent}
				onStart={startClassification}
			/>

			{/* Step 2: Theme Selection & Comparison */}
			{classification.status === "completed" && classification.results && (
				<ComparisonSection
					comparisons={comparisons}
					content={classification.results.classifiedContent}
					getContentForTheme={getContentForTheme}
					onCompare={startComparison}
					themes={themes}
				/>
			)}
		</div>
	);
}

// ============================================================================
// CLASSIFICATION SECTION
// ============================================================================

interface ClassificationSectionProps {
	classification: ClassificationState;
	hasExtractedContent: boolean;
	onStart: () => void;
}

function ClassificationSection({
	classification,
	hasExtractedContent,
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
							Process your uploaded essays first. Once extraction is complete,
							you can classify the content into themes.
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
	const stats = classification.results?.stats;
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
								<Badge variant="outline">
									{stats.themesWithContent} themes covered
								</Badge>
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
	onCompare: (mainTheme: MainTheme, miniTheme: MiniTheme) => void;
	getContentForTheme: (
		mainThemeId: string,
		miniThemeId: string
	) => ExtractedContent[];
}

function ComparisonSection({
	themes,
	comparisons,
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
															<BarChart3 className="mr-2 size-4" />
															Compare
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
	onRecompare: () => void;
}

function ThemeActions({
	mainTheme,
	miniTheme,
	content,
	comparison,
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
					/>
				</div>
			)}
		</div>
	);
}
