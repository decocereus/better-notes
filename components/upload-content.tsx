"use client";

import { CheckCircle2, FileImage, FileText } from "lucide-react";
import { useState } from "react";
import type { UploadResponse } from "@/app/api/upload/route";
import { Card } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { UploadZone } from "@/components/upload-zone";
import { MIME_TO_SOURCE_TYPE } from "@/lib/constants/upload";
import { useProjects } from "@/lib/hooks/use-projects";

interface UploadedFile {
	response: UploadResponse;
	addedToProject: boolean;
}

export function UploadContent() {
	const { projects, isHydrated, addSource } = useProjects();
	const [selectedProjectId, setSelectedProjectId] = useState<string>("");
	const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
	const [error, setError] = useState<string | null>(null);

	const handleUploadComplete = (response: UploadResponse) => {
		const newUpload: UploadedFile = {
			response,
			addedToProject: false,
		};

		// If a project is selected, add the file as a source
		if (selectedProjectId) {
			try {
				const sourceType =
					MIME_TO_SOURCE_TYPE[
						response.type as keyof typeof MIME_TO_SOURCE_TYPE
					] || "image";

				const source = addSource(selectedProjectId, {
					type: sourceType,
					reference: response.url,
					name: response.filename,
				});

				if (source) {
					newUpload.addedToProject = true;
				}
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to add file to project"
				);
			}
		}

		setUploadedFiles((prev) => [newUpload, ...prev]);
	};

	const handleUploadError = (uploadError: string) => {
		setError(uploadError);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="font-semibold text-2xl">Upload Files</h2>
				<p className="text-muted-foreground">
					Upload PDFs and images for processing
				</p>
			</div>

			{/* Project Selector */}
			<Card className="p-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
					<label
						className="whitespace-nowrap font-medium text-sm"
						htmlFor="project-select"
					>
						Add uploads to project:
					</label>
					<Select
						onValueChange={setSelectedProjectId}
						value={selectedProjectId}
					>
						<SelectTrigger className="w-full sm:w-64" id="project-select">
							<SelectValue placeholder="Select a project (optional)" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="">No project</SelectItem>
							{isHydrated &&
								projects.map((project) => (
									<SelectItem key={project.id} value={project.id}>
										{project.name}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
				</div>
				{selectedProjectId && (
					<p className="mt-2 text-muted-foreground text-sm">
						Uploaded files will be automatically added as content sources.
					</p>
				)}
			</Card>

			{/* Upload Zone */}
			<Card className="p-6">
				<UploadZone
					multiple
					onUploadComplete={handleUploadComplete}
					onUploadError={handleUploadError}
					projectId={selectedProjectId || undefined}
				/>
			</Card>

			{error && (
				<Card className="border-destructive/50 bg-destructive/5 p-4">
					<p className="text-destructive text-sm">{error}</p>
				</Card>
			)}

			{/* Supported Formats */}
			<div className="grid gap-4 sm:grid-cols-2">
				<Card className="p-4">
					<div className="flex items-start gap-3">
						<div className="rounded-md bg-muted p-2">
							<FileText className="size-5 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">PDF Documents</p>
							<p className="text-muted-foreground text-sm">
								Handwritten or typed essays, notes, and documents
							</p>
						</div>
					</div>
				</Card>
				<Card className="p-4">
					<div className="flex items-start gap-3">
						<div className="rounded-md bg-muted p-2">
							<FileImage className="size-5 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium">Images</p>
							<p className="text-muted-foreground text-sm">
								Screenshots, photos of handwritten notes
							</p>
						</div>
					</div>
				</Card>
			</div>

			{/* Recent Uploads */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Recent Uploads</h3>
				{uploadedFiles.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No files uploaded yet. Upload files to see them here.
					</p>
				) : (
					<div className="space-y-3">
						{uploadedFiles.map((upload, index) => (
							<div
								className="flex items-center justify-between rounded-lg border p-3"
								key={`${upload.response.url}-${index}`}
							>
								<div className="flex items-center gap-3">
									<div className="rounded bg-muted p-2">
										{upload.response.sourceType === "pdf" ? (
											<FileText className="size-4 text-muted-foreground" />
										) : (
											<FileImage className="size-4 text-muted-foreground" />
										)}
									</div>
									<div>
										<p className="font-medium text-sm">
											{upload.response.filename}
										</p>
										<p className="text-muted-foreground text-xs">
											{upload.response.sizeFormatted}
										</p>
									</div>
								</div>
								{upload.addedToProject && (
									<div className="flex items-center gap-1 text-green-600 text-xs">
										<CheckCircle2 className="size-4" />
										<span>Added to project</span>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</Card>
		</div>
	);
}
