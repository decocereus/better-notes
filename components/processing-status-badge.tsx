"use client";

import {
	AlertCircle,
	CheckCircle2,
	Clock,
	FileSearch,
	Loader2,
	Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AssetProcessingStatus } from "@/types/asset";
import {
	getStatusLabel,
	isCompleted,
	isFailed,
	isProcessing,
} from "@/types/asset";

interface ProcessingStatusBadgeProps {
	status: AssetProcessingStatus;
	className?: string;
	showLabel?: boolean;
}

const STATUS_CONFIG: Record<
	AssetProcessingStatus,
	{ icon: typeof Clock; color: string; bgColor: string }
> = {
	pending: {
		icon: Clock,
		color: "text-muted-foreground",
		bgColor: "bg-muted",
	},
	ocr_queued: {
		icon: Clock,
		color: "text-blue-600",
		bgColor: "bg-blue-50 dark:bg-blue-950",
	},
	ocr_processing: {
		icon: FileSearch,
		color: "text-blue-600",
		bgColor: "bg-blue-50 dark:bg-blue-950",
	},
	ocr_completed: {
		icon: CheckCircle2,
		color: "text-blue-600",
		bgColor: "bg-blue-50 dark:bg-blue-950",
	},
	ocr_failed: {
		icon: AlertCircle,
		color: "text-destructive",
		bgColor: "bg-destructive/10",
	},
	extraction_queued: {
		icon: Clock,
		color: "text-purple-600",
		bgColor: "bg-purple-50 dark:bg-purple-950",
	},
	extraction_processing: {
		icon: Sparkles,
		color: "text-purple-600",
		bgColor: "bg-purple-50 dark:bg-purple-950",
	},
	extraction_completed: {
		icon: CheckCircle2,
		color: "text-green-600",
		bgColor: "bg-green-50 dark:bg-green-950",
	},
	extraction_failed: {
		icon: AlertCircle,
		color: "text-destructive",
		bgColor: "bg-destructive/10",
	},
};

export function ProcessingStatusBadge({
	status,
	className,
	showLabel = true,
}: ProcessingStatusBadgeProps) {
	const config = STATUS_CONFIG[status];
	const Icon = config.icon;
	const processing = isProcessing(status);

	return (
		<div
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs",
				config.bgColor,
				config.color,
				className
			)}
		>
			{processing ? (
				<Loader2 className="size-3 animate-spin" />
			) : (
				<Icon className="size-3" />
			)}
			{showLabel && <span>{getStatusLabel(status)}</span>}
		</div>
	);
}

export function ProcessingStatusDot({
	status,
	className,
}: {
	status: AssetProcessingStatus;
	className?: string;
}) {
	const processing = isProcessing(status);
	const failed = isFailed(status);
	const completed = isCompleted(status);

	return (
		<span
			className={cn(
				"inline-block size-2 rounded-full",
				processing && "animate-pulse bg-blue-500",
				failed && "bg-destructive",
				completed && "bg-green-500",
				!(processing || failed || completed) && "bg-muted-foreground",
				className
			)}
		/>
	);
}
