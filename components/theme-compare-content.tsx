"use client";

/**
 * Theme Compare Content Component
 * Displays comparison analysis between user content and topper content for a theme.
 */

import { useQuery } from "convex/react";
import {
	ArrowLeft,
	BarChart3,
	BookOpen,
	ChevronDown,
	ChevronRight,
	FolderKanban,
	Loader2,
	RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ComparisonResults } from "@/components/comparison-results";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useSettings } from "@/lib/hooks/use-settings";
import type { ThemeComparisonResult } from "@/types/comparison";
import type { ExtractedContent } from "@/types/extraction";
import type { ProcessingJobStatus } from "@/types/processing";
import type { MainTheme, MiniTheme } from "@/types/theme";

interface ThemeCompareContentProps {
	themeId: string;
	initialProjectId?: string;
}

interface ThemePageData {
	_id: string;
	id: string;
	title: string;
	themes: MainTheme[];
}

interface ProjectSummary {
	id: string;
	name: string;
}

interface ClassificationResults {
	jobId: string;
	projectId?: string;
	themePageId: string;
	themes: MainTheme[];
	classifiedContent: ExtractedContent[];
	stats?: {
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
	processedAt: string;
}

type ClassificationStatus = ProcessingJobStatus | "idle";

interface ClassificationState {
	jobId: string | null;
	status: ClassificationStatus;
	progress: number;
	processedItems: number;
	totalItems: number;
	error?: string;
	results: ClassificationResults | null;
}

interface ComparisonStateEntry {
	jobId: string | null;
	status: "idle" | "processing" | "completed" | "failed";
	result: ThemeComparisonResult | null;
	error?: string;
}

type ComparisonState = Record<string, ComparisonStateEntry>;

interface ClassificationJobStatus {
	status: ProcessingJobStatus;
	progress: number;
	processedItems: number;
	totalItems: number;
	errors?: Array<{ message?: string }>;
}

interface ClassificationJobResponse {
	job?: ClassificationJobStatus;
	results?: ClassificationResults;
}

function createInitialClassificationState(): ClassificationState {
	return {
		jobId: null,
		status: "idle",
		progress: 0,
		processedItems: 0,
		totalItems: 0,
		error: undefined,
		results: null,
	};
}

function getThemeKey(mainTheme: MainTheme, miniTheme: MiniTheme): string {
	return `${mainTheme.id}-${miniTheme.id}`;
}

function isActiveJobStatus(status: ProcessingJobStatus): boolean {
	return status === "pending" || status === "processing";
}

function getClassificationMismatchError(
	results: ClassificationResults | null,
	themeId: string,
	projectId: string | null
): string | null {
	if (!results) {
		return null;
	}

	if (results.themePageId && results.themePageId !== themeId) {
		return "Classification results belong to a different theme page. Re-run classification for this project.";
	}

	if (projectId && results.projectId && results.projectId !== projectId) {
		return "Classification results belong to a different project. Re-run classification for this project.";
	}

	return null;
}

function buildClassificationState(
	jobId: string,
	job: ClassificationJobStatus,
	results: ClassificationResults | null
): ClassificationState {
	const isFailed = job.status === "failed";
	return {
		jobId,
		status: job.status,
		progress: job.progress ?? 0,
		processedItems: job.processedItems ?? 0,
		totalItems: job.totalItems ?? 0,
		error: isFailed
			? (job.errors?.[0]?.message ?? "Classification failed")
			: undefined,
		results,
	};
}

async function fetchClassificationJob(jobId: string): Promise<{
	job: ClassificationJobStatus;
	results: ClassificationResults | null;
}> {
	const response = await fetch(`/api/classify?jobId=${jobId}`);
	if (!response.ok) {
		const data = (await response.json()) as { error?: string };
		throw new Error(data.error || "Failed to load classification status");
	}

	const data = (await response.json()) as ClassificationJobResponse;
	if (!data.job) {
		throw new Error("Classification job status unavailable");
	}

	return {
		job: data.job,
		results: data.results ?? null,
	};
}

function getCompareButtonLabel(
	comparison: ComparisonStateEntry | undefined,
	isCompleted: boolean
): string {
	if (comparison?.status === "failed") {
		return "Retry";
	}

	if (isCompleted) {
		return "Re-run";
	}

	return "Compare";
}

interface ProjectSelectorCardProps {
	projects: ProjectSummary[];
	selectedProjectId: string | null;
	onProjectChange: (value: string) => void;
}

function ProjectSelectorCard({
	projects,
	selectedProjectId,
	onProjectChange,
}: ProjectSelectorCardProps) {
	return (
		<Card className="p-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 className="font-medium text-lg">Project</h3>
					<p className="text-muted-foreground text-sm">
						Select the project to compare against this theme page.
					</p>
				</div>
				<Select onValueChange={onProjectChange} value={selectedProjectId ?? ""}>
					<SelectTrigger className="w-full sm:w-72">
						<SelectValue placeholder="Select project" />
					</SelectTrigger>
					<SelectContent>
						{projects.map((project) => (
							<SelectItem key={project.id} value={project.id}>
								{project.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			{projects.length === 0 && (
				<div className="mt-4 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
					No projects use this theme page yet. Create a project to start
					classifying and comparing content.
				</div>
			)}
		</Card>
	);
}

function ProjectSelectionPrompt() {
	return (
		<Card className="flex flex-col items-center justify-center p-10 text-center">
			<div className="mb-4 rounded-full bg-muted p-4">
				<FolderKanban className="size-8 text-muted-foreground" />
			</div>
			<h3 className="font-medium text-lg">Select a Project</h3>
			<p className="mt-1 max-w-sm text-muted-foreground text-sm">
				Pick a project to load classification results and run comparisons.
			</p>
		</Card>
	);
}

interface ClassificationStatusCardProps {
	classification: ClassificationState;
	onStartClassification: () => void;
}

function ClassificationStatusCard({
	classification,
	onStartClassification,
}: ClassificationStatusCardProps) {
	const isProcessing = classification.status === "processing";
	const hasResults = classification.status === "completed";

	return (
		<Card className="p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-start gap-3">
					<div className="rounded-full bg-primary/10 p-3">
						<BarChart3 className="size-5 text-primary" />
					</div>
					<div>
						<h3 className="font-medium text-lg">Classification Status</h3>
						<p className="text-muted-foreground text-sm">
							Classification is required before comparing themes.
						</p>
						{hasResults && (
							<div className="mt-3 flex flex-wrap gap-2">
								<Badge variant="secondary">
									{classification.results?.stats?.classification
										?.totalClassified ?? 0}{" "}
									items classified
								</Badge>
								{classification.results?.stats?.aggregation && (
									<Badge variant="outline">
										{classification.results.stats.aggregation.themesWithContent}{" "}
										themes covered
									</Badge>
								)}
							</div>
						)}
						{isProcessing && (
							<div className="mt-3 flex items-center gap-2 text-muted-foreground text-sm">
								<Loader2 className="size-4 animate-spin" />
								<span>
									Classifying... {classification.progress}% (
									{classification.processedItems}/{classification.totalItems})
								</span>
							</div>
						)}
						{classification.status === "failed" && classification.error && (
							<p className="mt-3 text-destructive text-sm">
								{classification.error}
							</p>
						)}
					</div>
				</div>

				<Button onClick={onStartClassification} variant="outline">
					{isProcessing ? (
						<>
							<Loader2 className="mr-2 size-4 animate-spin" />
							Running
						</>
					) : (
						<>
							<RefreshCw className="mr-2 size-4" />
							{hasResults ? "Re-run" : "Run Classification"}
						</>
					)}
				</Button>
			</div>
		</Card>
	);
}

interface MiniThemeComparisonRowProps {
	mainTheme: MainTheme;
	miniTheme: MiniTheme;
	comparison: ComparisonStateEntry | undefined;
	contentItems: ExtractedContent[];
	isExpanded: boolean;
	onStartComparison: (mainTheme: MainTheme, miniTheme: MiniTheme) => void;
	onToggleComparison: (themeKey: string) => void;
}

function MiniThemeComparisonRow({
	mainTheme,
	miniTheme,
	comparison,
	contentItems,
	isExpanded,
	onStartComparison,
	onToggleComparison,
}: MiniThemeComparisonRowProps) {
	const themeKey = getThemeKey(mainTheme, miniTheme);
	const userCount = contentItems.filter(
		(item) => item.sourceType === "user"
	).length;
	const topperCount = contentItems.filter(
		(item) => item.sourceType === "topper"
	).length;
	const totalCount = userCount + topperCount;
	const isComparing = comparison?.status === "processing";
	const isCompleted =
		comparison?.status === "completed" && Boolean(comparison.result);
	const compareLabel = getCompareButtonLabel(comparison, isCompleted);
	const CompareIcon = comparison?.status === "failed" ? RefreshCw : BarChart3;

	return (
		<div className="border-b p-4 last:border-b-0">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="font-medium">{miniTheme.title}</p>
					<p className="text-muted-foreground text-xs">
						{miniTheme.questions.length} questions
					</p>
					{comparison?.status === "failed" && comparison.error && (
						<p className="mt-1 text-destructive text-xs">{comparison.error}</p>
					)}
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant="secondary">{userCount} user</Badge>
					<Badge variant="outline">{topperCount} topper</Badge>
					{isCompleted && comparison?.result && (
						<Badge variant="outline">
							Score: {comparison.result.overallScore}
						</Badge>
					)}
					<Button
						disabled={totalCount === 0 || isComparing}
						onClick={() => onStartComparison(mainTheme, miniTheme)}
						size="sm"
						variant="outline"
					>
						{isComparing ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Comparing
							</>
						) : (
							<>
								<CompareIcon className="mr-2 size-4" />
								{compareLabel}
							</>
						)}
					</Button>
					{isCompleted && (
						<Button
							onClick={() => onToggleComparison(themeKey)}
							size="sm"
							variant="ghost"
						>
							{isExpanded ? "Hide" : "View"}
						</Button>
					)}
				</div>
			</div>

			{isCompleted && comparison?.result && isExpanded && (
				<div className="mt-4">
					<ComparisonResults result={comparison.result} />
				</div>
			)}
		</div>
	);
}

interface MainThemeComparisonCardProps {
	mainTheme: MainTheme;
	comparisons: ComparisonState;
	expandedThemes: Set<string>;
	expandedComparisons: Set<string>;
	onToggleTheme: (themeId: string) => void;
	onToggleComparison: (themeKey: string) => void;
	getContentForTheme: (
		mainThemeId: string,
		miniThemeId: string
	) => ExtractedContent[];
	onStartComparison: (mainTheme: MainTheme, miniTheme: MiniTheme) => void;
}

function MainThemeComparisonCard({
	mainTheme,
	comparisons,
	expandedThemes,
	expandedComparisons,
	onToggleTheme,
	onToggleComparison,
	getContentForTheme,
	onStartComparison,
}: MainThemeComparisonCardProps) {
	const isExpanded = expandedThemes.has(mainTheme.id);

	return (
		<div className="rounded-lg border">
			<button
				className="flex w-full items-center gap-2 p-4 text-left hover:bg-muted/50"
				onClick={() => onToggleTheme(mainTheme.id)}
				type="button"
			>
				{isExpanded ? (
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

			{isExpanded && (
				<div className="border-t">
					{mainTheme.miniThemes.map((miniTheme) => {
						const themeKey = getThemeKey(mainTheme, miniTheme);
						const comparison = comparisons[themeKey];
						const contentItems = getContentForTheme(mainTheme.id, miniTheme.id);
						const isComparisonExpanded = expandedComparisons.has(themeKey);

						return (
							<MiniThemeComparisonRow
								comparison={comparison}
								contentItems={contentItems}
								isExpanded={isComparisonExpanded}
								key={miniTheme.id}
								mainTheme={mainTheme}
								miniTheme={miniTheme}
								onStartComparison={onStartComparison}
								onToggleComparison={onToggleComparison}
							/>
						);
					})}
				</div>
			)}
		</div>
	);
}

interface ThemeComparisonListProps {
	themes: MainTheme[];
	comparisons: ComparisonState;
	expandedThemes: Set<string>;
	expandedComparisons: Set<string>;
	onToggleTheme: (themeId: string) => void;
	onToggleComparison: (themeKey: string) => void;
	getContentForTheme: (
		mainThemeId: string,
		miniThemeId: string
	) => ExtractedContent[];
	onStartComparison: (mainTheme: MainTheme, miniTheme: MiniTheme) => void;
}

function ThemeComparisonList({
	themes,
	comparisons,
	expandedThemes,
	expandedComparisons,
	onToggleTheme,
	onToggleComparison,
	getContentForTheme,
	onStartComparison,
}: ThemeComparisonListProps) {
	return (
		<Card className="p-6">
			<div className="mb-6">
				<h3 className="flex items-center gap-2 font-medium text-lg">
					<BookOpen className="size-5" />
					Theme Comparisons
				</h3>
				<p className="text-muted-foreground text-sm">
					Run comparison for each sub-theme to see gaps and suggestions.
				</p>
			</div>

			<div className="space-y-3">
				{themes.map((mainTheme) => (
					<MainThemeComparisonCard
						comparisons={comparisons}
						expandedComparisons={expandedComparisons}
						expandedThemes={expandedThemes}
						getContentForTheme={getContentForTheme}
						key={mainTheme.id}
						mainTheme={mainTheme}
						onStartComparison={onStartComparison}
						onToggleComparison={onToggleComparison}
						onToggleTheme={onToggleTheme}
					/>
				))}
			</div>
		</Card>
	);
}

/**
 * Client component for theme comparison.
 * Requires project context to access theme data.
 */
export function ThemeCompareContent({
	themeId,
	initialProjectId,
}: ThemeCompareContentProps) {
	const { settings } = useSettings();
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const themePage = useQuery(api.themePages.get, {
		id: themeId as Id<"themePages">,
	}) as ThemePageData | null | undefined;

	const projects = useQuery(api.projects.listByThemePage, {
		themePageId: themeId as Id<"themePages">,
	}) as ProjectSummary[] | undefined;

	const projectIdFromParams = searchParams.get("projectId");

	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
		initialProjectId ?? projectIdFromParams
	);
	const [classification, setClassification] = useState<ClassificationState>(
		createInitialClassificationState()
	);
	const [comparisons, setComparisons] = useState<ComparisonState>({});
	const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
	const [expandedComparisons, setExpandedComparisons] = useState<Set<string>>(
		new Set()
	);
	const previousProjectIdRef = useRef<string | null>(null);

	const handleProjectChange = useCallback(
		(value: string) => {
			setSelectedProjectId(value);
			const nextParams = new URLSearchParams(searchParams);
			nextParams.set("projectId", value);
			router.replace(`${pathname}?${nextParams.toString()}`);
		},
		[pathname, router, searchParams]
	);

	useEffect(() => {
		if (projectIdFromParams && projectIdFromParams !== selectedProjectId) {
			setSelectedProjectId(projectIdFromParams);
		}
	}, [projectIdFromParams, selectedProjectId]);

	useEffect(() => {
		if (projects?.length !== 1 || selectedProjectId) {
			return;
		}
		handleProjectChange(projects[0].id);
	}, [handleProjectChange, projects, selectedProjectId]);

	useEffect(() => {
		if (previousProjectIdRef.current === selectedProjectId) {
			return;
		}
		previousProjectIdRef.current = selectedProjectId;
		setClassification(createInitialClassificationState());
		setComparisons({});
		setExpandedThemes(new Set());
		setExpandedComparisons(new Set());
	}, [selectedProjectId]);

	const pollClassificationStatus = useCallback(
		async (jobId: string) => {
			try {
				const { job, results } = await fetchClassificationJob(jobId);
				const mismatchError = getClassificationMismatchError(
					results,
					themeId,
					selectedProjectId
				);

				if (mismatchError) {
					setClassification({
						...createInitialClassificationState(),
						status: "failed",
						error: mismatchError,
					});
					return;
				}

				setClassification(buildClassificationState(jobId, job, results));

				if (isActiveJobStatus(job.status)) {
					setTimeout(() => pollClassificationStatus(jobId), 2000);
				}
			} catch (error) {
				setClassification((prev) => ({
					...prev,
					status: "failed",
					error:
						error instanceof Error
							? error.message
							: "Failed to load classification status",
				}));
			}
		},
		[selectedProjectId, themeId]
	);

	useEffect(() => {
		if (!selectedProjectId) {
			return;
		}

		const savedJobId = localStorage.getItem(
			`classification-job-${selectedProjectId}`
		);
		if (savedJobId) {
			pollClassificationStatus(savedJobId);
		}
	}, [pollClassificationStatus, selectedProjectId]);

	const startClassification = useCallback(async () => {
		if (!selectedProjectId) {
			return;
		}

		setClassification({
			...createInitialClassificationState(),
			status: "processing",
		});

		try {
			const response = await fetch("/api/classify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId: selectedProjectId,
					themePageId: themeId,
					modelConfig: settings.modelConfig,
				}),
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { error?: string };
				throw new Error(errorData.error || "Failed to start classification");
			}

			const data = (await response.json()) as { jobId: string };
			localStorage.setItem(
				`classification-job-${selectedProjectId}`,
				data.jobId
			);
			pollClassificationStatus(data.jobId);
		} catch (error) {
			setClassification((prev) => ({
				...prev,
				status: "failed",
				error:
					error instanceof Error
						? error.message
						: "Failed to start classification",
			}));
		}
	}, [
		pollClassificationStatus,
		selectedProjectId,
		settings.modelConfig,
		themeId,
	]);

	const startComparison = useCallback(
		async (mainTheme: MainTheme, miniTheme: MiniTheme) => {
			if (!classification.jobId) {
				return;
			}

			const themeKey = getThemeKey(mainTheme, miniTheme);

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
						classificationJobId: classification.jobId,
						mainThemeId: mainTheme.id,
						miniThemeId: miniTheme.id,
						userContentIds: "all",
						topperContentIds: "all",
						modelConfig: settings.modelConfig,
					}),
				});

				if (!response.ok) {
					const errorData = (await response.json()) as { error?: string };
					throw new Error(errorData.error || "Failed to start comparison");
				}

				const data = (await response.json()) as { jobId: string };

				const pollComparison = async () => {
					const statusRes = await fetch(`/api/compare?jobId=${data.jobId}`);
					if (!statusRes.ok) {
						setComparisons((prev) => ({
							...prev,
							[themeKey]: {
								jobId: data.jobId,
								status: "failed",
								result: null,
								error: "Failed to load comparison status",
							},
						}));
						return;
					}

					const statusData = (await statusRes.json()) as {
						job: {
							status: ProcessingJobStatus;
							errors?: Array<{ message?: string }>;
						};
						results?: { result: ThemeComparisonResult };
					};

					const comparisonResult = statusData.results?.result;

					if (statusData.job.status === "completed" && comparisonResult) {
						setComparisons((prev) => ({
							...prev,
							[themeKey]: {
								jobId: data.jobId,
								status: "completed",
								result: comparisonResult,
								error: undefined,
							},
						}));
					} else if (statusData.job.status === "completed") {
						setComparisons((prev) => ({
							...prev,
							[themeKey]: {
								jobId: data.jobId,
								status: "failed",
								result: null,
								error: "Comparison completed without results",
							},
						}));
					} else if (statusData.job.status === "failed") {
						setComparisons((prev) => ({
							...prev,
							[themeKey]: {
								jobId: data.jobId,
								status: "failed",
								result: null,
								error:
									statusData.job.errors?.[0]?.message ?? "Comparison failed",
							},
						}));
					} else {
						setTimeout(pollComparison, 2000);
					}
				};

				pollComparison();
			} catch (error) {
				setComparisons((prev) => ({
					...prev,
					[themeKey]: {
						jobId: null,
						status: "failed",
						result: null,
						error:
							error instanceof Error
								? error.message
								: "Failed to start comparison",
					},
				}));
			}
		},
		[classification.jobId, settings.modelConfig]
	);

	const getContentForTheme = useCallback(
		(mainThemeId: string, miniThemeId: string) => {
			if (!classification.results) {
				return [];
			}

			return classification.results.classifiedContent.filter((item) =>
				item.themes.some(
					(theme) =>
						theme.mainThemeId === mainThemeId &&
						theme.miniThemeId === miniThemeId
				)
			);
		},
		[classification.results]
	);

	const themes = useMemo(() => {
		return classification.results?.themes ?? themePage?.themes ?? [];
	}, [classification.results?.themes, themePage?.themes]);

	const handleToggleTheme = useCallback((themeId: string) => {
		setExpandedThemes((prev) => {
			const next = new Set(prev);
			if (next.has(themeId)) {
				next.delete(themeId);
			} else {
				next.add(themeId);
			}
			return next;
		});
	}, []);

	const handleToggleComparison = useCallback((themeKey: string) => {
		setExpandedComparisons((prev) => {
			const next = new Set(prev);
			if (next.has(themeKey)) {
				next.delete(themeKey);
			} else {
				next.add(themeKey);
			}
			return next;
		});
	}, []);

	const isLoading = themePage === undefined || projects === undefined;
	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (!themePage) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-4">
					<Link href="/themes">
						<Button size="icon" variant="ghost">
							<ArrowLeft className="size-5" />
						</Button>
					</Link>
					<div>
						<h2 className="font-semibold text-2xl">Theme Page Not Found</h2>
						<p className="text-muted-foreground text-sm">
							This theme page does not exist or has been deleted.
						</p>
					</div>
				</div>
				<Card className="p-6">
					<Link href="/themes">
						<Button variant="outline">Back to Theme Pages</Button>
					</Link>
				</Card>
			</div>
		);
	}

	const showProjectPrompt = !selectedProjectId && projects.length > 0;
	const showClassificationCard = Boolean(selectedProjectId);
	const showThemeComparisons =
		classification.status === "completed" && themes.length > 0;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href={`/themes/${themeId}`}>
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="font-semibold text-2xl">Compare Content</h2>
					<p className="text-muted-foreground text-sm">{themePage.title}</p>
				</div>
			</div>

			<ProjectSelectorCard
				onProjectChange={handleProjectChange}
				projects={projects}
				selectedProjectId={selectedProjectId}
			/>

			{showProjectPrompt && <ProjectSelectionPrompt />}

			{showClassificationCard && (
				<ClassificationStatusCard
					classification={classification}
					onStartClassification={startClassification}
				/>
			)}

			{showThemeComparisons && (
				<ThemeComparisonList
					comparisons={comparisons}
					expandedComparisons={expandedComparisons}
					expandedThemes={expandedThemes}
					getContentForTheme={getContentForTheme}
					onStartComparison={startComparison}
					onToggleComparison={handleToggleComparison}
					onToggleTheme={handleToggleTheme}
					themes={themes}
				/>
			)}
		</div>
	);
}
