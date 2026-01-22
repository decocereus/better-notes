"use client";

import {
	ArrowLeft,
	FileText,
	Link as LinkIcon,
	MoreVertical,
	Pencil,
	Plus,
	RefreshCw,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import type { ContentSource, Project } from "@/types/project";

interface ProjectDetailContentProps {
	projectId: string;
}

function shouldDeleteFromBlobStorage(source: ContentSource): boolean {
	const isFileSource = source.type === "pdf" || source.type === "image";
	const isBlobUrl = source.reference.includes("blob.vercel-storage.com");
	return isFileSource && isBlobUrl;
}

async function deleteFileFromBlobStorage(url: string): Promise<void> {
	const response = await fetch("/api/upload/delete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ url }),
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.error || "Failed to delete file from storage");
	}
}

async function removeSourceFromProject(
	projectId: string,
	sourceId: string
): Promise<void> {
	const response = await fetch(`/api/projects/${projectId}/sources`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ sourceId }),
	});

	if (!response.ok) {
		throw new Error("Failed to delete source");
	}
}

export function ProjectDetailContent({ projectId }: ProjectDetailContentProps) {
	const router = useRouter();
	const [project, setProject] = useState<Project | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
	const [isDeletingSource, setIsDeletingSource] = useState(false);
	const [showDeleteProject, setShowDeleteProject] = useState(false);
	const [isDeletingProject, setIsDeletingProject] = useState(false);

	const fetchProject = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			const response = await fetch(`/api/projects/${projectId}`);
			if (!response.ok) {
				if (response.status === 404) {
					setProject(null);
					return;
				}
				throw new Error("Failed to fetch project");
			}

			const data = (await response.json()) as { project: Project };
			setProject(data.project);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load project");
		} finally {
			setIsLoading(false);
		}
	}, [projectId]);

	useEffect(() => {
		fetchProject();
	}, [fetchProject]);

	const handleSourceAdded = (source: ContentSource) => {
		if (project) {
			setProject({
				...project,
				sources: [...project.sources, source],
				updatedAt: new Date().toISOString(),
			});
		}
	};

	const handleDeleteSource = async () => {
		if (!(deleteSourceId && project)) {
			return;
		}

		const source = project.sources.find((s) => s.id === deleteSourceId);
		if (!source) {
			return;
		}

		setIsDeletingSource(true);
		try {
			if (shouldDeleteFromBlobStorage(source)) {
				await deleteFileFromBlobStorage(source.reference);
			}

			await removeSourceFromProject(projectId, deleteSourceId);

			setProject({
				...project,
				sources: project.sources.filter((s) => s.id !== deleteSourceId),
				updatedAt: new Date().toISOString(),
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete source");
		} finally {
			setIsDeletingSource(false);
			setDeleteSourceId(null);
		}
	};

	const handleDeleteProject = async () => {
		setIsDeletingProject(true);
		try {
			const response = await fetch(`/api/projects/${projectId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete project");
			}

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

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	if (!project) {
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
					<Button onClick={fetchProject} size="icon" variant="outline">
						<RefreshCw className="size-4" />
						<span className="sr-only">Refresh</span>
					</Button>
					<AddSourceDialog
						onSourceAdded={handleSourceAdded}
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
								onSourceAdded={handleSourceAdded}
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
					<SourceList onDelete={setDeleteSourceId} sources={project.sources} />
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
