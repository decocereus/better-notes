"use client";

import { useMutation, useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
					<h2 className="font-semibold text-2xl">Projects</h2>
					<p className="text-muted-foreground">
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
