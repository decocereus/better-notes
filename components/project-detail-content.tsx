"use client";

import { useMutation, useQuery } from "convex/react";
import {
	ArrowLeft,
	FileText,
	Link as LinkIcon,
	MoreVertical,
	Pencil,
	Plus,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddSourceDialog } from "@/components/add-source-dialog";
import { SourceList } from "@/components/source-list";
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
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ContentSource, Project } from "@/types/project";

interface ProjectDetailContentProps {
	projectId: string;
}

export function ProjectDetailContent({ projectId }: ProjectDetailContentProps) {
	const router = useRouter();

	// Convex queries and mutations
	const project = useQuery(api.projects.get, {
		id: projectId as Id<"projects">,
	}) as Project | null | undefined;
	const removeProject = useMutation(api.projects.remove);
	const removeSource = useMutation(api.projects.removeSource);

	const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
	const [isDeletingSource, setIsDeletingSource] = useState(false);
	const [showDeleteProject, setShowDeleteProject] = useState(false);
	const [isDeletingProject, setIsDeletingProject] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleDeleteSource = async () => {
		if (!deleteSourceId) {
			return;
		}

		setIsDeletingSource(true);
		setError(null);

		try {
			// Delete file from R2 storage if needed
			const source = project?.sources.find((s) => s.id === deleteSourceId);
			if (source && shouldDeleteFromR2Storage(source)) {
				await deleteFileFromR2Storage(source.reference);
			}

			await removeSource({ id: deleteSourceId as Id<"contentSources"> });
			setDeleteSourceId(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete source");
		} finally {
			setIsDeletingSource(false);
		}
	};

	const handleDeleteProject = async () => {
		setIsDeletingProject(true);
		setError(null);

		try {
			await removeProject({ id: projectId as Id<"projects"> });
			router.push("/projects");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete project");
			setIsDeletingProject(false);
			setShowDeleteProject(false);
		}
	};

	const sourceToDelete = deleteSourceId
		? project?.sources.find((s) => s.id === deleteSourceId)
		: null;

	// Loading state
	if (project === undefined) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	// Not found state
	if (project === null) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-4">
					<Link href="/projects">
						<Button size="icon" variant="ghost">
							<ArrowLeft className="size-5" />
						</Button>
					</Link>
					<div>
						<h2 className="font-semibold text-2xl">Project Not Found</h2>
						<p className="text-muted-foreground text-sm">
							This project does not exist or has been deleted.
						</p>
					</div>
				</div>
				<Card className="p-6">
					<Link href="/projects">
						<Button variant="outline">Back to Projects</Button>
					</Link>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/projects">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="font-semibold text-2xl">{project.name}</h2>
					{project.description && (
						<p className="text-muted-foreground text-sm">
							{project.description}
						</p>
					)}
				</div>
				<div className="flex items-center gap-2">
					<AddSourceDialog
						projectId={projectId}
						trigger={
							<Button>
								<Plus className="size-4" />
								Add Source
							</Button>
						}
					/>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="icon" variant="outline">
								<MoreVertical className="size-4" />
								<span className="sr-only">More options</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem disabled>
								<Pencil className="size-4" />
								Edit Project
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={() => setShowDeleteProject(true)}
							>
								<Trash2 className="size-4" />
								Delete Project
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Error State */}
			{error && (
				<Card className="border-destructive bg-destructive/10 p-4">
					<p className="text-destructive text-sm">{error}</p>
				</Card>
			)}

			{/* Content Sources Section */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Content Sources</h3>

				{project.sources.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<div className="mb-4 rounded-full bg-muted p-4">
							<FileText className="size-8 text-muted-foreground" />
						</div>
						<p className="text-muted-foreground">
							No content sources added yet
						</p>
						<div className="mt-4 flex gap-2">
							<AddSourceDialog
								projectId={projectId}
								trigger={
									<Button variant="outline">
										<LinkIcon className="size-4" />
										Add Notion Page
									</Button>
								}
							/>
						</div>
					</div>
				) : (
					<SourceList
						onDelete={setDeleteSourceId}
						sources={project.sources.map((s) => ({
							id: s.id as string,
							type: s.type,
							reference: s.reference,
							name: s.name,
							addedAt: s.addedAt,
							status: s.status,
						}))}
					/>
				)}
			</Card>

			{/* Delete Source Confirmation */}
			<AlertDialog
				onOpenChange={(open) => !open && setDeleteSourceId(null)}
				open={deleteSourceId !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove Source</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to remove "{sourceToDelete?.name}"? This
							action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingSource}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={isDeletingSource}
							onClick={handleDeleteSource}
							variant="destructive"
						>
							{isDeletingSource ? "Removing..." : "Remove"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Delete Project Confirmation */}
			<AlertDialog onOpenChange={setShowDeleteProject} open={showDeleteProject}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Project</AlertDialogTitle>
						<AlertDialogDescription>
							Are you sure you want to delete "{project.name}"? This action
							cannot be undone and all content sources will be removed.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isDeletingProject}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={isDeletingProject}
							onClick={handleDeleteProject}
							variant="destructive"
						>
							{isDeletingProject ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function shouldDeleteFromR2Storage(source: ContentSource): boolean {
	const isFileSource = source.type === "pdf" || source.type === "image";
	const isR2Key = source.reference.startsWith("projects/");
	return isFileSource && isR2Key;
}

async function deleteFileFromR2Storage(key: string): Promise<void> {
	const response = await fetch("/api/upload/delete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key }),
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.error || "Failed to delete file from storage");
	}
}
