"use client";

/**
 * Global Compare Content Component
 * Displays comparison overview across all themes.
 */

import {
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	BookOpen,
	Download,
	GitCompare,
	Loader2,
	Target,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ComparisonResultsSummary } from "@/components/comparison-results";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useSettings } from "@/lib/hooks/use-settings";
import type {
	ComparisonSuggestion,
	GapSeverity,
	ThemeComparisonResult,
} from "@/types/comparison";
import type { ContentType } from "@/types/extraction";
import type { MainTheme, MiniTheme } from "@/types/theme";

interface GlobalComparisonState {
	isLoading: boolean;
	error: string | null;
	results: Array<{
		mainTheme: MainTheme;
		miniTheme: MiniTheme;
		result: ThemeComparisonResult | null;
		isRunning: boolean;
		error: string | null;
	}>;
	summary: {
		themesCompared: number;
		averageScore: number;
		totalGaps: number;
		highPriorityGaps: number;
		topSuggestions: ComparisonSuggestion[];
	} | null;
}

/**
 * Global comparison view component.
 */
/**
 * Gets badge variant based on priority.
 */
function getPriorityBadgeVariant(
	priority: GapSeverity
): "destructive" | "default" | "secondary" {
	if (priority === "high") {
		return "destructive";
	}
	if (priority === "medium") {
		return "default";
	}
	return "secondary";
}

/**
 * Global comparison view component.
 */
export function GlobalCompareContent() {
	const { settings, isHydrated } = useSettings();
	const [isLoadingThemes, setIsLoadingThemes] = useState(true);
	const [themesError, setThemesError] = useState<string | null>(null);

	const [classificationJobId, setClassificationJobId] = useState<string | null>(
		null
	);

	const [comparison, setComparison] = useState<GlobalComparisonState>({
		isLoading: false,
		error: null,
		results: [],
		summary: null,
	});

	/**
	 * Fetches themes from the API.
	 */
	const fetchThemes = useCallback(async () => {
		if (!settings.themePageId) {
			setIsLoadingThemes(false);
			return;
		}

		setIsLoadingThemes(true);
		setThemesError(null);

		try {
			const response = await fetch("/api/themes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pageId: settings.themePageId }),
			});

			if (!response.ok) {
				throw new Error("Failed to fetch themes");
			}

			const data = (await response.json()) as { themes: MainTheme[] };

			// Initialize comparison state with all mini themes
			const themeResults = data.themes.flatMap((main) =>
				main.miniThemes.map((mini) => ({
					mainTheme: main,
					miniTheme: mini,
					result: null,
					isRunning: false,
					error: null,
				}))
			);
			setComparison((prev) => ({ ...prev, results: themeResults }));
		} catch (err) {
			setThemesError(
				err instanceof Error ? err.message : "Failed to load themes"
			);
		} finally {
			setIsLoadingThemes(false);
		}
	}, [settings.themePageId]);

	/**
	 * Polls for comparison result.
	 */
	const pollForResult = useCallback(
		async (jobId: string): Promise<ThemeComparisonResult> => {
			const maxAttempts = 60;
			let attempts = 0;

			while (attempts < maxAttempts) {
				attempts++;

				const response = await fetch(`/api/compare?jobId=${jobId}`);
				if (!response.ok) {
					throw new Error("Failed to get comparison status");
				}

				const data = (await response.json()) as {
					job: { status: string };
					results?: { result: ThemeComparisonResult };
				};

				if (data.job.status === "completed" && data.results) {
					return data.results.result;
				}

				if (data.job.status === "failed") {
					throw new Error("Comparison job failed");
				}

				// Wait before next poll
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			throw new Error("Comparison timed out");
		},
		[]
	);

	/**
	 * Runs comparison for a single theme.
	 */
	const runThemeComparison = useCallback(
		async (mainThemeId: string, miniThemeId: string) => {
			if (!classificationJobId) {
				return;
			}

			// Update state to show running
			setComparison((prev) => ({
				...prev,
				results: prev.results.map((r) =>
					r.mainTheme.id === mainThemeId && r.miniTheme.id === miniThemeId
						? { ...r, isRunning: true, error: null }
						: r
				),
			}));

			try {
				// Start comparison
				const startResponse = await fetch("/api/compare", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						classificationJobId,
						mainThemeId,
						miniThemeId,
						userContentIds: "all",
						topperContentIds: "all",
					}),
				});

				if (!startResponse.ok) {
					const errorData = (await startResponse.json()) as { error?: string };
					throw new Error(errorData.error || "Failed to start comparison");
				}

				const startData = (await startResponse.json()) as { jobId: string };

				// Poll for results
				const result = await pollForResult(startData.jobId);

				// Update state with result
				setComparison((prev) => ({
					...prev,
					results: prev.results.map((r) =>
						r.mainTheme.id === mainThemeId && r.miniTheme.id === miniThemeId
							? { ...r, isRunning: false, result }
							: r
					),
				}));
			} catch (err) {
				setComparison((prev) => ({
					...prev,
					results: prev.results.map((r) =>
						r.mainTheme.id === mainThemeId && r.miniTheme.id === miniThemeId
							? {
									...r,
									isRunning: false,
									error: err instanceof Error ? err.message : "Failed",
								}
							: r
					),
				}));
			}
		},
		[classificationJobId, pollForResult]
	);

	/**
	 * Runs comparison for all themes.
	 */
	const runAllComparisons = useCallback(async () => {
		if (!classificationJobId) {
			return;
		}

		setComparison((prev) => ({ ...prev, isLoading: true, error: null }));

		// Run comparisons sequentially to avoid overwhelming the API
		for (const themeResult of comparison.results) {
			await runThemeComparison(
				themeResult.mainTheme.id,
				themeResult.miniTheme.id
			);
		}

		setComparison((prev) => ({ ...prev, isLoading: false }));
	}, [classificationJobId, comparison.results, runThemeComparison]);

	/**
	 * Calculates summary statistics.
	 */
	const calculateSummary = useCallback(() => {
		const completedResults = comparison.results.filter((r) => r.result);

		if (completedResults.length === 0) {
			setComparison((prev) => ({ ...prev, summary: null }));
			return;
		}

		const scores = completedResults.map((r) => r.result?.overallScore || 0);
		const averageScore = Math.round(
			scores.reduce((a, b) => a + b, 0) / scores.length
		);

		const totalGaps = completedResults.reduce(
			(acc, r) => acc + (r.result?.gaps.length || 0),
			0
		);

		const highPriorityGaps = completedResults.reduce(
			(acc, r) =>
				acc + (r.result?.gaps.filter((g) => g.severity === "high").length || 0),
			0
		);

		// Collect and prioritize suggestions across all themes
		const allSuggestions = completedResults.flatMap(
			(r) => r.result?.suggestions || []
		);
		const topSuggestions = allSuggestions
			.sort((a, b) => {
				const priorityOrder: Record<GapSeverity, number> = {
					high: 3,
					medium: 2,
					low: 1,
				};
				return priorityOrder[b.priority] - priorityOrder[a.priority];
			})
			.slice(0, 5);

		setComparison((prev) => ({
			...prev,
			summary: {
				themesCompared: completedResults.length,
				averageScore,
				totalGaps,
				highPriorityGaps,
				topSuggestions,
			},
		}));
	}, [comparison.results]);

	/**
	 * Exports comparison report as JSON.
	 */
	const exportReport = useCallback(() => {
		const report = {
			generatedAt: new Date().toISOString(),
			summary: comparison.summary,
			results: comparison.results
				.filter((r) => r.result)
				.map((r) => ({
					mainTheme: r.mainTheme.title,
					miniTheme: r.miniTheme.title,
					score: r.result?.overallScore,
					gaps: r.result?.gaps.length,
					suggestions: r.result?.suggestions.length,
				})),
		};

		const blob = new Blob([JSON.stringify(report, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `comparison-report-${new Date().toISOString().split("T")[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}, [comparison.summary, comparison.results]);

	// Load themes on mount
	useEffect(() => {
		if (isHydrated) {
			fetchThemes();
		}
	}, [isHydrated, fetchThemes]);

	// Get classification job from localStorage
	useEffect(() => {
		const savedJobId = localStorage.getItem("lastClassificationJobId");
		if (savedJobId) {
			setClassificationJobId(savedJobId);
		}
	}, []);

	// Update summary when results change
	useEffect(() => {
		calculateSummary();
	}, [calculateSummary]);

	if (!isHydrated || isLoadingThemes) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoadingSpinner />
			</div>
		);
	}

	if (!settings.themePageId) {
		return <NoThemePageState />;
	}

	if (themesError) {
		return <ErrorState error={themesError} onRetry={fetchThemes} />;
	}

	const hasAnyResults = comparison.results.some((r) => r.result);
	const isAnyRunning = comparison.results.some((r) => r.isRunning);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="flex items-center gap-2 font-semibold text-2xl">
						<GitCompare className="size-6" />
						Global Comparison
					</h2>
					<p className="text-muted-foreground">
						Compare your content across all themes
					</p>
				</div>
				<div className="flex gap-2">
					{hasAnyResults && (
						<Button onClick={exportReport} variant="outline">
							<Download className="mr-2 size-4" />
							Export Report
						</Button>
					)}
					<Button
						disabled={!classificationJobId || isAnyRunning}
						onClick={runAllComparisons}
					>
						{isAnyRunning ? (
							<>
								<Loader2 className="mr-2 size-4 animate-spin" />
								Running...
							</>
						) : (
							<>
								<Target className="mr-2 size-4" />
								Compare All Themes
							</>
						)}
					</Button>
				</div>
			</div>

			{/* Configuration Status */}
			{!classificationJobId && (
				<Card className="border-amber-200 bg-amber-50">
					<CardContent className="flex items-center gap-4 pt-6">
						<AlertCircle className="size-8 text-amber-600" />
						<div>
							<p className="font-medium">No Classification Data</p>
							<p className="text-muted-foreground text-sm">
								Process topper essays and run classification first to enable
								comparison.
							</p>
						</div>
						<Link className="ml-auto" href="/projects">
							<Button variant="outline">Go to Projects</Button>
						</Link>
					</CardContent>
				</Card>
			)}

			{/* Summary Cards */}
			{comparison.summary && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<SummaryCard
						label="Themes Compared"
						value={comparison.summary.themesCompared.toString()}
					/>
					<SummaryCard
						label="Average Score"
						value={comparison.summary.averageScore.toString()}
					/>
					<SummaryCard
						label="Total Gaps"
						value={comparison.summary.totalGaps.toString()}
					/>
					<SummaryCard
						highlight={comparison.summary.highPriorityGaps > 0}
						label="High Priority"
						value={comparison.summary.highPriorityGaps.toString()}
					/>
				</div>
			)}

			{/* Top Suggestions */}
			{comparison.summary && comparison.summary.topSuggestions.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<AlertTriangle className="size-5" />
							Priority Recommendations
						</CardTitle>
						<CardDescription>Top suggestions across all themes</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-3">
							{comparison.summary.topSuggestions.map((suggestion) => (
								<div
									className="flex items-start gap-3 rounded-lg border p-3"
									key={suggestion.id}
								>
									<Badge variant={getPriorityBadgeVariant(suggestion.priority)}>
										{suggestion.priority}
									</Badge>
									<div className="flex-1">
										<p className="text-sm">{suggestion.description}</p>
										<p className="mt-1 text-muted-foreground text-xs">
											{formatContentType(suggestion.contentType)}
											{suggestion.exampleCategory &&
												` - ${formatContentType(suggestion.exampleCategory)}`}
										</p>
									</div>
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Theme Results Grid */}
			<div>
				<h3 className="mb-4 font-medium text-lg">Theme Comparison Results</h3>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{comparison.results.map((themeResult) => (
						<ThemeResultCard
							error={themeResult.error}
							isRunning={themeResult.isRunning}
							key={`${themeResult.mainTheme.id}-${themeResult.miniTheme.id}`}
							mainTheme={themeResult.mainTheme}
							miniTheme={themeResult.miniTheme}
							onRunComparison={() =>
								runThemeComparison(
									themeResult.mainTheme.id,
									themeResult.miniTheme.id
								)
							}
							result={themeResult.result}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

function SummaryCard({
	label,
	value,
	highlight = false,
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<Card className={highlight ? "border-red-200 bg-red-50" : ""}>
			<CardContent className="pt-6">
				<p className="text-muted-foreground text-sm">{label}</p>
				<p className={`font-bold text-3xl ${highlight ? "text-red-600" : ""}`}>
					{value}
				</p>
			</CardContent>
		</Card>
	);
}

/**
 * Renders the status content for a theme result card.
 */
function ThemeResultCardStatus({
	isRunning,
	error,
	onRunComparison,
}: {
	isRunning: boolean;
	error: string | null;
	onRunComparison: () => void;
}) {
	if (error) {
		return <div className="text-destructive text-sm">{error}</div>;
	}

	if (isRunning) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<Loader2 className="size-4 animate-spin" />
				Analyzing...
			</div>
		);
	}

	return (
		<Button
			className="w-full"
			onClick={onRunComparison}
			size="sm"
			variant="outline"
		>
			Run Comparison
			<ArrowRight className="ml-2 size-4" />
		</Button>
	);
}

function ThemeResultCard({
	mainTheme,
	miniTheme,
	result,
	isRunning,
	error,
	onRunComparison,
}: {
	mainTheme: MainTheme;
	miniTheme: MiniTheme;
	result: ThemeComparisonResult | null;
	isRunning: boolean;
	error: string | null;
	onRunComparison: () => void;
}) {
	if (result) {
		return (
			<Link href={`/themes/${miniTheme.id}/compare`}>
				<ComparisonResultsSummary result={result} />
			</Link>
		);
	}

	return (
		<Card className="p-4">
			<div className="mb-3">
				<p className="font-medium">{miniTheme.title}</p>
				<p className="text-muted-foreground text-sm">{mainTheme.title}</p>
			</div>

			<ThemeResultCardStatus
				error={error}
				isRunning={isRunning}
				onRunComparison={onRunComparison}
			/>
		</Card>
	);
}

function formatContentType(type: ContentType | string): string {
	return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function NoThemePageState() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-2xl">Global Comparison</h2>
				<p className="text-muted-foreground">
					Compare your content across all themes
				</p>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<BookOpen className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">No Theme Page Selected</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Please connect to Notion and select a theme page first.
				</p>
				<Link href="/themes">
					<Button className="mt-4" variant="outline">
						Go to Themes
					</Button>
				</Link>
			</Card>
		</div>
	);
}

interface ErrorStateProps {
	error: string;
	onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-2xl">Global Comparison</h2>
				<p className="text-muted-foreground">
					Compare your content across all themes
				</p>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-destructive/10 p-4">
					<AlertCircle className="size-8 text-destructive" />
				</div>
				<h3 className="font-medium text-lg">Failed to Load Themes</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">{error}</p>
				<Button className="mt-4" onClick={onRetry} variant="outline">
					Try Again
				</Button>
			</Card>
		</div>
	);
}
