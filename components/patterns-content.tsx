"use client";

import { AlertCircle, FileText, Loader2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ExtractedContentBrowser } from "@/components/extracted-content-browser";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSettings } from "@/lib/hooks/use-settings";
import type { ExtractedContent } from "@/types/extraction";

/**
 * Response type for extraction job status.
 */
interface ExtractionJobResponse {
	job: {
		id: string;
		status: "pending" | "processing" | "completed" | "failed";
		progress: number;
		totalItems: number;
		processedItems: number;
		errors: string[];
		createdAt: string;
		completedAt?: string;
	};
	results?: {
		jobId: string;
		ocrJobId: string;
		sourceKey: string;
		totalEssays: number;
		allItems: ExtractedContent[];
		stats: {
			totalEssays: number;
			totalItems: number;
			byType: Record<string, number>;
			byQuality: Record<string, number>;
			overusedCount: number;
			multiUseCount: number;
		};
	};
}

/**
 * Patterns page content - displays extracted content and extraction status.
 */
export function PatternsContent() {
	const { isHydrated } = useSettings();
	const [extractedItems, setExtractedItems] = useState<ExtractedContent[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeJobId, setActiveJobId] = useState<string | null>(null);
	const [jobProgress, setJobProgress] = useState<number>(0);

	// Load extracted items from localStorage (simulating persistence)
	const loadExtractedItems = useCallback(() => {
		try {
			const stored = localStorage.getItem("betternotes:extracted-items");
			if (stored) {
				const items = JSON.parse(stored) as ExtractedContent[];
				setExtractedItems(items);
			}
		} catch {
			console.error("Failed to load extracted items");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Save extracted items to localStorage
	const saveExtractedItems = useCallback((items: ExtractedContent[]) => {
		try {
			localStorage.setItem(
				"betternotes:extracted-items",
				JSON.stringify(items)
			);
			setExtractedItems(items);
		} catch {
			console.error("Failed to save extracted items");
		}
	}, []);

	// Poll for extraction job status
	const pollJobStatus = useCallback(
		async (jobId: string) => {
			try {
				const response = await fetch(`/api/extract?jobId=${jobId}`);
				const data = (await response.json()) as ExtractionJobResponse;

				if (data.job.status === "completed" && data.results) {
					// Merge new items with existing
					const newItems = data.results.allItems;
					const mergedItems = [...extractedItems, ...newItems];
					saveExtractedItems(mergedItems);
					setActiveJobId(null);
					setJobProgress(100);
				} else if (data.job.status === "failed") {
					setError(
						data.job.errors?.[0] || "Extraction failed. Please try again."
					);
					setActiveJobId(null);
				} else {
					// Still processing
					setJobProgress(data.job.progress);
					// Poll again after 2 seconds
					setTimeout(() => pollJobStatus(jobId), 2000);
				}
			} catch {
				setError("Failed to check extraction status");
				setActiveJobId(null);
			}
		},
		[extractedItems, saveExtractedItems]
	);

	// Initial load
	useEffect(() => {
		if (isHydrated) {
			loadExtractedItems();
		}
	}, [isHydrated, loadExtractedItems]);

	// Start polling if there's an active job
	useEffect(() => {
		if (activeJobId) {
			pollJobStatus(activeJobId);
		}
	}, [activeJobId, pollJobStatus]);

	const handleRefresh = () => {
		setIsLoading(true);
		loadExtractedItems();
	};

	const handleClearAll = () => {
		localStorage.removeItem("betternotes:extracted-items");
		setExtractedItems([]);
	};

	const handleItemSelect = (item: ExtractedContent) => {
		// Future: Open detail modal or navigate to detail page
		console.log("Selected item:", item);
	};

	if (!isHydrated || isLoading) {
		return (
			<div className="flex items-center justify-center p-12">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-2xl">Topper Patterns</h2>
					<p className="text-muted-foreground">
						Extracted patterns from topper essays
					</p>
				</div>
				<div className="flex gap-2">
					<Button onClick={handleRefresh} variant="outline">
						<RefreshCw className="size-4" />
						Refresh
					</Button>
					<Link href="/upload">
						<Button>
							<Plus className="size-4" />
							Extract New
						</Button>
					</Link>
				</div>
			</div>

			{/* Error display */}
			{error && (
				<Card className="border-destructive/50 bg-destructive/10 p-4">
					<div className="flex items-center gap-2">
						<AlertCircle className="size-5 text-destructive" />
						<p className="text-destructive text-sm">{error}</p>
					</div>
					<Button
						className="mt-2"
						onClick={() => setError(null)}
						size="sm"
						variant="outline"
					>
						Dismiss
					</Button>
				</Card>
			)}

			{/* Active job progress */}
			{activeJobId && (
				<Card className="p-4">
					<div className="flex items-center gap-3">
						<Loader2 className="size-5 animate-spin text-primary" />
						<div className="flex-1">
							<p className="font-medium">Extracting content...</p>
							<div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
								<div
									className="h-full bg-primary transition-all"
									style={{ width: `${jobProgress}%` }}
								/>
							</div>
							<p className="mt-1 text-muted-foreground text-xs">
								{jobProgress}% complete
							</p>
						</div>
					</div>
				</Card>
			)}

			{/* Content area */}
			{extractedItems.length === 0 ? (
				<EmptyState />
			) : (
				<>
					{/* Clear button with confirmation */}
					<div className="flex justify-end">
						<ClearAllDialog onClear={handleClearAll} />
					</div>

					{/* Content browser */}
					<ExtractedContentBrowser
						items={extractedItems}
						onItemSelect={handleItemSelect}
					/>
				</>
			)}

			{/* Overused Examples Alert */}
			<Card className="border-amber-500/20 bg-amber-500/5 p-4">
				<h4 className="font-medium text-amber-700 dark:text-amber-400">
					Overused Examples to Avoid
				</h4>
				<p className="mt-1 text-muted-foreground text-sm">
					Common overused examples are automatically flagged during extraction.
					Configure your custom list in{" "}
					<Link
						className="underline hover:text-foreground"
						href="/settings/parameters"
					>
						Extraction Parameters
					</Link>
					.
				</p>
				<div className="mt-2 flex flex-wrap gap-1">
					{["Gandhi", "Buddha", "Ashoka", "Mandela", "MLK"].map((name) => (
						<Badge key={name} variant="outline">
							{name}
						</Badge>
					))}
				</div>
			</Card>
		</div>
	);
}

/**
 * Empty state when no patterns are extracted.
 */
function EmptyState() {
	return (
		<Card className="flex flex-col items-center justify-center p-12 text-center">
			<div className="mb-4 rounded-full bg-muted p-4">
				<FileText className="size-8 text-muted-foreground" />
			</div>
			<h3 className="font-medium text-lg">No patterns extracted yet</h3>
			<p className="mt-1 max-w-sm text-muted-foreground text-sm">
				Upload topper essays and extract patterns to see them here. Patterns
				include intro techniques, examples, quotes, thinkers, and arguments.
			</p>
			<div className="mt-6 flex flex-col gap-2 sm:flex-row">
				<Link href="/upload">
					<Button>
						<Plus className="size-4" />
						Upload Essays
					</Button>
				</Link>
				<Link href="/settings/parameters">
					<Button variant="outline">Configure Parameters</Button>
				</Link>
			</div>
		</Card>
	);
}

/**
 * Confirmation dialog for clearing all extracted content.
 */
function ClearAllDialog({ onClear }: { onClear: () => void }) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button size="sm" variant="ghost">
					Clear All
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Clear all extracted content?</AlertDialogTitle>
					<AlertDialogDescription>
						This will permanently delete all extracted patterns from topper
						essays. This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={onClear} variant="destructive">
						Clear All
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
