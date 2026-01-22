"use client";

import { AlertCircle, BookOpen, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useSettings } from "@/lib/hooks/use-settings";
import type { MainTheme } from "@/types";
import { NotionPageSearch } from "./notion-page-search";
import { ThemeTree } from "./theme-tree";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { ErrorMessage } from "./ui/error-message";
import { LoadingSpinner } from "./ui/loading-spinner";

interface ThemeStats {
	totalMainThemes: number;
	totalMiniThemes: number;
	totalQuestions: number;
	yearsRange: { min: number; max: number } | null;
}

interface ThemesData {
	themes: MainTheme[];
	pageTitle: string;
	parsedAt: string;
	stats: ThemeStats;
}

/**
 * Main content component for the Themes page.
 * Handles Notion connection check, theme page selection, and data fetching.
 */
export function ThemesContent() {
	const {
		settings,
		isHydrated,
		isNotionConnected,
		hasThemePage,
		updateSettings,
	} = useSettings();

	const [themesData, setThemesData] = useState<ThemesData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	/**
	 * Fetches themes from the API.
	 */
	const fetchThemes = useCallback(async () => {
		if (!(settings.notionApiKey && settings.themePageId)) {
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/themes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					apiKey: settings.notionApiKey,
					pageId: settings.themePageId,
				}),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? "Failed to fetch themes");
			}

			const data = (await response.json()) as ThemesData;
			setThemesData(data);

			// Update page title in settings if changed
			if (data.pageTitle !== settings.themePageTitle) {
				updateSettings({ themePageTitle: data.pageTitle });
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch themes");
		} finally {
			setIsLoading(false);
		}
	}, [
		settings.notionApiKey,
		settings.themePageId,
		settings.themePageTitle,
		updateSettings,
	]);

	// Fetch themes when page ID changes
	useEffect(() => {
		if (isHydrated && settings.notionApiKey && settings.themePageId) {
			fetchThemes();
		}
	}, [isHydrated, settings.notionApiKey, settings.themePageId, fetchThemes]);

	/**
	 * Handles theme page selection from search.
	 */
	const handlePageSelect = useCallback(
		(page: { id: string; title: string }) => {
			updateSettings({
				themePageId: page.id,
				themePageTitle: page.title,
			});
		},
		[updateSettings]
	);

	/**
	 * Clears the selected theme page.
	 */
	const handleClearPage = useCallback(() => {
		updateSettings({
			themePageId: undefined,
			themePageTitle: undefined,
		});
		setThemesData(null);
	}, [updateSettings]);

	// Show loading during hydration
	if (!isHydrated) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoadingSpinner />
			</div>
		);
	}

	// Show setup prompt if Notion not connected
	if (!isNotionConnected) {
		return <NotConnectedState />;
	}

	// Show page selector if no theme page selected
	if (!hasThemePage) {
		return (
			<PageSelectorState
				apiKey={settings.notionApiKey ?? ""}
				onSelect={handlePageSelect}
			/>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header with page info and actions */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-2xl">Themes</h2>
					<p className="text-muted-foreground">
						{settings.themePageTitle ?? "Loading..."}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button onClick={handleClearPage} size="sm" variant="outline">
						Change Page
					</Button>
					<Button
						disabled={isLoading}
						onClick={fetchThemes}
						size="sm"
						variant="outline"
					>
						{isLoading ? (
							<LoadingSpinner className="size-4" />
						) : (
							<RefreshCw className="size-4" />
						)}
						{isLoading ? "Refreshing..." : "Refresh"}
					</Button>
				</div>
			</div>

			{/* Error state */}
			{error && (
				<ErrorMessage
					message={error}
					retry={fetchThemes}
					title="Failed to load themes"
				/>
			)}

			{/* Loading state */}
			{isLoading && !themesData && (
				<div className="flex flex-col items-center justify-center py-12">
					<LoadingSpinner className="size-8" />
					<p className="mt-4 text-muted-foreground">Parsing themes...</p>
				</div>
			)}

			{/* Theme data */}
			{themesData && (
				<>
					{/* Stats */}
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary">
							{themesData.stats.totalMainThemes} main themes
						</Badge>
						<Badge variant="secondary">
							{themesData.stats.totalMiniThemes} mini themes
						</Badge>
						<Badge variant="secondary">
							{themesData.stats.totalQuestions} questions
						</Badge>
						{themesData.stats.yearsRange && (
							<Badge variant="outline">
								{themesData.stats.yearsRange.min} -{" "}
								{themesData.stats.yearsRange.max}
							</Badge>
						)}
					</div>

					{/* Theme tree */}
					<ThemeTree themes={themesData.themes} />

					{/* Last updated */}
					<p className="text-muted-foreground text-xs">
						Last updated: {new Date(themesData.parsedAt).toLocaleString()}
					</p>
				</>
			)}
		</div>
	);
}

/**
 * State shown when Notion is not connected.
 */
function NotConnectedState() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-2xl">Themes</h2>
				<p className="text-muted-foreground">
					Browse and manage essay themes from Notion
				</p>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<BookOpen className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Connect Notion First</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Connect your Notion account to view your essay themes.
				</p>
				<Link href="/settings">
					<Button className="mt-4">Go to Settings</Button>
				</Link>
			</Card>
		</div>
	);
}

interface PageSelectorStateProps {
	apiKey: string;
	onSelect: (page: { id: string; title: string }) => void;
}

/**
 * State shown when Notion is connected but no theme page selected.
 */
function PageSelectorState({ apiKey, onSelect }: PageSelectorStateProps) {
	const [searchError, setSearchError] = useState<string | null>(null);

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-2xl">Themes</h2>
				<p className="text-muted-foreground">
					Select a Notion page containing your essay themes
				</p>
			</div>

			<Card className="p-6">
				<div className="space-y-4">
					<div className="flex items-center gap-2">
						<AlertCircle className="size-5 text-amber-500" />
						<h3 className="font-medium">Select Theme Page</h3>
					</div>
					<p className="text-muted-foreground text-sm">
						Search for and select the Notion page that contains your essay
						themes. The page should have a hierarchical structure with main
						themes, mini themes, and questions.
					</p>

					{searchError && (
						<p className="text-destructive text-sm">{searchError}</p>
					)}

					<NotionPageSearch
						apiKey={apiKey}
						onError={setSearchError}
						onSelect={(page) => {
							setSearchError(null);
							onSelect(page);
						}}
						placeholder="Search for your themes page..."
					/>

					<p className="text-muted-foreground text-xs">
						Tip: Your themes page should have toggles or headings for main
						themes, with nested mini themes and questions in "YYYY: Question
						text" format.
					</p>
				</div>
			</Card>
		</div>
	);
}
