"use client";

import { FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { RevisionNote } from "@/components/revision-note";
import { SyncButton, SyncStatusBadge } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSettings } from "@/lib/hooks/use-settings";
import type { ExtractedContent } from "@/types/extraction";
import type { GeneratedNote, SyncResult } from "@/types/generation";
import type { MainTheme, MiniTheme } from "@/types/theme";

interface NoteGenerationPanelProps {
	/** Main theme for generation */
	mainTheme: MainTheme;
	/** Mini theme for generation */
	miniTheme: MiniTheme;
	/** Content to generate notes from */
	content: ExtractedContent[];
	/** Existing generated note (if any) */
	existingNote?: GeneratedNote | null;
	/** Called when note is generated */
	onNoteGenerated?: (note: GeneratedNote) => void;
	/** Called when note is synced */
	onNoteSynced?: (note: GeneratedNote) => void;
}

/**
 * Panel for generating and managing revision notes for a theme.
 */
export function NoteGenerationPanel({
	mainTheme,
	miniTheme,
	content,
	existingNote,
	onNoteGenerated,
	onNoteSynced,
}: NoteGenerationPanelProps) {
	const { settings } = useSettings();
	const [note, setNote] = useState<GeneratedNote | null>(existingNote || null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleGenerate = useCallback(async () => {
		if (content.length === 0) {
			setError("No content available for this theme");
			return;
		}

		setIsGenerating(true);
		setError(null);

		try {
			const response = await fetch("/api/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					mainTheme,
					miniTheme,
					content,
					enforceConciseness: true,
				}),
			});

			const data = (await response.json()) as {
				success: boolean;
				note?: GeneratedNote;
				error?: string;
			};

			if (data.success && data.note) {
				setNote(data.note);
				onNoteGenerated?.(data.note);
			} else {
				setError(data.error || "Generation failed");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Generation failed");
		} finally {
			setIsGenerating(false);
		}
	}, [mainTheme, miniTheme, content, onNoteGenerated]);

	const handleSyncComplete = useCallback(
		(result: SyncResult) => {
			if (note) {
				const updatedNote: GeneratedNote = {
					...note,
					syncStatus: "synced",
					syncedAt: result.syncedAt,
					notionPageId: result.notionPageId,
					notionBlockIds: result.blockIds,
				};
				setNote(updatedNote);
				onNoteSynced?.(updatedNote);
			}
		},
		[note, onNoteSynced]
	);

	const handleSyncError = useCallback(
		(errorMessage: string) => {
			if (note) {
				const updatedNote: GeneratedNote = {
					...note,
					syncStatus: "failed",
					error: errorMessage,
				};
				setNote(updatedNote);
			}
		},
		[note]
	);

	const userContentCount = content.filter(
		(c) => c.sourceType === "user"
	).length;
	const topperContentCount = content.filter(
		(c) => c.sourceType === "topper"
	).length;

	// No content state
	if (content.length === 0) {
		return (
			<Card className="p-6">
				<div className="flex items-start gap-4">
					<div className="rounded-full bg-muted p-3">
						<FileText className="size-6 text-muted-foreground" />
					</div>
					<div className="flex-1">
						<h3 className="font-medium text-lg">Revision Notes</h3>
						<p className="mt-1 text-muted-foreground text-sm">
							No content classified for this theme yet. Process your essays and
							run classification first.
						</p>
					</div>
				</div>
			</Card>
		);
	}

	// No note generated yet
	if (!note) {
		return (
			<Card className="p-6">
				<div className="flex items-start justify-between gap-4">
					<div className="flex items-start gap-4">
						<div className="rounded-full bg-primary/10 p-3">
							<Sparkles className="size-6 text-primary" />
						</div>
						<div>
							<h3 className="font-medium text-lg">Generate Revision Notes</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								Create concise, exam-ready notes from your content and topper
								insights.
							</p>
							<div className="mt-3 flex items-center gap-2">
								<Badge variant="secondary">{userContentCount} user items</Badge>
								<Badge variant="outline">
									{topperContentCount} topper items
								</Badge>
							</div>
						</div>
					</div>
					<Button disabled={isGenerating} onClick={handleGenerate}>
						{isGenerating ? (
							<>
								<Loader2 className="size-4 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Sparkles className="size-4" />
								Generate Notes
							</>
						)}
					</Button>
				</div>

				{error && (
					<div className="mt-4 rounded-md bg-red-500/10 p-3">
						<p className="text-red-700 text-sm dark:text-red-300">{error}</p>
					</div>
				)}
			</Card>
		);
	}

	// Note exists - show preview with actions
	return (
		<div className="space-y-4">
			{/* Header with actions */}
			<Card className="p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Sparkles className="size-5 text-primary" />
						<h3 className="font-medium">Revision Notes</h3>
						<SyncStatusBadge status={note.syncStatus} />
					</div>
					<div className="flex items-center gap-2">
						<Button
							disabled={isGenerating}
							onClick={handleGenerate}
							size="sm"
							variant="outline"
						>
							{isGenerating ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<RefreshCw className="size-4" />
							)}
							Regenerate
						</Button>
						{settings.outputPageId && (
							<SyncButton
								destinationPageId={settings.outputPageId}
								note={note}
								onSyncComplete={handleSyncComplete}
								onSyncError={handleSyncError}
							/>
						)}
					</div>
				</div>
			</Card>

			{/* Note preview */}
			<RevisionNote
				isRegenerating={isGenerating}
				note={note}
				onRegenerate={handleGenerate}
			/>

			{error && (
				<div className="rounded-md bg-red-500/10 p-3">
					<p className="text-red-700 text-sm dark:text-red-300">{error}</p>
				</div>
			)}
		</div>
	);
}

/**
 * Compact generation trigger for list views.
 */
export function NoteGenerationTrigger({
	hasContent,
	hasNote,
	onClick,
}: {
	hasContent: boolean;
	hasNote: boolean;
	onClick: () => void;
}) {
	if (!hasContent) {
		return (
			<Badge className="text-muted-foreground" variant="outline">
				No content
			</Badge>
		);
	}

	if (hasNote) {
		return (
			<Button onClick={onClick} size="sm" variant="secondary">
				<FileText className="size-4" />
				View Notes
			</Button>
		);
	}

	return (
		<Button onClick={onClick} size="sm" variant="outline">
			<Sparkles className="size-4" />
			Generate
		</Button>
	);
}
