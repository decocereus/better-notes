"use client";

import {
	CheckCircle,
	ExternalLink,
	FileText,
	Loader2,
	Search,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/hooks/use-settings";

interface PageSearchResult {
	id: string;
	title: string;
	icon: string | null;
	url: string;
	type: "page" | "database";
}

type SearchStatus = "idle" | "searching" | "error";

interface NotionDestinationConfigProps {
	/** Whether Notion is connected */
	isConnected: boolean;
}

/**
 * Component for configuring the Notion output destination for syncing notes.
 * Allows searching and selecting a Notion page to sync generated notes to.
 */
export function NotionDestinationConfig({
	isConnected,
}: NotionDestinationConfigProps) {
	const { settings, isHydrated, updateSettings, clearSetting } = useSettings();
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<PageSearchResult[]>([]);
	const [searchStatus, setSearchStatus] = useState<SearchStatus>("idle");
	const [searchError, setSearchError] = useState<string | null>(null);
	const [selectedPage, setSelectedPage] = useState<PageSearchResult | null>(
		null
	);

	const fetchPageInfo = useCallback(async (pageId: string) => {
		try {
			const response = await fetch(`/api/notion/page/${pageId}`);
			if (response.ok) {
				const data = (await response.json()) as PageSearchResult;
				setSelectedPage(data);
			}
		} catch {
			// Page info fetch failed, that's okay
		}
	}, []);

	// Load selected page info on mount
	useEffect(() => {
		if (isHydrated && settings.outputPageId && !selectedPage) {
			fetchPageInfo(settings.outputPageId);
		}
	}, [isHydrated, settings.outputPageId, selectedPage, fetchPageInfo]);

	const handleSearch = useCallback(async () => {
		if (!(searchQuery.trim() && isConnected)) {
			return;
		}

		setSearchStatus("searching");
		setSearchError(null);

		try {
			const response = await fetch(
				`/api/notion/search?q=${encodeURIComponent(searchQuery)}&type=page`
			);

			if (!response.ok) {
				throw new Error("Search failed");
			}

			const data = (await response.json()) as { results: PageSearchResult[] };
			setSearchResults(data.results || []);
			setSearchStatus("idle");
		} catch (error) {
			setSearchStatus("error");
			setSearchError(error instanceof Error ? error.message : "Search failed");
			setSearchResults([]);
		}
	}, [searchQuery, isConnected]);

	const handleSelectPage = useCallback(
		(page: PageSearchResult) => {
			setSelectedPage(page);
			updateSettings({
				outputPageId: page.id,
			});
			setSearchResults([]);
			setSearchQuery("");
		},
		[updateSettings]
	);

	const handleClearSelection = useCallback(() => {
		setSelectedPage(null);
		clearSetting("outputPageId");
	}, [clearSetting]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				handleSearch();
			}
		},
		[handleSearch]
	);

	if (!isHydrated) {
		return (
			<Card className="p-6">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					<span className="text-sm">Loading...</span>
				</div>
			</Card>
		);
	}

	if (!isConnected) {
		return (
			<Card className="p-6">
				<h3 className="font-medium text-lg">Notes Output Destination</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Connect to Notion first to configure the output destination.
				</p>
				<div className="mt-4 rounded-md bg-amber-500/10 p-3">
					<p className="text-amber-800 text-sm dark:text-amber-200">
						Please connect your Notion account above to select an output page.
					</p>
				</div>
			</Card>
		);
	}

	return (
		<Card className="p-6">
			<h3 className="font-medium text-lg">Notes Output Destination</h3>
			<p className="mt-1 text-muted-foreground text-sm">
				Select a Notion page where generated notes will be synced.
			</p>

			<div className="mt-6 space-y-4">
				{/* Current Selection */}
				{selectedPage && (
					<div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
						<div className="flex items-center gap-3">
							<div className="flex size-8 items-center justify-center rounded-md bg-background text-lg">
								{selectedPage.icon || <FileText className="size-4" />}
							</div>
							<div>
								<p className="font-medium text-sm">{selectedPage.title}</p>
								<a
									className="flex items-center gap-1 text-muted-foreground text-xs hover:text-primary"
									href={selectedPage.url}
									rel="noopener noreferrer"
									target="_blank"
								>
									Open in Notion
									<ExternalLink className="size-3" />
								</a>
							</div>
						</div>
						<Button onClick={handleClearSelection} size="sm" variant="outline">
							Change
						</Button>
					</div>
				)}

				{/* Search Input */}
				{!selectedPage && (
					<>
						<div className="space-y-2">
							<label className="font-medium text-sm" htmlFor="page-search">
								Search for a page
							</label>
							<div className="flex gap-2">
								<div className="relative flex-1">
									<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										className="pl-9"
										disabled={searchStatus === "searching"}
										id="page-search"
										onChange={(e) => setSearchQuery(e.target.value)}
										onKeyDown={handleKeyDown}
										placeholder="Search pages..."
										value={searchQuery}
									/>
								</div>
								<Button
									disabled={!searchQuery.trim() || searchStatus === "searching"}
									onClick={handleSearch}
								>
									{searchStatus === "searching" ? (
										<>
											<Loader2 className="size-4 animate-spin" />
											Searching...
										</>
									) : (
										"Search"
									)}
								</Button>
							</div>
						</div>

						{/* Search Results */}
						{searchResults.length > 0 && (
							<div className="max-h-60 space-y-1 overflow-y-auto rounded-md border p-2">
								{searchResults.map((page) => (
									<button
										className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted"
										key={page.id}
										onClick={() => handleSelectPage(page)}
										type="button"
									>
										<div className="flex size-6 items-center justify-center text-base">
											{page.icon || <FileText className="size-4" />}
										</div>
										<span className="flex-1 truncate text-sm">
											{page.title}
										</span>
										<CheckCircle className="size-4 text-transparent group-hover:text-primary" />
									</button>
								))}
							</div>
						)}

						{/* No Results */}
						{searchStatus === "idle" &&
							searchQuery &&
							searchResults.length === 0 && (
								<p className="text-center text-muted-foreground text-sm">
									No pages found. Try a different search term.
								</p>
							)}

						{/* Search Error */}
						{searchStatus === "error" && (
							<div className="flex items-start gap-3 rounded-md bg-red-500/10 p-3">
								<XCircle className="mt-0.5 size-4 text-red-600" />
								<div>
									<p className="font-medium text-red-800 text-sm dark:text-red-200">
										Search failed
									</p>
									{searchError && (
										<p className="text-red-700 text-xs dark:text-red-300">
											{searchError}
										</p>
									)}
								</div>
							</div>
						)}
					</>
				)}

				{/* Help Text */}
				<p className="text-muted-foreground text-xs">
					Make sure the integration has access to the page you want to use.
					Share the page with your Notion integration in the page settings.
				</p>
			</div>
		</Card>
	);
}
