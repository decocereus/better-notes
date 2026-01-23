"use client";

import { useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	ArrowLeft,
	Loader2,
	RefreshCw,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ThemeTree } from "@/components/theme-tree";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { MainTheme } from "@/types";

interface ThemePageData {
	_id: string;
	id: string;
	notionPageId: string;
	title: string;
	themes: MainTheme[];
	stats: {
		mainThemes: number;
		miniThemes: number;
		questions: number;
		yearRange?: { min: number; max: number };
	};
	lastSyncedAt: string;
	createdAt: string;
}

interface ProjectData {
	_id: string;
	id: string;
	name: string;
}

interface ThemeDetailContentProps {
	themeId: string;
}

interface ThemeApiResponse {
	themes: MainTheme[];
	pageTitle: string;
	pageId: string;
	stats: {
		totalMainThemes: number;
		totalMiniThemes: number;
		totalQuestions: number;
		yearRange?: { min: number; max: number };
	};
	error?: string;
}

/**
 * Client component for displaying theme page details.
 * Shows theme tree, stats, resync and delete functionality.
 */
export function ThemeDetailContent({ themeId }: ThemeDetailContentProps) {
	const router = useRouter();

	// Convex queries and mutations
	const themePage = useQuery(api.themePages.get, {
		id: themeId as Id<"themePages">,
	}) as ThemePageData | null | undefined;

	const affectedProjects = useQuery(api.projects.listByThemePage, {
		themePageId: themeId as Id<"themePages">,
	}) as ProjectData[] | undefined;

	const syncThemePage = useMutation(api.themePages.sync);
	const removeThemePage = useMutation(api.themePages.remove);

	const [isSyncing, setIsSyncing] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	const handleSync = useCallback(async () => {
		if (!themePage) {
			return;
		}

		setIsSyncing(true);
		setSyncError(null);

		try {
			// Fetch fresh data from Notion
			const response = await fetch("/api/themes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pageId: themePage.notionPageId }),
			});

			if (!response.ok) {
				const errorData = (await response.json()) as { error: string };
				throw new Error(
					errorData.error || "Failed to fetch themes from Notion"
				);
			}

			const data = (await response.json()) as ThemeApiResponse;

			// Update Convex
			await syncThemePage({
				id: themeId as Id<"themePages">,
				title: data.pageTitle,
				themes: data.themes,
				stats: {
					mainThemes: data.stats.totalMainThemes,
					miniThemes: data.stats.totalMiniThemes,
					questions: data.stats.totalQuestions,
					yearRange: data.stats.yearRange,
				},
			});
		} catch (err) {
			setSyncError(err instanceof Error ? err.message : "Failed to sync");
		} finally {
			setIsSyncing(false);
		}
	}, [themePage, themeId, syncThemePage]);

	const handleDelete = useCallback(async () => {
		setIsDeleting(true);

		try {
			await removeThemePage({ id: themeId as Id<"themePages"> });
			router.push("/themes");
		} catch (err) {
			setSyncError(
				err instanceof Error ? err.message : "Failed to delete theme page"
			);
			setIsDeleting(false);
			setShowDeleteConfirm(false);
		}
	}, [themeId, removeThemePage, router]);

	// Loading state
	if (themePage === undefined) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Not found state
	if (themePage === null) {
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

	const yearRangeText = themePage.stats.yearRange
		? `${themePage.stats.yearRange.min}-${themePage.stats.yearRange.max}`
		: null;

	const affectedProjectCount = affectedProjects?.length ?? 0;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="font-semibold text-2xl">{themePage.title}</h2>
					<p className="text-muted-foreground text-sm">
						Last synced: {formatRelativeTime(themePage.lastSyncedAt)}
						{yearRangeText && ` · Years: ${yearRangeText}`}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button disabled={isSyncing} onClick={handleSync} variant="outline">
						{isSyncing ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<RefreshCw className="size-4" />
						)}
						{isSyncing ? "Syncing..." : "Resync"}
					</Button>
					<Button
						onClick={() => setShowDeleteConfirm(true)}
						variant="destructive"
					>
						<Trash2 className="size-4" />
						Delete
					</Button>
				</div>
			</div>

			{/* Error State */}
			{syncError && (
				<Card className="border-destructive bg-destructive/10 p-4">
					<p className="text-destructive text-sm">{syncError}</p>
				</Card>
			)}

			{/* Stats */}
			<div className="flex flex-wrap gap-3">
				<Badge className="text-sm" variant="secondary">
					{themePage.stats.mainThemes} main themes
				</Badge>
				<Badge className="text-sm" variant="outline">
					{themePage.stats.miniThemes} mini themes
				</Badge>
				<Badge className="text-sm" variant="outline">
					{themePage.stats.questions} questions
				</Badge>
				{affectedProjectCount > 0 && (
					<Badge className="text-sm" variant="default">
						Used by {affectedProjectCount} project
						{affectedProjectCount === 1 ? "" : "s"}
					</Badge>
				)}
			</div>

			{/* Theme Tree */}
			<Card className="p-6">
				<ThemeTree themes={themePage.themes} />
			</Card>

			{/* Delete Confirmation Dialog */}
			<AlertDialog onOpenChange={setShowDeleteConfirm} open={showDeleteConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete "{themePage.title}"?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-3">
								{affectedProjectCount > 0 && (
									<div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-amber-600 dark:text-amber-500">
										<AlertTriangle className="mt-0.5 size-4 shrink-0" />
										<span>
											{affectedProjectCount} project
											{affectedProjectCount === 1 ? " is" : "s are"} using this
											theme page. {affectedProjectCount === 1 ? "It" : "They"}{" "}
											will need a new theme page selected before classification.
										</span>
									</div>
								)}
								<p>
									This action cannot be undone. The theme page will be
									permanently deleted.
								</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={isDeleting}
							onClick={handleDelete}
							variant="destructive"
						>
							{isDeleting ? "Deleting..." : "Delete Anyway"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

/**
 * Format a date string to a relative time string.
 */
function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMinutes < 1) {
		return "just now";
	}
	if (diffMinutes < 60) {
		return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
	}
	if (diffHours < 24) {
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	}
	if (diffDays < 7) {
		return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
	}

	return date.toLocaleDateString();
}
