"use client";

import { useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	ArrowLeft,
	BookOpen,
	FileText,
	Link as LinkIcon,
	Loader2,
	MoreVertical,
	Pencil,
	Play,
	Plus,
	Sparkles,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type Dispatch,
	type SetStateAction,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { AddSourceDialog } from "@/components/add-source-dialog";
import { AddThemePageDialog } from "@/components/add-theme-page-dialog";
import { EditProjectDialog } from "@/components/edit-project-dialog";
import {
	type PipelineStep,
	PipelineStepper,
	type StepStatus,
} from "@/components/pipeline-stepper";
import { ProjectWorkflow } from "@/components/project-workflow";
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
import { Badge } from "@/components/ui/badge";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { Asset } from "@/types/asset";
import type { ContentSource, Project } from "@/types/project";
import type { MainTheme } from "@/types/theme";

interface ThemePage {
	_id: string;
	id: string;
	title: string;
	themes: MainTheme[];
	stats: {
		mainThemes: number;
		miniThemes: number;
		questions: number;
	};
}

interface ProjectDetailContentProps {
	projectId: string;
}

type RemoveSourceMutation = (args: {
	id: Id<"contentSources">;
}) => Promise<unknown>;

type RemoveProjectMutation = (args: { id: Id<"projects"> }) => Promise<unknown>;

type UpdateProjectMutation = (args: {
	id: Id<"projects">;
	themePageId: Id<"themePages">;
}) => Promise<unknown>;

interface RouterHandle {
	push: (href: string) => void;
}

// Pipeline step status derivation helpers (extracted to reduce cognitive complexity)
function deriveSourceStatus(
	totalSources: number,
	processingSources: number,
	completedSources: number
): StepStatus {
	if (totalSources === 0) {
		return "pending";
	}
	if (processingSources > 0) {
		return "active";
	}
	if (completedSources === totalSources) {
		return "completed";
	}
	return "pending";
}

function deriveExtractionStatus(
	extractionComplete: boolean,
	extractionProcessing: boolean
): StepStatus {
	if (extractionComplete) {
		return "completed";
	}
	if (extractionProcessing) {
		return "active";
	}
	return "pending";
}

function deriveClassificationStatus(
	classStatus: string | undefined
): StepStatus {
	if (classStatus === "completed") {
		return "completed";
	}
	if (classStatus === "processing") {
		return "active";
	}
	if (classStatus === "failed") {
		return "failed";
	}
	return "pending";
}

async function deleteProjectSource({
	deleteSourceId,
	project,
	removeSource,
	setDeleteSourceId,
	setIsDeletingSource,
	setError,
}: {
	deleteSourceId: string | null;
	project: Project | null | undefined;
	removeSource: RemoveSourceMutation;
	setDeleteSourceId: Dispatch<SetStateAction<string | null>>;
	setIsDeletingSource: Dispatch<SetStateAction<boolean>>;
	setError: Dispatch<SetStateAction<string | null>>;
}): Promise<void> {
	if (!deleteSourceId) {
		return;
	}

	setIsDeletingSource(true);
	setError(null);

	try {
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
}

async function deleteProjectAndRedirect({
	projectId,
	removeProject,
	router,
	setError,
	setIsDeletingProject,
	setShowDeleteProject,
}: {
	projectId: string;
	removeProject: RemoveProjectMutation;
	router: RouterHandle;
	setError: Dispatch<SetStateAction<string | null>>;
	setIsDeletingProject: Dispatch<SetStateAction<boolean>>;
	setShowDeleteProject: Dispatch<SetStateAction<boolean>>;
}): Promise<void> {
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
}

async function applyThemePageUpdate({
	projectId,
	themePageId,
	updateProject,
	setError,
	setIsUpdatingTheme,
}: {
	projectId: string;
	themePageId: Id<"themePages">;
	updateProject: UpdateProjectMutation;
	setError: Dispatch<SetStateAction<string | null>>;
	setIsUpdatingTheme: Dispatch<SetStateAction<boolean>>;
}): Promise<void> {
	setIsUpdatingTheme(true);
	setError(null);

	try {
		await updateProject({
			id: projectId as Id<"projects">,
			themePageId,
		});
	} catch (err) {
		setError(
			err instanceof Error ? err.message : "Failed to update theme page"
		);
	} finally {
		setIsUpdatingTheme(false);
	}
}

async function updateThemePageSelection({
	projectId,
	value,
	updateProject,
	setError,
	setIsUpdatingTheme,
	setShowAddThemePage,
}: {
	projectId: string;
	value: string;
	updateProject: UpdateProjectMutation;
	setError: Dispatch<SetStateAction<string | null>>;
	setIsUpdatingTheme: Dispatch<SetStateAction<boolean>>;
	setShowAddThemePage: Dispatch<SetStateAction<boolean>>;
}): Promise<void> {
	if (value === "add-new") {
		setShowAddThemePage(true);
		return;
	}

	await applyThemePageUpdate({
		projectId,
		themePageId: value as Id<"themePages">,
		updateProject,
		setError,
		setIsUpdatingTheme,
	});
}

async function bulkProcessSources({
	project,
	setIsBulkProcessing,
}: {
	project: Project;
	setIsBulkProcessing: Dispatch<SetStateAction<boolean>>;
}): Promise<void> {
	const pendingSources = project.sources.filter(
		(s) => s.status === "pending" || s.status === "failed"
	);
	if (pendingSources.length === 0) {
		return;
	}

	setIsBulkProcessing(true);

	try {
		const results = await Promise.allSettled(
			pendingSources.map(async (source) => {
				const res = await fetch("/api/sources/process", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						sourceId: source.id,
						projectId: project.id,
						reference: source.reference,
						type: source.type,
					}),
				});
				if (!res.ok) {
					throw new Error(`Failed to process ${source.name}`);
				}
			})
		);

		const successCount = results.filter((r) => r.status === "fulfilled").length;
		const failCount = results.filter((r) => r.status === "rejected").length;

		if (failCount > 0) {
			toast.warning(
				`Processed ${successCount}/${pendingSources.length} sources`,
				{
					description: `${failCount} failed to start`,
				}
			);
		} else {
			toast.success(`Processing ${successCount} sources`);
		}
	} catch {
		toast.error("Bulk processing failed");
	} finally {
		setIsBulkProcessing(false);
	}
}

export function ProjectDetailContent({ projectId }: ProjectDetailContentProps) {
	const router = useRouter();

	// Convex queries and mutations
	const project = useQuery(api.projects.get, {
		id: projectId as Id<"projects">,
	}) as Project | null | undefined;

	const themePages = useQuery(api.themePages.list) as ThemePage[] | undefined;

	const themePage = useQuery(
		api.themePages.get,
		project?.themePageId
			? { id: project.themePageId as Id<"themePages"> }
			: "skip"
	) as ThemePage | null | undefined;

	// Query assets for this project (for the workflow)
	const assets = useQuery(
		api.assets.listByProject,
		projectId ? { projectId: projectId as Id<"projects"> } : "skip"
	);

	// Pipeline data queries
	const latestClassification = useQuery(
		api.classificationJobs.getLatestByProject,
		project ? { projectId: project.id as never } : "skip"
	);
	const comparisonResults = useQuery(
		api.comparisonResults.listByProject,
		project ? { projectId: project.id as never } : "skip"
	);
	const generatedNotes = useQuery(
		api.generatedNotes.listByProject,
		project ? { projectId: project.id as never } : "skip"
	);

	const removeProject = useMutation(api.projects.remove);
	const removeSource = useMutation(api.projects.removeSource);
	const updateProject = useMutation(api.projects.update);

	const [deleteSourceId, setDeleteSourceId] = useState<string | null>(null);
	const [isDeletingSource, setIsDeletingSource] = useState(false);
	const [showDeleteProject, setShowDeleteProject] = useState(false);
	const [isDeletingProject, setIsDeletingProject] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showAddThemePage, setShowAddThemePage] = useState(false);
	const [isUpdatingTheme, setIsUpdatingTheme] = useState(false);
	const [showEditProject, setShowEditProject] = useState(false);
	const [isBulkProcessing, setIsBulkProcessing] = useState(false);

	const handleProcessAll = () => {
		if (project) {
			bulkProcessSources({ project, setIsBulkProcessing });
		}
	};

	// Pipeline stepper data
	const pipelineSteps = useMemo((): PipelineStep[] => {
		const sources = project?.sources ?? [];
		const completedSources = sources.filter(
			(s) => s.status === "completed"
		).length;
		const processingSources = sources.filter(
			(s) => s.status === "processing"
		).length;
		const totalSources = sources.length;

		const projectAssetsList = (assets ?? []) as Asset[];
		const extractionComplete = projectAssetsList.some(
			(a) => a.processingStatus === "extraction_completed"
		);
		const extractionProcessing = projectAssetsList.some(
			(a) =>
				a.processingStatus === "extraction_processing" ||
				a.processingStatus === "ocr_processing"
		);

		const classStatus = latestClassification?.status;
		const compCount = (comparisonResults ?? []).filter(
			(c) => c.status === "completed"
		).length;
		const noteCount = (generatedNotes ?? []).length;

		return [
			{
				id: "sources",
				label: "Sources",
				status: deriveSourceStatus(
					totalSources,
					processingSources,
					completedSources
				),
				count: totalSources,
			},
			{
				id: "extraction",
				label: "Extraction",
				status: deriveExtractionStatus(
					extractionComplete,
					extractionProcessing
				),
			},
			{
				id: "classification",
				label: "Classification",
				status: deriveClassificationStatus(classStatus),
			},
			{
				id: "comparison",
				label: "Comparison",
				status: compCount > 0 ? "completed" : "pending",
				count: compCount,
			},
			{
				id: "notes",
				label: "Notes",
				status: noteCount > 0 ? "completed" : "pending",
				count: noteCount,
			},
		];
	}, [
		project,
		assets,
		latestClassification,
		comparisonResults,
		generatedNotes,
	]);

	// Toast notifications for status transitions
	const prevClassStatusRef = useRef(latestClassification?.status);

	useEffect(() => {
		const prevStatus = prevClassStatusRef.current;
		const newStatus = latestClassification?.status;
		prevClassStatusRef.current = newStatus;

		if (!(prevStatus && newStatus) || prevStatus === newStatus) {
			return;
		}

		if (newStatus === "completed") {
			toast.success("Classification complete", {
				description: `${latestClassification?.classifiedItems ?? 0} items classified`,
			});
		} else if (newStatus === "failed") {
			toast.error("Classification failed", {
				description: latestClassification?.error ?? "Unknown error",
			});
		}
	}, [latestClassification]);

	const prevCompCountRef = useRef(0);

	useEffect(() => {
		const newCount = (comparisonResults ?? []).filter(
			(c) => c.status === "completed"
		).length;
		if (newCount > prevCompCountRef.current && prevCompCountRef.current > 0) {
			toast.success("Comparison complete", {
				description: `${newCount} themes compared`,
			});
		}
		prevCompCountRef.current = newCount;
	}, [comparisonResults]);

	function handleStepClick(stepId: string) {
		const element = document.getElementById(`section-${stepId}`);
		if (element) {
			element.scrollIntoView({ behavior: "smooth" });
		}
	}

	const handleDeleteSource = () => {
		deleteProjectSource({
			deleteSourceId,
			project,
			removeSource,
			setDeleteSourceId,
			setIsDeletingSource,
			setError,
		});
	};

	const handleDeleteProject = () => {
		deleteProjectAndRedirect({
			projectId,
			removeProject,
			router,
			setError,
			setIsDeletingProject,
			setShowDeleteProject,
		});
	};

	const handleThemePageChange = (value: string) => {
		updateThemePageSelection({
			projectId,
			value,
			updateProject,
			setError,
			setIsUpdatingTheme,
			setShowAddThemePage,
		});
	};

	const handleThemePageAdded = (newThemePageId: Id<"themePages">) => {
		applyThemePageUpdate({
			projectId,
			themePageId: newThemePageId,
			updateProject,
			setError,
			setIsUpdatingTheme,
		});
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
							<DropdownMenuItem onClick={() => setShowEditProject(true)}>
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

			{/* Pipeline Stepper */}
			{project.themePageId && (
				<PipelineStepper onStepClick={handleStepClick} steps={pipelineSteps} />
			)}

			{/* Error State */}
			{error && (
				<Card className="border-destructive bg-destructive/10 p-4">
					<p className="text-destructive text-sm">{error}</p>
				</Card>
			)}

			{/* Theme Page Warning/Selection */}
			<ThemePageWarningCard
				isUpdatingTheme={isUpdatingTheme}
				onThemePageChange={handleThemePageChange}
				projectThemePageId={project.themePageId}
				themePage={themePage}
				themePages={themePages}
			/>

			{/* Theme Page Info */}
			<ThemePageInfoCard themePage={themePage} />

			{/* Content Sources Section */}
			<ContentSourcesCard
				isBulkProcessing={isBulkProcessing}
				onDeleteSource={setDeleteSourceId}
				onProcessAll={handleProcessAll}
				project={project}
				projectId={projectId}
			/>

			{/* Workflow Section: Classification, Comparison, Notes */}
			{themePage && (
				<div id="section-extraction">
					<div id="section-classification">
						<div id="section-comparison">
							<div id="section-notes">
								<WorkflowSection
									assets={assets}
									projectId={projectId}
									sources={project.sources as ContentSource[]}
									themePage={themePage}
								/>
							</div>
						</div>
					</div>
				</div>
			)}

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

			{/* Controlled AddThemePageDialog */}
			<AddThemePageDialog
				onOpenChange={setShowAddThemePage}
				onThemePageAdded={handleThemePageAdded}
				open={showAddThemePage}
			/>

			{/* Edit Project Dialog */}
			<EditProjectDialog
				onOpenChange={setShowEditProject}
				open={showEditProject}
				project={{
					id: project.id,
					name: project.name,
					description: project.description,
					themePageId: project.themePageId,
				}}
			/>
		</div>
	);
}

interface ThemePageWarningCardProps {
	isUpdatingTheme: boolean;
	onThemePageChange: (value: string) => void;
	projectThemePageId?: string | null;
	themePage: ThemePage | null | undefined;
	themePages: ThemePage[] | undefined;
}

function ThemePageWarningCard({
	isUpdatingTheme,
	onThemePageChange,
	projectThemePageId,
	themePage,
	themePages,
}: ThemePageWarningCardProps) {
	const isThemePageMissing = Boolean(projectThemePageId && themePage === null);
	if (!isThemePageMissing) {
		return null;
	}

	const pages = themePages ?? [];
	const hasThemePages = pages.length > 0;

	return (
		<Card className="border-amber-500/50 bg-amber-500/10 p-4">
			<div className="flex items-start gap-3">
				<AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-500" />
				<div className="flex-1 space-y-3">
					<div>
						<h4 className="font-medium text-amber-600 dark:text-amber-500">
							Theme Page Unavailable
						</h4>
						<p className="text-muted-foreground text-sm">
							The theme page for this project was deleted. Select a new one to
							continue with classification.
						</p>
					</div>
					<Select
						disabled={isUpdatingTheme}
						onValueChange={onThemePageChange}
						value=""
					>
						<SelectTrigger className="w-full max-w-sm">
							<SelectValue placeholder="Select a theme page..." />
						</SelectTrigger>
						<SelectContent>
							{hasThemePages ? (
								<>
									{pages.map((page) => (
										<SelectItem key={page.id} value={page.id}>
											{page.title} ({page.stats.questions} questions)
										</SelectItem>
									))}
									<SelectSeparator />
									<SelectItem value="add-new">
										<span className="flex items-center gap-2">
											<Plus className="size-4" />
											Add new theme page...
										</span>
									</SelectItem>
								</>
							) : (
								<SelectItem value="add-new">
									<span className="flex items-center gap-2">
										<Plus className="size-4" />
										Add your first theme page...
									</span>
								</SelectItem>
							)}
						</SelectContent>
					</Select>
				</div>
			</div>
		</Card>
	);
}

interface ThemePageInfoCardProps {
	themePage: ThemePage | null | undefined;
}

function ThemePageInfoCard({ themePage }: ThemePageInfoCardProps) {
	if (!themePage) {
		return null;
	}

	return (
		<Card className="p-4">
			<div className="flex items-center gap-3">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
					<BookOpen className="size-5 text-primary" />
				</div>
				<div className="flex-1">
					<Link
						className="font-medium hover:underline"
						href={`/themes/${themePage.id}`}
					>
						{themePage.title}
					</Link>
					<div className="flex flex-wrap gap-2">
						<Badge className="text-xs" variant="secondary">
							{themePage.stats.mainThemes} main themes
						</Badge>
						<Badge className="text-xs" variant="outline">
							{themePage.stats.questions} questions
						</Badge>
					</div>
				</div>
			</div>
		</Card>
	);
}

interface ContentSourcesCardProps {
	project: Project;
	projectId: string;
	isBulkProcessing: boolean;
	onProcessAll: () => void;
	onDeleteSource: Dispatch<SetStateAction<string | null>>;
}

function ContentSourcesCard({
	project,
	projectId,
	isBulkProcessing,
	onProcessAll,
	onDeleteSource,
}: ContentSourcesCardProps) {
	const hasPendingOrFailed = project.sources.some(
		(s) => s.status === "pending" || s.status === "failed"
	);
	const pendingOrFailedCount = project.sources.filter(
		(s) => s.status === "pending" || s.status === "failed"
	).length;

	return (
		<Card className="p-6" id="section-sources">
			<div className="mb-4 flex items-center justify-between">
				<h3 className="font-medium text-lg">Content Sources</h3>
				{hasPendingOrFailed && (
					<Button
						disabled={isBulkProcessing}
						onClick={onProcessAll}
						size="sm"
						variant="outline"
					>
						{isBulkProcessing ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : (
							<Play className="mr-2 h-4 w-4" />
						)}
						Process All ({pendingOrFailedCount})
					</Button>
				)}
			</div>

			{project.sources.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="mb-4 rounded-full bg-muted p-4">
						<FileText className="size-8 text-muted-foreground" />
					</div>
					<p className="text-muted-foreground">No content sources added yet</p>
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
					onDelete={onDeleteSource}
					projectId={projectId}
					sources={project.sources.map((s) => ({
						id: s.id as string,
						type: s.type,
						reference: s.reference,
						name: s.name,
						addedAt: s.addedAt,
						status: s.status,
						metadata: s.metadata,
						error: s.metadata?.error as string | undefined,
					}))}
				/>
			)}
		</Card>
	);
}

function shouldDeleteFromR2Storage(source: ContentSource): boolean {
	const isFileSource = source.type === "pdf" || source.type === "image";
	const isR2Key = source.reference.startsWith("projects/");
	return isFileSource && isR2Key;
}

async function deleteFileFromR2Storage(key: string): Promise<void> {
	const response = await fetch("/api/storage/delete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key }),
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.error || "Failed to delete file from storage");
	}
}

// Workflow section component to avoid nested ternaries
interface WorkflowSectionProps {
	assets: Asset[] | undefined;
	sources: ContentSource[];
	projectId: string;
	themePage: ThemePage;
}

function WorkflowSection({
	assets,
	projectId,
	sources,
	themePage,
}: WorkflowSectionProps) {
	// Loading state
	if (assets === undefined) {
		return (
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Analysis Workflow</h3>
				<div className="flex items-center gap-3 py-4 text-muted-foreground">
					<div className="rounded-full bg-muted p-2">
						<div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
					</div>
					<p>Loading content sources...</p>
				</div>
			</Card>
		);
	}

	// Empty state
	if (assets.length === 0 && sources.length === 0) {
		return (
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Analysis Workflow</h3>
				<div className="flex flex-col items-center justify-center py-8 text-center">
					<div className="mb-4 rounded-full bg-muted p-4">
						<Sparkles className="size-8 text-muted-foreground" />
					</div>
					<p className="text-muted-foreground">
						Add content sources to start the analysis workflow
					</p>
					<p className="mt-1 max-w-md text-muted-foreground text-sm">
						Upload PDFs or connect Notion pages to extract and classify content
					</p>
				</div>
			</Card>
		);
	}

	// Active workflow
	return (
		<ProjectWorkflow
			assets={assets}
			projectId={projectId}
			sources={sources}
			themePageId={themePage.id}
			themes={themePage.themes as MainTheme[]}
		/>
	);
}
