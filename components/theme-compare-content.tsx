"use client";

/**
 * Theme Compare Content Component
 * Displays comparison analysis between user content and topper content for a theme.
 */

import {
	AlertCircle,
	ArrowLeft,
	BookOpen,
	GitCompare,
	Loader2,
	RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ComparisonResults } from "@/components/comparison-results";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useSettings } from "@/lib/hooks/use-settings";
import type { ThemeComparisonResult } from "@/types/comparison";
import type { MainTheme, MiniTheme } from "@/types/theme";

interface ThemeCompareContentProps {
	themeId: string;
}

interface ComparisonState {
	isLoading: boolean;
	isRunning: boolean;
	error: string | null;
	result: ThemeComparisonResult | null;
	jobId: string | null;
}

/**
 * Finds a theme by ID in the theme hierarchy.
 */
function findThemeById(
	themes: MainTheme[],
	themeId: string
): { mainTheme: MainTheme | null; miniTheme: MiniTheme | null } {
	for (const mt of themes) {
		if (mt.id === themeId) {
			// If main theme selected, return first mini theme for comparison
			const miniTheme = mt.miniThemes[0] || null;
			return { mainTheme: mt, miniTheme };
		}
		for (const mini of mt.miniThemes) {
			if (mini.id === themeId) {
				return { mainTheme: mt, miniTheme: mini };
			}
		}
	}
	return { mainTheme: null, miniTheme: null };
}

/**
 * Client component for theme comparison.
 */
export function ThemeCompareContent({ themeId }: ThemeCompareContentProps) {
	const { settings, isHydrated } = useSettings();
	const [themes, setThemes] = useState<MainTheme[]>([]);
	const [isLoadingThemes, setIsLoadingThemes] = useState(true);
	const [themesError, setThemesError] = useState<string | null>(null);

	const [classificationJobId, setClassificationJobId] = useState<string | null>(
		null
	);

	const [comparison, setComparison] = useState<ComparisonState>({
		isLoading: false,
		isRunning: false,
		error: null,
		result: null,
		jobId: null,
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
			setThemes(data.themes);
		} catch (err) {
			setThemesError(
				err instanceof Error ? err.message : "Failed to load themes"
			);
		} finally {
			setIsLoadingThemes(false);
		}
	}, [settings.themePageId]);

	/**
	 * Polls for comparison job results.
	 */
	const pollComparisonResults = useCallback(async (jobId: string) => {
		const maxAttempts = 60; // 60 seconds max
		let attempts = 0;

		try {
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
					setComparison((prev) => ({
						...prev,
						isRunning: false,
						result: data.results?.result || null,
					}));
					return;
				}

				if (data.job.status === "failed") {
					throw new Error("Comparison job failed");
				}

				// Wait before next poll
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}

			throw new Error("Comparison timed out");
		} catch (err) {
			setComparison((prev) => ({
				...prev,
				isRunning: false,
				error: err instanceof Error ? err.message : "Failed to get results",
			}));
		}
	}, []);

	/**
	 * Starts a comparison analysis.
	 */
	const startComparison = useCallback(async () => {
		if (!classificationJobId) {
			setComparison((prev) => ({
				...prev,
				error: "No classification job selected. Please process content first.",
			}));
			return;
		}

		const { mainTheme, miniTheme } = findThemeById(themes, themeId);
		if (!(mainTheme && miniTheme)) {
			setComparison((prev) => ({
				...prev,
				error: "Theme not found",
			}));
			return;
		}

		setComparison((prev) => ({
			...prev,
			isRunning: true,
			error: null,
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
				}),
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { error?: string };
				throw new Error(errorData.error || "Failed to start comparison");
			}

			const data = (await response.json()) as { jobId: string };
			setComparison((prev) => ({
				...prev,
				jobId: data.jobId,
			}));

			// Poll for results
			pollComparisonResults(data.jobId);
		} catch (err) {
			setComparison((prev) => ({
				...prev,
				isRunning: false,
				error:
					err instanceof Error ? err.message : "Failed to start comparison",
			}));
		}
	}, [classificationJobId, pollComparisonResults, themes, themeId]);

	/**
	 * Handles viewing specific content.
	 */
	const handleViewContent = useCallback((contentId: string) => {
		// For now, log to console - could open a modal or navigate
		console.log("View content:", contentId);
		// TODO: Implement content viewer modal
	}, []);

	// Load themes on mount
	useEffect(() => {
		if (isHydrated) {
			fetchThemes();
		}
	}, [isHydrated, fetchThemes]);

	// Try to get the most recent classification job from localStorage
	useEffect(() => {
		const savedJobId = localStorage.getItem("lastClassificationJobId");
		if (savedJobId) {
			setClassificationJobId(savedJobId);
		}
	}, []);

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

	const { mainTheme, miniTheme } = findThemeById(themes, themeId);

	if (!mainTheme) {
		return <NotFoundState themeId={themeId} />;
	}

	const displayTitle = miniTheme ? miniTheme.title : mainTheme.title;
	const parentTitle = miniTheme ? mainTheme.title : null;

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
					<h2 className="flex items-center gap-2 font-semibold text-2xl">
						<GitCompare className="size-6" />
						Compare Content
					</h2>
					<p className="text-muted-foreground text-sm">
						{displayTitle}
						{parentTitle && ` (${parentTitle})`}
					</p>
				</div>
				<Badge variant="secondary">Gap Analysis</Badge>
			</div>

			{/* Configuration Card */}
			{!comparison.result && (
				<Card className="p-6">
					<h3 className="mb-4 font-medium text-lg">Comparison Settings</h3>

					{classificationJobId ? (
						<div className="space-y-4">
							<div className="rounded-lg border bg-muted/50 p-4">
								<p className="text-sm">
									<span className="font-medium">Classification Job:</span>{" "}
									<code className="rounded bg-muted px-1 text-xs">
										{classificationJobId.slice(0, 8)}...
									</code>
								</p>
								<p className="mt-1 text-muted-foreground text-sm">
									This will compare all user content vs topper content for the
									selected theme.
								</p>
							</div>

							<Button
								className="w-full"
								disabled={comparison.isRunning}
								onClick={startComparison}
							>
								{comparison.isRunning ? (
									<>
										<Loader2 className="mr-2 size-4 animate-spin" />
										Analyzing...
									</>
								) : (
									<>
										<GitCompare className="mr-2 size-4" />
										Start Comparison
									</>
								)}
							</Button>

							{comparison.error && (
								<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
									<p className="text-destructive text-sm">{comparison.error}</p>
								</div>
							)}
						</div>
					) : (
						<div className="rounded-lg border border-dashed p-6 text-center">
							<AlertCircle className="mx-auto size-8 text-muted-foreground" />
							<p className="mt-2 font-medium">No Classification Data</p>
							<p className="mt-1 text-muted-foreground text-sm">
								You need to process topper essays and run classification first
								to compare content.
							</p>
							<Link href="/projects">
								<Button className="mt-4" variant="outline">
									Go to Projects
								</Button>
							</Link>
						</div>
					)}
				</Card>
			)}

			{/* Results */}
			{comparison.result && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="font-medium text-lg">Comparison Results</h3>
						<Button onClick={startComparison} size="sm" variant="outline">
							<RefreshCw className="mr-2 size-4" />
							Re-run
						</Button>
					</div>

					<ComparisonResults
						onViewContent={handleViewContent}
						result={comparison.result}
					/>
				</div>
			)}
		</div>
	);
}

function NoThemePageState() {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<h2 className="font-semibold text-2xl">Compare Content</h2>
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
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<h2 className="font-semibold text-2xl">Compare Content</h2>
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

interface NotFoundStateProps {
	themeId: string;
}

function NotFoundState({ themeId }: NotFoundStateProps) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<h2 className="font-semibold text-2xl">Compare Content</h2>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<BookOpen className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Theme Not Found</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					No theme found with ID: {themeId}
				</p>
				<Link href="/themes">
					<Button className="mt-4" variant="outline">
						Back to Themes
					</Button>
				</Link>
			</Card>
		</div>
	);
}
