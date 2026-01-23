"use client";

import { Clock, FileText, Hash, Layers } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ThemePageCardProps {
	id: string;
	title: string;
	stats: {
		mainThemes: number;
		miniThemes: number;
		questions: number;
		yearRange?: { min: number; max: number };
	};
	lastSyncedAt: string;
}

/**
 * Card component for displaying a theme page in the list view.
 * Shows title, stats, and last synced time.
 * Clickable to navigate to the detail page.
 */
export function ThemePageCard({
	id,
	title,
	stats,
	lastSyncedAt,
}: ThemePageCardProps) {
	const formattedDate = formatRelativeTime(lastSyncedAt);
	const yearRangeText = stats.yearRange
		? `${stats.yearRange.min}-${stats.yearRange.max}`
		: null;

	return (
		<Link href={`/themes/${id}`}>
			<Card className="p-4 transition-colors hover:bg-muted/50">
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
							<FileText className="size-5 text-primary" />
						</div>
						<div>
							<h3 className="font-medium leading-tight">{title}</h3>
							{yearRangeText && (
								<p className="text-muted-foreground text-xs">{yearRangeText}</p>
							)}
						</div>
					</div>
				</div>

				<div className="mt-4 flex flex-wrap gap-2">
					<Badge className="gap-1" variant="secondary">
						<Layers className="size-3" />
						{stats.mainThemes} main
					</Badge>
					<Badge className="gap-1" variant="outline">
						<Hash className="size-3" />
						{stats.miniThemes} mini
					</Badge>
					<Badge className="gap-1" variant="outline">
						<FileText className="size-3" />
						{stats.questions} questions
					</Badge>
				</div>

				<div className="mt-3 flex items-center gap-1 text-muted-foreground text-xs">
					<Clock className="size-3" />
					<span>Synced {formattedDate}</span>
				</div>
			</Card>
		</Link>
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
