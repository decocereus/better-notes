"use client";

import { useMutation } from "convex/react";
import { ExternalLink, Loader2, Upload } from "lucide-react";
import { useState } from "react";
import type { UploadResponse } from "@/app/api/upload/route";
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
import { Label } from "@/components/ui/label";
import { UploadZone } from "@/components/upload-zone";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MIME_TO_SOURCE_TYPE } from "@/lib/constants/upload";

interface AddSourceDialogProps {
	trigger: React.ReactNode;
	projectId: string;
}

type TabType = "notion" | "upload";

// Regex for extracting page name from Notion URL (remove trailing ID hash)
const NOTION_ID_REGEX = /-[a-f0-9]{32}$/i;
const DASH_TO_SPACE_REGEX = /-/g;

function isValidNotionUrl(url: string): boolean {
	return url.includes("notion.so") || url.includes("notion.site");
}

function extractPageNameFromUrl(url: string): string {
	const urlParts = url.split("/").pop()?.split("?")[0] || "";
	const name = urlParts
		.replace(NOTION_ID_REGEX, "")
		.replace(DASH_TO_SPACE_REGEX, " ");
	return name || "Notion Page";
}

export function AddSourceDialog({ trigger, projectId }: AddSourceDialogProps) {
	const addSource = useMutation(api.projects.addSource);

	const [open, setOpen] = useState(false);
	const [activeTab, setActiveTab] = useState<TabType>("notion");
	const [notionUrl, setNotionUrl] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [uploadedFiles, setUploadedFiles] = useState<UploadResponse[]>([]);

	const handleAddNotionPage = async () => {
		setError(null);

		const trimmedUrl = notionUrl.trim();
		if (!trimmedUrl) {
			setError("Please enter a Notion page URL");
			return;
		}

		if (!isValidNotionUrl(trimmedUrl)) {
			setError("Please enter a valid Notion URL");
			return;
		}

		setIsLoading(true);

		try {
			const pageName = extractPageNameFromUrl(trimmedUrl);

			await addSource({
				projectId: projectId as Id<"projects">,
				type: "notion",
				reference: trimmedUrl,
				name: pageName,
			});

			setNotionUrl("");
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add source");
		} finally {
			setIsLoading(false);
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
				setNotionUrl("");
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
							<div className="grid gap-2">
								<Label htmlFor="notion-url">Notion Page URL</Label>
								<Input
									disabled={isLoading}
									id="notion-url"
									onChange={(e) => setNotionUrl(e.target.value)}
									placeholder="https://notion.so/..."
									value={notionUrl}
								/>
								<p className="text-muted-foreground text-xs">
									Paste the URL of any Notion page you want to add as a content
									source.
								</p>
							</div>
						</div>
					) : (
						<UploadZone
							disabled={isLoading}
							multiple
							onUploadComplete={handleUploadComplete}
							onUploadError={handleUploadError}
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
							disabled={isLoading || !notionUrl.trim()}
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
