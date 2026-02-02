"use client";

import { useMutation } from "convex/react";
import { CheckCircle, ExternalLink, Loader2, Upload } from "lucide-react";
import { useState } from "react";
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

type TabType = "notion" | "upload";

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
			// Store the page ID as reference (not URL)
			// This allows us to fetch content directly via API
			await addSource({
				projectId: projectId as Id<"projects">,
				type: "notion",
				reference: selectedPage.id,
				name: selectedPage.title,
			});

			// Trigger processing of the source
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
		// Fetch and process the Notion page content
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

		// Add uploaded file as content source
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
				// Reset form on close
				setSelectedPage(null);
				setError(null);
				setActiveTab("notion");
				setUploadedFiles([]);
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
						Add a Notion page or upload a file to this project.
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
				</div>

				{/* Tab Content */}
				<div className="py-4">
					{activeTab === "notion" ? (
						<div className="grid gap-4">
							<div className="relative grid gap-2">
								<NotionPageSearch
									onError={setError}
									onSelect={handlePageSelect}
									placeholder="Search for a Notion page..."
								/>
								<p className="text-muted-foreground text-xs">
									Search and select a Notion page to add as a content source.
								</p>
							</div>

							{/* Selected page indicator */}
							{selectedPage && (
								<div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
									<CheckCircle className="size-4 text-green-500" />
									<span className="flex-1 truncate text-sm">
										{selectedPage.title}
									</span>
									<Button
										onClick={() => setSelectedPage(null)}
										size="sm"
										variant="ghost"
									>
										Change
									</Button>
								</div>
							)}
						</div>
					) : (
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
