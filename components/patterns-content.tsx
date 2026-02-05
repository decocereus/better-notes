"use client";

import { AlertCircle, FileText, Loader2, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ExtractedContentBrowser } from "@/components/extracted-content-browser";
import { ReextractPatternsDialog } from "@/components/reextract-patterns-dialog";
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
import { useExtractionSse } from "@/lib/hooks/use-extraction-sse";
import { useSettings } from "@/lib/hooks/use-settings";
import type { ContentType, ExtractedContent } from "@/types/extraction";

interface PatternsResponse {
	items: ExtractedContent[];
	totalItems: number;
	totalEssays: number;
	sources: number;
	lastUpdatedAt?: string | null;
	sections?: Partial<Record<ContentType, string[]>>;
}

const QUALITY_ONLY_REGEX = /^(high|medium|low)(\s+quality)?$/i;
const META_REGEX = /^(quality|multi[-\s]?use|context)\b/i;
const CONTEXT_REGEX =
	/^(uses|use|usable|applicable|adaptable|can be applied|yes\s*-)/i;
const MULTI_USE_REGEX = /applicable|can be applied|multi[-\s]?use|adaptable/i;

function sanitizeExtractedItems(items: ExtractedContent[]): ExtractedContent[] {
	const sanitized: ExtractedContent[] = [];
	let lastItem: ExtractedContent | null = null;

	for (const item of items) {
		const content = item.content.trim();
		if (!content) {
			continue;
		}
		if (QUALITY_ONLY_REGEX.test(content) || META_REGEX.test(content)) {
			continue;
		}
		if (
			lastItem &&
			item.sourceRef === lastItem.sourceRef &&
			item.contentType === lastItem.contentType &&
			CONTEXT_REGEX.test(content)
		) {
			const prevContext = lastItem.context ?? "";
			const prevMultiUse = lastItem.multiUse ?? false;
			const appended = prevContext ? `${prevContext} ${content}` : content;
			const updated: ExtractedContent = {
				...lastItem,
				context: appended.trim(),
				multiUse: prevMultiUse || MULTI_USE_REGEX.test(content),
			};
			sanitized[sanitized.length - 1] = updated;
			lastItem = updated;
			continue;
		}

		sanitized.push(item);
		lastItem = item;
	}

	return sanitized;
}

/**
 * Patterns page content - displays extracted content and extraction status.
 */
export function PatternsContent() {
	const { isHydrated, settings } = useSettings();
	const [extractedItems, setExtractedItems] = useState<ExtractedContent[]>([]);
	const [summary, setSummary] = useState<{
		totalItems: number;
		totalEssays: number;
		essaysWithPatterns: number;
		sources: number;
		lastUpdatedAt?: string | null;
	} | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activeJobId, setActiveJobId] = useState<string | null>(null);
	const [reextractOpen, setReextractOpen] = useState(false);

	// Load extracted items from server (Convex + R2)
	const loadExtractedItems = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/patterns");
			if (!response.ok) {
				throw new Error("Failed to load patterns");
			}
			const data = (await response.json()) as PatternsResponse;
			const cleanedItems = sanitizeExtractedItems(data.items ?? []);
			const essaysWithPatterns = new Set(
				cleanedItems.map((item) =>
					item.essayTitle ? item.essayTitle : `Essay #${item.essayIndex ?? "?"}`
				)
			).size;
			setExtractedItems(cleanedItems);
			setSummary({
				totalItems: cleanedItems.length,
				totalEssays: data.totalEssays ?? 0,
				essaysWithPatterns,
				sources: data.sources ?? 0,
				lastUpdatedAt: data.lastUpdatedAt ?? null,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load patterns");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Use SSE for real-time progress tracking
	const { progress: jobProgress, isConnected: sseConnected } = useExtractionSse(
		{
			jobId: activeJobId,
			onCompleted: () => {
				loadExtractedItems().catch(() => {
					// Ignore refresh failures after completion; users can retry manually.
				});
				setActiveJobId(null);
			},
			onError: (message) => {
				setError(message);
				setActiveJobId(null);
			},
		}
	);

	// Initial load
	useEffect(() => {
		if (isHydrated) {
			loadExtractedItems().catch(() => {
				// Ignore initial load failures; error state is handled elsewhere.
			});
		}
	}, [isHydrated, loadExtractedItems]);

	const handleRefresh = () => {
		loadExtractedItems();
	};

	const handleClearAll = () => {
		setExtractedItems([]);
	};

	if (!isHydrated || isLoading) {
		return (
			<div className="flex items-center justify-center p-12">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	const lastUpdatedLabel = summary?.lastUpdatedAt
		? new Date(summary.lastUpdatedAt).toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "Not yet";
	const hasPatterns = Boolean(summary && summary.totalItems > 0);

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-balance font-semibold text-2xl">
						Topper Patterns
					</h2>
					<p className="text-pretty text-muted-foreground">
						Reusable introductions, examples, quotes, and arguments extracted
						from topper essays.
					</p>
				</div>
				<div className="flex gap-2">
					<Button onClick={handleRefresh} variant="outline">
						<RefreshCw className="size-4" />
						Refresh
					</Button>
					<Button onClick={() => setReextractOpen(true)} variant="outline">
						Re-extract
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

			<ReextractPatternsDialog
				modelConfig={settings.modelConfig}
				onJobStarted={(jobId) => setActiveJobId(jobId)}
				onOpenChange={setReextractOpen}
				open={reextractOpen}
				savedExtractionParameters={settings.extractionParameters}
			/>

			{/* Active job progress */}
			{activeJobId && (
				<Card className="p-4">
					<div className="flex items-center gap-3">
						<Loader2 className="size-5 animate-spin text-primary" />
						<div className="flex-1">
							<div className="flex items-center justify-between">
								<p className="font-medium">Extracting content...</p>
								{sseConnected && (
									<span className="text-muted-foreground text-xs">● Live</span>
								)}
							</div>
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

			{/* Summary + Guidance */}
			{summary && (
				<div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
					<Card className="p-4">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<h3 className="text-balance font-semibold text-base">
									Library status
								</h3>
								<p className="text-pretty text-muted-foreground text-sm">
									{hasPatterns
										? "These patterns are ready to use inside your projects."
										: "No patterns yet. Upload topper essays to build your library."}
								</p>
							</div>
							<div className="flex gap-2">
								<Link href="/projects">
									<Button variant="outline">Use in Projects</Button>
								</Link>
								<Link href="/upload">
									<Button>Upload More Essays</Button>
								</Link>
							</div>
						</div>
						<div className="mt-4 grid gap-3 sm:grid-cols-4">
							<div className="rounded-lg border p-3">
								<p className="text-muted-foreground text-xs">Patterns</p>
								<p className="font-semibold text-lg tabular-nums">
									{summary.totalItems.toLocaleString()}
								</p>
							</div>
							<div className="rounded-lg border p-3">
								<p className="text-muted-foreground text-xs">Essays</p>
								<p className="font-semibold text-lg tabular-nums">
									{summary.totalEssays.toLocaleString()}
								</p>
								<EssaysWithPatternsMeta
									essaysWithPatterns={summary.essaysWithPatterns}
									totalEssays={summary.totalEssays}
								/>
							</div>
							<div className="rounded-lg border p-3">
								<p className="text-muted-foreground text-xs">Sources</p>
								<p className="font-semibold text-lg tabular-nums">
									{summary.sources.toLocaleString()}
								</p>
							</div>
							<div className="rounded-lg border p-3">
								<p className="text-muted-foreground text-xs">Last updated</p>
								<p className="font-semibold text-sm tabular-nums">
									{lastUpdatedLabel}
								</p>
							</div>
						</div>
					</Card>

					<Card className="p-4">
						<h3 className="text-balance font-semibold text-base">
							How to use these patterns
						</h3>
						<ul className="mt-2 space-y-2 text-pretty text-muted-foreground text-sm">
							<li>1. Pick a project theme and add your own source notes.</li>
							<li>
								2. Use multi-use items to strengthen introductions and
								conclusions.
							</li>
							<li>
								3. Replace overused examples with higher-quality alternatives.
							</li>
						</ul>
					</Card>
				</div>
			)}

			{/* Legend */}
			<Card className="p-4">
				<h3 className="text-balance font-semibold text-base">
					Reading the cards
				</h3>
				<p className="text-pretty text-muted-foreground text-sm">
					Each card is a reusable snippet. Quality shows strength; multi-use
					means it works across themes, and overused flags common cliches.
				</p>
			</Card>

			{/* Content area */}
			{extractedItems.length === 0 ? (
				<EmptyState />
			) : (
				<>
					{/* Clear button with confirmation */}
					<div className="flex justify-end">
						<ClearAllDialog onClear={handleClearAll} />
					</div>

					<MissingEssaysCallout
						onReextract={() => setReextractOpen(true)}
						summary={summary}
					/>

					{/* Content browser */}
					<ExtractedContentBrowser items={extractedItems} />
				</>
			)}

			{/* Overused Examples Alert */}
			<Card className="border-amber-500/20 bg-amber-500/5 p-4">
				<h4 className="text-balance font-medium text-amber-700 dark:text-amber-400">
					Overused Examples to Avoid
				</h4>
				<p className="mt-1 text-pretty text-muted-foreground text-sm">
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

function EssaysWithPatternsMeta({
	totalEssays,
	essaysWithPatterns,
}: {
	totalEssays: number;
	essaysWithPatterns: number;
}) {
	if (totalEssays <= essaysWithPatterns) {
		return null;
	}

	return (
		<p className="mt-1 text-muted-foreground text-xs">
			with patterns:{" "}
			<span className="font-medium text-foreground tabular-nums">
				{essaysWithPatterns.toLocaleString()}
			</span>
		</p>
	);
}

function MissingEssaysCallout({
	summary,
	onReextract,
}: {
	summary: {
		totalEssays: number;
		essaysWithPatterns: number;
	} | null;
	onReextract: () => void;
}) {
	if (!summary || summary.totalEssays <= summary.essaysWithPatterns) {
		return null;
	}

	return (
		<Card className="border-amber-500/20 bg-amber-500/10 p-4">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p className="font-medium">Some essays have no extracted patterns</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Only {summary.essaysWithPatterns.toLocaleString()} of{" "}
						{summary.totalEssays.toLocaleString()} essays produced patterns.
						This usually happens when extraction returns 0 usable items (often
						because of strict quality filtering or model parsing issues).
						Re-extract with a lower quality threshold to backfill.
					</p>
				</div>
				<Button onClick={onReextract} variant="outline">
					Re-extract
				</Button>
			</div>
		</Card>
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
			<h3 className="text-balance font-medium text-lg">
				No patterns extracted yet
			</h3>
			<p className="mt-1 max-w-sm text-pretty text-muted-foreground text-sm">
				Upload topper essays to build your reusable pattern library for intros,
				examples, quotes, and arguments.
			</p>
			<div className="mt-6">
				<Link href="/upload">
					<Button>
						<Plus className="size-4" />
						Upload Essays
					</Button>
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
