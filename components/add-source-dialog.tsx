"use client";

import { useMutation, useQuery } from "convex/react";
import {
	BookOpen,
	CheckCircle,
	ExternalLink,
	Loader2,
	Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { NotionPageSearch } from "@/components/notion-page-search";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UploadZone } from "@/components/upload-zone";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MIME_TO_SOURCE_TYPE } from "@/lib/constants/upload";
import { useSettings } from "@/lib/hooks/use-settings";
import type { UploadResponse } from "@/types/upload";

interface AddSourceDialogProps {
	trigger: React.ReactNode;
	projectId: string;
}

type TabType = "notion" | "upload" | "library";

interface SelectedPage {
	id: string;
	title: string;
}

export function AddSourceDialog({ trigger, projectId }: AddSourceDialogProps) {
	const { settings } = useSettings();
	const addSource = useMutation(api.projects.addSource);

	const [open, setOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<TabType>("notion");
	const [selectedPage, setSelectedPage] = useState<SelectedPage | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploadedFiles, setUploadedFiles] = useState<UploadResponse[]>([]);
	const [librarySearch, setLibrarySearch] = useState("");

	const allAssets = useQuery(api.assets.list, {});
	const projectAssets = useQuery(
		api.assets.listByProject,
		projectId ? { projectId: projectId as never } : "skip"
	);

	const availableAssets = useMemo(() => {
		if (!(allAssets && projectAssets)) {
			return [];
		}
		const assignedIds = new Set(
			projectAssets.map((a: { _id: string }) => a._id)
		);
		return allAssets.filter(
			(a: { _id: string; processingStatus: string }) =>
				a.processingStatus === "extraction_completed" && !assignedIds.has(a._id)
		);
	}, [allAssets, projectAssets]);

	const assignAsset = useMutation(api.assets.assignToProject);

	const handleAssignAsset = async (asset: {
		_id: string;
		filename: string;
	}) => {
		if (!projectId) {
			return;
		}
		setIsLoading(true);
		setError(null);
		try {
			await assignAsset({
				id: asset._id as never,
				projectId: projectId as never,
			});
			toast.success(`Added "${asset.filename}" to project`);
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to assign asset");
		} finally {
			setIsLoading(false);
		}
	};

	const handlePageSelect = (pageId: string, pageTitle: string) => {
		setSelectedPage({ id: pageId, title: pageTitle });
		setError(null);
	};

	const handleAddNotionPage = async () => {
		if (!selectedPage) {
			setError("Please select a Notion page");
			return;
		}

		setError(null);
		setIsLoading(true);

		try {
			await addSource({
				projectId: projectId as Id<"projects">,
				type: "notion",
				reference: selectedPage.id,
				name: selectedPage.title,
			});

			await processNotionSource(selectedPage.id);

			setSelectedPage(null);
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add source");
		} finally {
			setIsLoading(false);
		}
	};

	const processNotionSource = async (pageId: string) => {
		try {
			const response = await fetch("/api/sources/process", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId,
					pageId,
					type: "notion",
					parameters: settings.extractionParameters,
					modelConfig: settings.modelConfig,
				}),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? "Failed to process source");
			}
		} catch (err) {
			// Log but don't fail - source is added, processing can be retried
			console.error("Failed to process source:", err);
		}
	};

	const handleUploadComplete = async (response: UploadResponse) => {
		setUploadedFiles((prev) => [...prev, response]);

		try {
			const sourceType =
				MIME_TO_SOURCE_TYPE[
					response.type as keyof typeof MIME_TO_SOURCE_TYPE
				] || "image";

			await addSource({
				projectId: projectId as Id<"projects">,
				type: sourceType as "pdf" | "image",
				reference: response.url,
				name: response.filename,
			});
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to add uploaded file as source"
			);
		}
	};

	const handleUploadError = (uploadError: string) => {
		setError(uploadError);
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!isLoading) {
			setOpen(newOpen);
			if (!newOpen) {
				setSelectedPage(null);
				setError(null);
				setActiveTab("notion");
				setUploadedFiles([]);
				setLibrarySearch("");
			}
		}
	};

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogTrigger asChild>{trigger}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Content Source</DialogTitle>
					<DialogDescription>
						Add a Notion page, upload a file, or use an existing asset from the
						library.
					</DialogDescription>
				</DialogHeader>

				{/* Tabs */}
				<div className="flex gap-2 border-b">
					<button
						className={`flex items-center gap-2 border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
							activeTab === "notion"
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab("notion")}
						type="button"
					>
						<ExternalLink className="size-4" />
						Notion Page
					</button>
					<button
						className={`flex items-center gap-2 border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
							activeTab === "upload"
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab("upload")}
						type="button"
					>
						<Upload className="size-4" />
						Upload File
					</button>
					<button
						className={`flex items-center gap-2 border-b-2 px-4 py-2 font-medium text-sm transition-colors ${
							activeTab === "library"
								? "border-primary text-foreground"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab("library")}
						type="button"
					>
						<BookOpen className="size-4" />
						From Library
					</button>
				</div>

				{/* Tab Content */}
				<div className="py-4">
					{activeTab === "notion" && (
						<NotionTabContent
							onClearSelection={() => setSelectedPage(null)}
							onPageSelect={handlePageSelect}
							onSetError={setError}
							selectedPage={selectedPage}
						/>
					)}
					{activeTab === "upload" && (
						<UploadZone
							autoProcess
							disabled={isLoading}
							modelConfig={settings.modelConfig}
							multiple
							onUploadComplete={handleUploadComplete}
							onUploadError={handleUploadError}
							parameters={settings.extractionParameters}
							projectId={projectId}
						/>
					)}
					{activeTab === "library" && (
						<LibraryTabContent
							availableAssets={availableAssets}
							librarySearch={librarySearch}
							onAssignAsset={handleAssignAsset}
							onSearchChange={setLibrarySearch}
						/>
					)}
				</div>

				{error && <p className="text-destructive text-sm">{error}</p>}

				<DialogFooter>
					<Button
						disabled={isLoading}
						onClick={() => handleOpenChange(false)}
						type="button"
						variant="outline"
					>
						{activeTab === "upload" && uploadedFiles.length > 0
							? "Done"
							: "Cancel"}
					</Button>
					{activeTab === "notion" && (
						<Button
							disabled={isLoading || !selectedPage}
							onClick={handleAddNotionPage}
						>
							{isLoading && <Loader2 className="size-4 animate-spin" />}
							Add Page
						</Button>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface NotionTabContentProps {
	onPageSelect: (pageId: string, pageTitle: string) => void;
	onSetError: (error: string | null) => void;
	selectedPage: SelectedPage | null;
	onClearSelection: () => void;
}

function NotionTabContent({
	onPageSelect,
	onSetError,
	selectedPage,
	onClearSelection,
}: NotionTabContentProps) {
	return (
		<div className="grid gap-4">
			<div className="relative grid gap-2">
				<NotionPageSearch
					onError={onSetError}
					onSelect={onPageSelect}
					placeholder="Search for a Notion page..."
				/>
				<p className="text-muted-foreground text-xs">
					Search and select a Notion page to add as a content source.
				</p>
			</div>

			{selectedPage && (
				<div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
					<CheckCircle className="size-4 text-green-500" />
					<span className="flex-1 truncate text-sm">{selectedPage.title}</span>
					<Button onClick={onClearSelection} size="sm" variant="ghost">
						Change
					</Button>
				</div>
			)}
		</div>
	);
}

interface LibraryTabContentProps {
	availableAssets: {
		_id: string;
		filename: string;
		extractedItemCount?: number;
	}[];
	librarySearch: string;
	onSearchChange: (value: string) => void;
	onAssignAsset: (asset: { _id: string; filename: string }) => void;
}

function LibraryTabContent({
	availableAssets,
	librarySearch,
	onSearchChange,
	onAssignAsset,
}: LibraryTabContentProps) {
	return (
		<div className="space-y-3">
			<Input
				onChange={(e) => onSearchChange(e.target.value)}
				placeholder="Search assets..."
				value={librarySearch}
			/>
			<div className="max-h-60 space-y-2 overflow-y-auto">
				{availableAssets
					.filter((a) =>
						a.filename.toLowerCase().includes(librarySearch.toLowerCase())
					)
					.map((asset) => (
						<button
							className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted"
							key={asset._id}
							onClick={() => onAssignAsset(asset)}
							type="button"
						>
							<div>
								<p className="font-medium text-sm">{asset.filename}</p>
								<p className="text-muted-foreground text-xs">
									{asset.extractedItemCount ?? 0} items extracted
								</p>
							</div>
						</button>
					))}
				{availableAssets.length === 0 && (
					<p className="py-4 text-center text-muted-foreground text-sm">
						No completed assets available
					</p>
				)}
			</div>
		</div>
	);
}
