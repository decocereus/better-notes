"use client";

import { FileIcon, Loader2, Upload, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useState } from "react";
import type { UploadResponse } from "@/app/api/upload/route";
import { Button } from "@/components/ui/button";
import {
	ALLOWED_FILE_TYPES_DISPLAY,
	formatFileSize,
	isAllowedMimeType,
	MAX_FILE_SIZE_BYTES,
	MAX_FILE_SIZE_DISPLAY,
} from "@/lib/constants/upload";

interface UploadZoneProps {
	projectId?: string;
	onUploadComplete?: (response: UploadResponse) => void;
	onUploadError?: (error: string) => void;
	disabled?: boolean;
	multiple?: boolean;
}

interface FileWithPreview {
	file: File;
	preview?: string;
	status: "pending" | "uploading" | "completed" | "error";
	error?: string;
	response?: UploadResponse;
}

function validateFile(file: File): string | null {
	if (!isAllowedMimeType(file.type)) {
		return `Invalid file type. Allowed: ${ALLOWED_FILE_TYPES_DISPLAY}`;
	}
	if (file.size > MAX_FILE_SIZE_BYTES) {
		return `File too large (${formatFileSize(file.size)}). Max: ${MAX_FILE_SIZE_DISPLAY}`;
	}
	if (file.size === 0) {
		return "File is empty";
	}
	return null;
}

function createFileWithPreview(file: File): FileWithPreview {
	const validationError = validateFile(file);
	const preview = file.type.startsWith("image/")
		? URL.createObjectURL(file)
		: undefined;

	return {
		file,
		preview,
		status: validationError ? "error" : "pending",
		error: validationError ?? undefined,
	};
}

function cleanupPreviews(files: FileWithPreview[]): void {
	for (const f of files) {
		if (f.preview) {
			URL.revokeObjectURL(f.preview);
		}
	}
}

function getFileItemClassName(status: FileWithPreview["status"]): string {
	if (status === "error") {
		return "flex items-center gap-3 rounded-lg border p-3 border-destructive/50 bg-destructive/5";
	}
	if (status === "completed") {
		return "flex items-center gap-3 rounded-lg border p-3 border-green-500/50 bg-green-500/5";
	}
	return "flex items-center gap-3 rounded-lg border p-3 border-border";
}

export function UploadZone({
	projectId,
	onUploadComplete,
	onUploadError,
	disabled = false,
	multiple = false,
}: UploadZoneProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [files, setFiles] = useState<FileWithPreview[]>([]);

	const uploadFile = useCallback(
		async (fileWithPreview: FileWithPreview, index: number) => {
			const { file } = fileWithPreview;

			setFiles((prev) =>
				prev.map((f, i) => (i === index ? { ...f, status: "uploading" } : f))
			);

			try {
				const formData = new FormData();
				formData.append("file", file);
				if (projectId) {
					formData.append("projectId", projectId);
				}

				const response = await fetch("/api/upload", {
					method: "POST",
					body: formData,
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Upload failed");
				}

				const data = (await response.json()) as UploadResponse;

				setFiles((prev) =>
					prev.map((f, i) =>
						i === index ? { ...f, status: "completed", response: data } : f
					)
				);

				onUploadComplete?.(data);
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Upload failed";

				setFiles((prev) =>
					prev.map((f, i) =>
						i === index ? { ...f, status: "error", error: errorMessage } : f
					)
				);

				onUploadError?.(errorMessage);
			}
		},
		[projectId, onUploadComplete, onUploadError]
	);

	const processFiles = useCallback(
		(fileList: FileList | File[]) => {
			const filesToProcess = multiple
				? Array.from(fileList)
				: [fileList[0]].filter(Boolean);

			const newFiles = filesToProcess.map(createFileWithPreview);

			if (multiple) {
				setFiles((prev) => [...prev, ...newFiles]);
			} else {
				cleanupPreviews(files);
				setFiles(newFiles);
			}

			const startIndex = multiple ? files.length : 0;
			const validFiles = newFiles.filter((f) => f.status === "pending");

			for (const fileWithPreview of validFiles) {
				const fileIndex = startIndex + newFiles.indexOf(fileWithPreview);
				uploadFile(fileWithPreview, fileIndex);
			}
		},
		[files, multiple, uploadFile]
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			if (!disabled) {
				setIsDragging(true);
			}
		},
		[disabled]
	);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);

			if (disabled) {
				return;
			}

			const { files: droppedFiles } = e.dataTransfer;
			if (droppedFiles.length > 0) {
				processFiles(droppedFiles);
			}
		},
		[disabled, processFiles]
	);

	const handleFileSelect = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const { files: selectedFiles } = e.target;
			if (selectedFiles && selectedFiles.length > 0) {
				processFiles(selectedFiles);
			}
			e.target.value = "";
		},
		[processFiles]
	);

	const removeFile = useCallback((index: number) => {
		setFiles((prev) => {
			const file = prev[index];
			if (file?.preview) {
				URL.revokeObjectURL(file.preview);
			}
			return prev.filter((_, i) => i !== index);
		});
	}, []);

	const hasFiles = files.length > 0;
	const isUploading = files.some((f) => f.status === "uploading");

	const dropZoneClassName = `relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
		isDragging
			? "border-primary bg-primary/5"
			: "border-muted-foreground/25 hover:border-muted-foreground/50"
	} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`;

	return (
		<div className="space-y-4">
			{/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/noNoninteractiveElementInteractions: Drop zone requires drag events for file upload functionality */}
			<div
				className={dropZoneClassName}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				<label className="absolute inset-0 cursor-pointer">
					<span className="sr-only">Choose files to upload</span>
					<input
						accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
						className="absolute inset-0 cursor-pointer opacity-0"
						disabled={disabled || isUploading}
						multiple={multiple}
						onChange={handleFileSelect}
						type="file"
					/>
				</label>

				<Upload
					className={`mb-4 size-10 ${isDragging ? "text-primary" : "text-muted-foreground"}`}
				/>
				<p className="font-medium">
					{isDragging ? "Drop files here" : "Drag & drop files here"}
				</p>
				<p className="mt-1 text-muted-foreground text-sm">or click to browse</p>
				<p className="mt-2 text-muted-foreground text-xs">
					{ALLOWED_FILE_TYPES_DISPLAY} • Max {MAX_FILE_SIZE_DISPLAY}
				</p>
			</div>

			{hasFiles && (
				<div className="space-y-2">
					{files.map((fileWithPreview, index) => (
						<FileItem
							fileWithPreview={fileWithPreview}
							key={`${fileWithPreview.file.name}-${index}`}
							onRemove={() => removeFile(index)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface FileItemProps {
	fileWithPreview: FileWithPreview;
	onRemove: () => void;
}

function FileItem({ fileWithPreview, onRemove }: FileItemProps) {
	const { file, preview, status, error, response } = fileWithPreview;
	const isImage = file.type.startsWith("image/");

	return (
		<div className={getFileItemClassName(status)}>
			<div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
				{isImage && preview ? (
					<Image
						alt={file.name}
						className="size-full object-cover"
						height={48}
						src={preview}
						unoptimized
						width={48}
					/>
				) : (
					<FileIcon className="size-6 text-muted-foreground" />
				)}
			</div>

			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">{file.name}</p>
				<p className="text-muted-foreground text-xs">
					{formatFileSize(file.size)}
					{status === "completed" && response && " • Uploaded"}
					{status === "uploading" && " • Uploading..."}
				</p>
				{error && <p className="text-destructive text-xs">{error}</p>}
			</div>

			<div className="shrink-0">
				{status === "uploading" ? (
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				) : (
					<Button
						className="size-8"
						onClick={onRemove}
						size="icon"
						variant="ghost"
					>
						<X className="size-4" />
						<span className="sr-only">Remove file</span>
					</Button>
				)}
			</div>
		</div>
	);
}
