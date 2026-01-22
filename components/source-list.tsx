"use client";

import {
	AlertCircle,
	CheckCircle,
	Clock,
	ExternalLink,
	FileText,
	Image as ImageIcon,
	Loader2,
	MoreVertical,
	Play,
	RefreshCw,
	Trash2,
	Type,
} from "lucide-react";
import { useState } from "react";
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
import type { ContentSource } from "@/types/project";

interface SourceListProps {
	sources: ContentSource[];
	projectId: string;
	onDelete?: (sourceId: string) => void;
	onStatusChange?: () => void;
}

const SOURCE_ICONS = {
	notion: ExternalLink,
	pdf: FileText,
	image: ImageIcon,
	text: Type,
} as const;

const STATUS_CONFIG = {
	pending: {
		icon: Clock,
		label: "Pending",
		variant: "secondary" as const,
		animate: false,
	},
	processing: {
		icon: Loader2,
		label: "Processing",
		variant: "default" as const,
		animate: true,
	},
	completed: {
		icon: CheckCircle,
		label: "Completed",
		variant: "secondary" as const,
		animate: false,
	},
	failed: {
		icon: AlertCircle,
		label: "Failed",
		variant: "destructive" as const,
		animate: false,
	},
};

function getNotionUrl(reference: string): string {
	if (reference.startsWith("http")) {
		return reference;
	}
	const cleanId = reference.replace(/-/g, "");
	return `https://notion.so/${cleanId}`;
}

function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function ProcessButton({
	source,
	isProcessing,
	onProcess,
}: {
	source: ContentSource;
	isProcessing: boolean;
	onProcess: () => void;
}) {
	const getIcon = () => {
		if (isProcessing) {
			return <Loader2 className="size-4 animate-spin" />;
		}
		if (source.status === "failed") {
			return <RefreshCw className="size-4" />;
		}
		return <Play className="size-4" />;
	};

	return (
		<Button
			disabled={isProcessing}
			onClick={onProcess}
			size="sm"
			variant="outline"
		>
			{getIcon()}
			{source.status === "failed" ? "Retry" : "Process"}
		</Button>
	);
}

interface SourceItemProps {
	source: ContentSource;
	projectId: string;
	isProcessing: boolean;
	onProcess: () => void;
	onDelete: () => void;
}

function SourceItem({
	source,
	isProcessing,
	onProcess,
	onDelete,
}: SourceItemProps) {
	const SourceIcon = SOURCE_ICONS[source.type];
	const statusConfig = isProcessing
		? STATUS_CONFIG.processing
		: STATUS_CONFIG[source.status];
	const StatusIcon = statusConfig.icon;
	const canProcess =
		source.type === "notion" &&
		(source.status === "pending" || source.status === "failed");

	return (
		<Card className="p-4">
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-start gap-3">
					<div className="mt-0.5 rounded-md bg-muted p-2">
						<SourceIcon className="size-4 text-muted-foreground" />
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate font-medium">{source.name}</p>
						<p className="max-w-xs truncate text-muted-foreground text-sm">
							{source.type === "notion"
								? `Page ID: ${source.reference.slice(0, 8)}...`
								: source.reference}
						</p>
						<div className="mt-2 flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
							<Badge className="gap-1" variant={statusConfig.variant}>
								<StatusIcon
									className={`size-3 ${statusConfig.animate || isProcessing ? "animate-spin" : ""}`}
								/>
								{isProcessing ? "Processing" : statusConfig.label}
							</Badge>
							<span>Added {formatDate(source.addedAt)}</span>
						</div>
						{source.status === "failed" && source.error && (
							<p className="mt-1 text-destructive text-xs">{source.error}</p>
						)}
						{source.status === "completed" && source.metadata?.content && (
							<p className="mt-1 text-muted-foreground text-xs">
								{(source.metadata.content as string).length.toLocaleString()}{" "}
								characters extracted
							</p>
						)}
					</div>
				</div>

				<div className="flex items-center gap-2">
					{canProcess && (
						<ProcessButton
							isProcessing={isProcessing}
							onProcess={onProcess}
							source={source}
						/>
					)}

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button size="icon" variant="ghost">
								<MoreVertical className="size-4" />
								<span className="sr-only">More options</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{source.type === "notion" && (
								<>
									<DropdownMenuItem asChild>
										<a
											href={getNotionUrl(source.reference)}
											rel="noopener noreferrer"
											target="_blank"
										>
											<ExternalLink className="size-4" />
											Open in Notion
										</a>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
								</>
							)}
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={onDelete}
							>
								<Trash2 className="size-4" />
								Remove
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</Card>
	);
}

export function SourceList({
	sources,
	projectId,
	onDelete,
	onStatusChange,
}: SourceListProps) {
	const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

	if (sources.length === 0) {
		return null;
	}

	const handleProcess = async (source: ContentSource) => {
		if (processingIds.has(source.id)) {
			return;
		}

		setProcessingIds((prev) => new Set([...prev, source.id]));

		try {
			const response = await fetch("/api/sources/process", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					projectId,
					pageId: source.reference,
					type: source.type,
				}),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? "Failed to process source");
			}

			onStatusChange?.();
		} catch (error) {
			console.error("Failed to process source:", error);
		} finally {
			setProcessingIds((prev) => {
				const next = new Set(prev);
				next.delete(source.id);
				return next;
			});
		}
	};

	return (
		<div className="space-y-3">
			{sources.map((source) => (
				<SourceItem
					isProcessing={
						processingIds.has(source.id) || source.status === "processing"
					}
					key={source.id}
					onDelete={() => onDelete?.(source.id)}
					onProcess={() => handleProcess(source)}
					projectId={projectId}
					source={source}
				/>
			))}
		</div>
	);
}
