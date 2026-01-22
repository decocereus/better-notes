"use client";

import {
	AlertCircle,
	CheckCircle,
	Cloud,
	CloudOff,
	ExternalLink,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GeneratedNote, SyncResult, SyncStatus } from "@/types/generation";

interface SyncStatusDisplayProps {
	/** Current sync status */
	status: SyncStatus;
	/** When the note was last synced */
	syncedAt?: string;
	/** Notion page URL (if synced) */
	notionPageUrl?: string;
	/** Error message if sync failed */
	error?: string;
}

/**
 * Displays the current sync status of a note.
 */
export function SyncStatusDisplay({
	status,
	syncedAt,
	notionPageUrl,
	error,
}: SyncStatusDisplayProps) {
	const statusConfig = {
		not_synced: {
			icon: CloudOff,
			label: "Not synced",
			color: "text-muted-foreground",
			bgColor: "bg-muted/50",
		},
		syncing: {
			icon: Loader2,
			label: "Syncing...",
			color: "text-blue-600",
			bgColor: "bg-blue-500/10",
		},
		synced: {
			icon: CheckCircle,
			label: "Synced",
			color: "text-green-600",
			bgColor: "bg-green-500/10",
		},
		failed: {
			icon: AlertCircle,
			label: "Sync failed",
			color: "text-red-600",
			bgColor: "bg-red-500/10",
		},
	};

	const config = statusConfig[status];
	const Icon = config.icon;

	return (
		<div
			className={`flex items-center gap-2 rounded-md px-3 py-2 ${config.bgColor}`}
		>
			<Icon
				className={`size-4 ${config.color} ${status === "syncing" ? "animate-spin" : ""}`}
			/>
			<span className={`text-sm ${config.color}`}>{config.label}</span>

			{status === "synced" && syncedAt && (
				<span className="text-muted-foreground text-xs">
					• {new Date(syncedAt).toLocaleDateString()}
				</span>
			)}

			{status === "synced" && notionPageUrl && (
				<a
					className="ml-auto flex items-center gap-1 text-blue-600 text-xs hover:underline"
					href={notionPageUrl}
					rel="noopener noreferrer"
					target="_blank"
				>
					Open in Notion
					<ExternalLink className="size-3" />
				</a>
			)}

			{status === "failed" && error && (
				<span className="ml-auto text-red-600 text-xs">{error}</span>
			)}
		</div>
	);
}

interface SyncButtonProps {
	/** The note to sync */
	note: GeneratedNote;
	/** Notion page ID to sync to */
	destinationPageId: string;
	/** Called when sync completes */
	onSyncComplete?: (result: SyncResult) => void;
	/** Called when sync fails */
	onSyncError?: (error: string) => void;
}

/**
 * Button to trigger sync to Notion.
 */
export function SyncButton({
	note,
	destinationPageId,
	onSyncComplete,
	onSyncError,
}: SyncButtonProps) {
	const [isSyncing, setIsSyncing] = useState(false);

	const handleSync = useCallback(async () => {
		if (!destinationPageId) {
			onSyncError?.("No destination page configured");
			return;
		}

		setIsSyncing(true);

		try {
			const response = await fetch("/api/notion/sync", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					note,
					destinationPageId,
					mode: "append",
				}),
			});

			const data = (await response.json()) as {
				success: boolean;
				result?: SyncResult;
				error?: string;
			};

			if (data.success && data.result) {
				onSyncComplete?.(data.result);
			} else {
				onSyncError?.(data.error || "Sync failed");
			}
		} catch (error) {
			onSyncError?.(error instanceof Error ? error.message : "Sync failed");
		} finally {
			setIsSyncing(false);
		}
	}, [note, destinationPageId, onSyncComplete, onSyncError]);

	const isDisabled = isSyncing || !destinationPageId;
	const isSynced = note.syncStatus === "synced";

	const renderButtonContent = () => {
		if (isSyncing) {
			return (
				<>
					<Loader2 className="size-4 animate-spin" />
					Syncing...
				</>
			);
		}

		if (isSynced) {
			return (
				<>
					<RefreshCw className="size-4" />
					Re-sync
				</>
			);
		}

		return (
			<>
				<Cloud className="size-4" />
				Sync to Notion
			</>
		);
	};

	return (
		<Button
			disabled={isDisabled}
			onClick={handleSync}
			size="sm"
			variant={isSynced ? "secondary" : "default"}
		>
			{renderButtonContent()}
		</Button>
	);
}

interface SyncStatusBadgeProps {
	status: SyncStatus;
}

/**
 * Compact badge showing sync status.
 */
export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
	const variants: Record<
		SyncStatus,
		{
			variant: "default" | "secondary" | "destructive" | "outline";
			label: string;
		}
	> = {
		not_synced: { variant: "outline", label: "Not synced" },
		syncing: { variant: "secondary", label: "Syncing..." },
		synced: { variant: "default", label: "Synced" },
		failed: { variant: "destructive", label: "Failed" },
	};

	const config = variants[status];

	return (
		<Badge variant={config.variant}>
			{status === "syncing" && <Loader2 className="mr-1 size-3 animate-spin" />}
			{status === "synced" && <CheckCircle className="mr-1 size-3" />}
			{status === "failed" && <AlertCircle className="mr-1 size-3" />}
			{config.label}
		</Badge>
	);
}

interface BulkSyncStatusProps {
	/** Notes to show status for */
	notes: GeneratedNote[];
	/** Notion page ID to sync to */
	destinationPageId?: string;
	/** Called when bulk sync completes */
	onBulkSyncComplete?: (results: SyncResult[]) => void;
}

/**
 * Shows sync status for multiple notes with bulk sync option.
 */
export function BulkSyncStatus({
	notes,
	destinationPageId,
	onBulkSyncComplete,
}: BulkSyncStatusProps) {
	const [isSyncing, setIsSyncing] = useState(false);
	const [progress, setProgress] = useState(0);

	const syncedCount = notes.filter((n) => n.syncStatus === "synced").length;
	const notSyncedCount = notes.filter(
		(n) => n.syncStatus === "not_synced"
	).length;
	const failedCount = notes.filter((n) => n.syncStatus === "failed").length;

	const handleBulkSync = useCallback(async () => {
		if (!destinationPageId) {
			return;
		}

		const notesToSync = notes.filter((n) => n.syncStatus !== "synced");
		if (notesToSync.length === 0) {
			return;
		}

		setIsSyncing(true);
		setProgress(0);

		const results: SyncResult[] = [];

		for (let i = 0; i < notesToSync.length; i++) {
			try {
				const response = await fetch("/api/notion/sync", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						note: notesToSync[i],
						destinationPageId,
						mode: "append",
					}),
				});

				const data = (await response.json()) as {
					success: boolean;
					result?: SyncResult;
				};

				if (data.success && data.result) {
					results.push(data.result);
				}
			} catch {
				// Continue with next note
			}

			setProgress(Math.round(((i + 1) / notesToSync.length) * 100));
		}

		setIsSyncing(false);
		onBulkSyncComplete?.(results);
	}, [notes, destinationPageId, onBulkSyncComplete]);

	return (
		<Card className="p-4">
			<div className="flex items-center justify-between">
				<div>
					<h4 className="font-medium">Sync Status</h4>
					<div className="mt-1 flex items-center gap-3 text-sm">
						<span className="flex items-center gap-1 text-green-600">
							<CheckCircle className="size-3.5" />
							{syncedCount} synced
						</span>
						<span className="flex items-center gap-1 text-muted-foreground">
							<CloudOff className="size-3.5" />
							{notSyncedCount} pending
						</span>
						{failedCount > 0 && (
							<span className="flex items-center gap-1 text-red-600">
								<AlertCircle className="size-3.5" />
								{failedCount} failed
							</span>
						)}
					</div>
				</div>

				<Button
					disabled={isSyncing || !destinationPageId || notSyncedCount === 0}
					onClick={handleBulkSync}
				>
					{isSyncing ? (
						<>
							<Loader2 className="size-4 animate-spin" />
							Syncing... {progress}%
						</>
					) : (
						<>
							<Cloud className="size-4" />
							Sync All ({notSyncedCount})
						</>
					)}
				</Button>
			</div>

			{isSyncing && (
				<div className="mt-3">
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full bg-primary transition-all duration-300"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			)}
		</Card>
	);
}
