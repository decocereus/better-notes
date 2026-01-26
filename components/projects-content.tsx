"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ProjectCard } from "@/components/project-card";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Project } from "@/types/project";

export function ProjectsContent() {
	const router = useRouter();
	const projects = useQuery(api.projects.list) as Project[] | undefined;
	const removeProject = useMutation(api.projects.remove);

	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [patternsSummary, setPatternsSummary] = useState<{
		totalItems: number;
		totalEssays: number;
		sources: number;
		lastUpdatedAt?: string | null;
	} | null>(null);
	const [patternsError, setPatternsError] = useState<string | null>(null);

	const handleProjectCreated = (projectId: string) => {
		router.push(`/projects/${projectId}`);
	};

	const handleDeleteRequest = (id: string) => {
		setDeleteId(id);
	};

	const handleDeleteConfirm = async () => {
		if (!deleteId) {
			return;
		}

		setIsDeleting(true);
		setError(null);

		try {
			await removeProject({ id: deleteId as Id<"projects"> });
			setDeleteId(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete project");
		} finally {
			setIsDeleting(false);
		}
	};

	const projectToDelete = deleteId
		? projects?.find((p) => p.id === deleteId)
		: null;

	useEffect(() => {
		const controller = new AbortController();

		const fetchSummary = async () => {
			const response = await fetch("/api/patterns?includeItems=false", {
				signal: controller.signal,
			});
			if (!response.ok) {
				throw new Error("Failed to load patterns summary");
			}
			return (await response.json()) as {
				totalItems: number;
				totalEssays: number;
				sources: number;
				lastUpdatedAt?: string | null;
			};
		};

		fetchSummary()
			.then((data) => {
				setPatternsSummary({
					totalItems: data.totalItems ?? 0,
					totalEssays: data.totalEssays ?? 0,
					sources: data.sources ?? 0,
					lastUpdatedAt: data.lastUpdatedAt ?? null,
				});
			})
			.catch((err) => {
				if (err instanceof Error && err.name !== "AbortError") {
					setPatternsError(err.message);
				}
			});

		return () => {
			controller.abort();
		};
	}, []);

	const patternsLastUpdated = patternsSummary?.lastUpdatedAt
		? new Date(patternsSummary.lastUpdatedAt).toLocaleString(undefined, {
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		: "Not yet";

	// Loading state
	if (projects === undefined) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-balance font-semibold text-2xl">Projects</h2>
					<p className="text-pretty text-muted-foreground">
						Manage your essay preparation projects
					</p>
				</div>
				<div className="flex items-center gap-2">
					<CreateProjectDialog
						onProjectCreated={handleProjectCreated}
						trigger={
							<Button>
								<Plus className="size-4" />
								New Project
							</Button>
						}
					/>
				</div>
			</div>

			{/* Error State */}
			{error && (
				<Card className="border-destructive bg-destructive/10 p-4">
					<p className="text-pretty text-destructive text-sm">{error}</p>
				</Card>
			)}

			{/* Patterns Summary */}
			<Card className="p-4">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h3 className="text-balance font-semibold text-base">
							Topper patterns library
						</h3>
						{patternsError ? (
							<p className="text-pretty text-destructive text-sm">
								{patternsError}
							</p>
						) : (
							<p className="text-pretty text-muted-foreground text-sm">
								{patternsSummary?.totalItems
									? `${patternsSummary.totalItems.toLocaleString()} patterns across ${patternsSummary.totalEssays.toLocaleString()} essays.`
									: "No patterns yet. Upload topper essays to build your library."}{" "}
								Last updated: {patternsLastUpdated}.
							</p>
						)}
					</div>
					<div className="flex gap-2">
						<Link href="/patterns">
							<Button variant="outline">View Patterns</Button>
						</Link>
						{!patternsSummary?.totalItems && (
							<Link href="/upload">
								<Button>Upload Topper Essays</Button>
							</Link>
						)}
					</div>
				</div>
				{patternsSummary?.totalItems ? (
					<div className="mt-4 grid gap-3 sm:grid-cols-3">
						<div className="rounded-lg border p-3">
							<p className="text-muted-foreground text-xs">Patterns</p>
							<p className="font-semibold text-lg tabular-nums">
								{patternsSummary.totalItems.toLocaleString()}
							</p>
						</div>
						<div className="rounded-lg border p-3">
							<p className="text-muted-foreground text-xs">Essays</p>
							<p className="font-semibold text-lg tabular-nums">
								{patternsSummary.totalEssays.toLocaleString()}
							</p>
						</div>
						<div className="rounded-lg border p-3">
							<p className="text-muted-foreground text-xs">Sources</p>
							<p className="font-semibold text-lg tabular-nums">
								{patternsSummary.sources.toLocaleString()}
							</p>
						</div>
					</div>
				) : null}
			</Card>

			{/* Projects List or Empty State */}
			{projects.length === 0 ? (
				<Card className="flex flex-col items-center justify-center p-12 text-center">
					<div className="mb-4 rounded-full bg-muted p-4">
						<Plus className="size-8 text-muted-foreground" />
					</div>
					<h3 className="text-balance font-medium text-lg">No projects yet</h3>
					<p className="mt-1 max-w-sm text-pretty text-muted-foreground text-sm">
						Create your first project to start organizing your essay preparation
						content.
					</p>
					<CreateProjectDialog
						onProjectCreated={handleProjectCreated}
						trigger={
							<Button className="mt-4">
								<Plus className="size-4" />
								Create Project
							</Button>
						}
					/>
				</Card>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{projects.map((project) => (
						<ProjectCard
							key={project.id}
							onDelete={handleDeleteRequest}
							project={{
								id: project.id,
								name: project.name,
								description: project.description,
								createdAt: project.createdAt,
								updatedAt: project.updatedAt,
								sources: project.sources,
							}}
						/>
					))}
				</div>
			)}

			{/* Delete Confirmation Dialog */}
			<AlertDialog
				onOpenChange={(open) => !open && setDeleteId(null)}
				open={deleteId !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Project</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{projectToDelete?.name}"? This
							action cannot be undone and all content sources will be removed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={isDeleting}
							onClick={handleDeleteConfirm}
							variant="destructive"
						>
							{isDeleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
