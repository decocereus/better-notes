"use client";

import { ArrowRight, Clock, FileText, FolderKanban } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useProjects } from "@/lib/hooks/use-projects";

/**
 * Formats a date string to a relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffDays > 0) {
		return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
	}
	if (diffHours > 0) {
		return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
	}
	if (diffMinutes > 0) {
		return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
	}
	return "Just now";
}

interface ProjectItemProps {
	id: string;
	name: string;
	description?: string;
	sourceCount: number;
	updatedAt: string;
}

function ProjectItem({
	id,
	name,
	description,
	sourceCount,
	updatedAt,
}: ProjectItemProps) {
	return (
		<Link
			className="block rounded-lg p-3 transition-colors hover:bg-muted/50"
			href={`/projects/${id}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<FolderKanban className="size-4 shrink-0 text-primary" />
						<span className="truncate font-medium text-sm">{name}</span>
					</div>
					{description && (
						<p className="mt-1 truncate text-muted-foreground text-xs">
							{description}
						</p>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Badge className="text-xs" variant="secondary">
						<FileText className="mr-1 size-3" />
						{sourceCount}
					</Badge>
				</div>
			</div>
			<div className="mt-2 flex items-center gap-1 text-muted-foreground text-xs">
				<Clock className="size-3" />
				<span>{formatRelativeTime(updatedAt)}</span>
			</div>
		</Link>
	);
}

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center py-8 text-center">
			<FolderKanban className="mb-3 size-10 text-muted-foreground/50" />
			<p className="text-muted-foreground text-sm">No projects yet</p>
			<p className="mt-1 text-muted-foreground text-xs">
				Create your first project to get started
			</p>
			<Button asChild className="mt-4" size="sm" variant="outline">
				<Link href="/projects">
					Create Project
					<ArrowRight className="ml-1 size-3" />
				</Link>
			</Button>
		</div>
	);
}

interface RecentProjectsProps {
	/** Maximum number of projects to display */
	limit?: number;
}

export function RecentProjects({ limit = 5 }: RecentProjectsProps) {
	const { projects, isHydrated, recentProjects } = useProjects();

	// Show loading state until hydrated
	if (!isHydrated) {
		return (
			<Card className="p-4">
				<div className="flex items-center justify-between">
					<h3 className="font-medium">Recent Projects</h3>
				</div>
				<div className="flex items-center justify-center py-8">
					<LoadingSpinner size="md" />
				</div>
			</Card>
		);
	}

	const recent = recentProjects(limit);
	const hasProjects = projects.length > 0;

	return (
		<Card className="p-4">
			<div className="mb-2 flex items-center justify-between">
				<h3 className="font-medium">Recent Projects</h3>
				{hasProjects && (
					<Button asChild size="sm" variant="ghost">
						<Link href="/projects">
							View All
							<ArrowRight className="ml-1 size-3" />
						</Link>
					</Button>
				)}
			</div>

			{hasProjects ? (
				<div className="-mx-3 divide-y">
					{recent.map((project) => (
						<ProjectItem
							description={project.description}
							id={project.id}
							key={project.id}
							name={project.name}
							sourceCount={project.sources.length}
							updatedAt={project.updatedAt}
						/>
					))}
				</div>
			) : (
				<EmptyState />
			)}
		</Card>
	);
}
