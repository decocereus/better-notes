"use client";

import { Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import type { Project } from "@/types/project";

export function ProjectsContent() {
	const router = useRouter();
	const [projects, setProjects] = useState<Project[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const fetchProjects = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			const response = await fetch("/api/projects");
			if (!response.ok) {
				throw new Error("Failed to fetch projects");
			}

			const data = (await response.json()) as { projects: Project[] };
			setProjects(data.projects);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load projects");
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchProjects();
	}, [fetchProjects]);

	const handleProjectCreated = (project: Project) => {
		// Navigate to the new project
		router.push(`/projects/${project.id}`);
	};

	const handleDeleteRequest = (id: string) => {
		setDeleteId(id);
	};

	const handleDeleteConfirm = async () => {
		if (!deleteId) {
			return;
		}

		setIsDeleting(true);
		try {
			const response = await fetch(`/api/projects/${deleteId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete project");
			}

			setProjects((prev) => prev.filter((p) => p.id !== deleteId));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete project");
		} finally {
			setIsDeleting(false);
			setDeleteId(null);
		}
	};

	const projectToDelete = deleteId
		? projects.find((p) => p.id === deleteId)
		: null;

	if (isLoading) {
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
					<h2 className="font-semibold text-2xl">Projects</h2>
					<p className="text-muted-foreground">
						Manage your essay preparation projects
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button onClick={fetchProjects} size="icon" variant="outline">
						<RefreshCw className="size-4" />
						<span className="sr-only">Refresh</span>
					</Button>
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
					<p className="text-destructive text-sm">{error}</p>
				</Card>
			)}

			{/* Projects List or Empty State */}
			{projects.length === 0 ? (
				<Card className="flex flex-col items-center justify-center p-12 text-center">
					<div className="mb-4 rounded-full bg-muted p-4">
						<Plus className="size-8 text-muted-foreground" />
					</div>
					<h3 className="font-medium text-lg">No projects yet</h3>
					<p className="mt-1 max-w-sm text-muted-foreground text-sm">
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
							project={project}
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
