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
	Trash2,
	Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ContentSource } from "@/types/project";

interface SourceListProps {
	sources: ContentSource[];
	onDelete?: (sourceId: string) => void;
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

export function SourceList({ sources, onDelete }: SourceListProps) {
	if (sources.length === 0) {
		return null;
	}

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	};

	return (
		<div className="space-y-3">
			{sources.map((source) => {
				const SourceIcon = SOURCE_ICONS[source.type];
				const statusConfig = STATUS_CONFIG[source.status];
				const StatusIcon = statusConfig.icon;

				return (
					<Card className="p-4" key={source.id}>
						<div className="flex items-start justify-between gap-4">
							<div className="flex items-start gap-3">
								<div className="mt-0.5 rounded-md bg-muted p-2">
									<SourceIcon className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">{source.name}</p>
									<p className="truncate text-muted-foreground text-sm">
										{source.reference}
									</p>
									<div className="mt-2 flex items-center gap-2 text-muted-foreground text-xs">
										<Badge className="gap-1" variant={statusConfig.variant}>
											<StatusIcon
												className={`size-3 ${statusConfig.animate ? "animate-spin" : ""}`}
											/>
											{statusConfig.label}
										</Badge>
										<span>Added {formatDate(source.addedAt)}</span>
									</div>
									{source.status === "failed" && source.error && (
										<p className="mt-1 text-destructive text-xs">
											{source.error}
										</p>
									)}
								</div>
							</div>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button size="icon" variant="ghost">
										<MoreVertical className="size-4" />
										<span className="sr-only">More options</span>
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{source.type === "notion" && (
										<DropdownMenuItem asChild>
											<a
												href={source.reference}
												rel="noopener noreferrer"
												target="_blank"
											>
												<ExternalLink className="size-4" />
												Open in Notion
											</a>
										</DropdownMenuItem>
									)}
									<DropdownMenuItem
										className="text-destructive focus:text-destructive"
										onClick={() => onDelete?.(source.id)}
									>
										<Trash2 className="size-4" />
										Remove
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</Card>
				);
			})}
		</div>
	);
}
