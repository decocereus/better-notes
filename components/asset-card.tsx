"use client";

import {
	FileIcon,
	FileText,
	ImageIcon,
	MoreHorizontal,
	Pencil,
	Play,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatFileSize } from "@/lib/constants/upload";
import type { Asset } from "@/types/asset";
import { isProcessing } from "@/types/asset";
import { ProcessingStatusBadge } from "./processing-status-badge";

interface AssetCardProps {
	asset: Asset;
	projectName?: string;
	onView?: () => void;
	onAssign?: () => void;
	onProcess?: () => void;
	onDelete?: () => void;
}

export function AssetCard({
	asset,
	projectName,
	onView,
	onAssign,
	onProcess,
	onDelete,
}: AssetCardProps) {
	const [isDeleting, setIsDeleting] = useState(false);

	const handleDelete = async () => {
		if (isDeleting) {
			return;
		}
		setIsDeleting(true);
		try {
			await onDelete?.();
		} finally {
			setIsDeleting(false);
		}
	};

	const canProcess =
		asset.sourceType === "pdf" &&
		(asset.processingStatus === "pending" ||
			asset.processingStatus === "ocr_failed" ||
			asset.processingStatus === "extraction_failed");

	const processing = isProcessing(asset.processingStatus);

	return (
		<Card className="group transition-shadow hover:shadow-md">
			<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
				<div className="flex items-start gap-3">
					<div className="flex size-10 items-center justify-center rounded-lg bg-muted">
						{asset.sourceType === "pdf" ? (
							<FileText className="size-5 text-red-500" />
						) : (
							<ImageIcon className="size-5 text-blue-500" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<CardTitle className="truncate text-sm">{asset.filename}</CardTitle>
						<CardDescription className="text-xs">
							{formatFileSize(asset.size)} &middot;{" "}
							{new Date(asset.uploadedAt).toLocaleDateString()}
						</CardDescription>
					</div>
				</div>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="size-8 opacity-0 group-hover:opacity-100"
							size="icon"
							variant="ghost"
						>
							<MoreHorizontal className="size-4" />
							<span className="sr-only">Open menu</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						{onView && (
							<DropdownMenuItem onClick={onView}>
								<FileIcon className="mr-2 size-4" />
								View Details
							</DropdownMenuItem>
						)}
						{onAssign && (
							<DropdownMenuItem onClick={onAssign}>
								<Pencil className="mr-2 size-4" />
								{asset.projectId ? "Reassign" : "Assign to Project"}
							</DropdownMenuItem>
						)}
						{canProcess && onProcess && (
							<DropdownMenuItem onClick={onProcess}>
								<Play className="mr-2 size-4" />
								Process (OCR + Extract)
							</DropdownMenuItem>
						)}
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							disabled={isDeleting || processing}
							onClick={handleDelete}
						>
							<Trash2 className="mr-2 size-4" />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</CardHeader>

			<CardContent className="space-y-3">
				<div className="flex flex-wrap items-center gap-2">
					<ProcessingStatusBadge status={asset.processingStatus} />

					{asset.projectId ? (
						<Badge className="truncate" variant="secondary">
							{projectName || "Project"}
						</Badge>
					) : (
						<Badge className="text-muted-foreground" variant="outline">
							Unassigned
						</Badge>
					)}
				</div>

				{asset.ocrWordCount !== undefined && (
					<p className="text-muted-foreground text-xs">
						{asset.ocrWordCount.toLocaleString()} words
					</p>
				)}

				{asset.extractedItemCount !== undefined && (
					<p className="text-muted-foreground text-xs">
						{asset.extractedItemCount} items extracted
					</p>
				)}

				{asset.lastError && (
					<div className="space-y-2">
						<p
							className="truncate text-destructive text-xs"
							title={asset.lastError}
						>
							Error: {asset.lastError}
						</p>
						{canProcess && onProcess && (
							<Button
								className="h-7 text-xs"
								onClick={onProcess}
								size="sm"
								variant="outline"
							>
								<Play className="mr-1 size-3" />
								Retry Processing
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
