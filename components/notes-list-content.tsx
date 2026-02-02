"use client";

import {
	Cloud,
	FileText,
	Loader2,
	RefreshCw,
	Search,
	Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { RevisionNoteCompact } from "@/components/revision-note";
import { BulkSyncStatus } from "@/components/sync-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/lib/hooks/use-settings";
import type { GeneratedNote, SyncResult } from "@/types/generation";

/**
 * Client component for displaying list of generated notes.
 * Loads persisted notes from storage and renders grouped summaries.
 */
export function NotesListContent() {
	const { settings, isHydrated } = useSettings();
	const [searchQuery, setSearchQuery] = useState("");
	const [notes, setNotes] = useState<GeneratedNote[]>([]);
	const [selectedNote, setSelectedNote] = useState<GeneratedNote | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	const persistNote = useCallback(async (note: GeneratedNote) => {
		if (!note.projectId) {
			return;
		}

		try {
			await fetch("/api/notes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ note }),
			});
		} catch {
			// Ignore persistence errors in list view
		}
	}, []);

	const fetchNotes = useCallback(async () => {
		setIsLoading(true);
		setLoadError(null);

		try {
			const response = await fetch("/api/notes");
			const data = (await response.json()) as {
				success: boolean;
				notes?: GeneratedNote[];
				error?: string;
			};

			if (!(response.ok && data.success)) {
				throw new Error(data.error || "Failed to load notes");
			}

			setNotes(data.notes ?? []);
		} catch (error) {
			setLoadError(
				error instanceof Error ? error.message : "Failed to load notes"
			);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isHydrated) {
			fetchNotes();
		}
	}, [fetchNotes, isHydrated]);

	// Filter notes by search query
	const filteredNotes = notes.filter(
		(note) =>
			note.mainThemeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
			note.miniThemeName.toLowerCase().includes(searchQuery.toLowerCase())
	);

	// Group notes by main theme
	const groupedNotes = filteredNotes.reduce(
		(acc, note) => {
			const key = note.mainThemeName;
			if (!acc[key]) {
				acc[key] = [];
			}
			acc[key].push(note);
			return acc;
		},
		{} as Record<string, GeneratedNote[]>
	);

	const handleBulkSyncComplete = (results: SyncResult[]) => {
		// Update notes with sync results
		setNotes((prev) => {
			const updatedNotes = prev.map((note) => {
				const result = results.find((r) => r.noteId === note.id);
				if (result) {
					const updatedNote = {
						...note,
						syncStatus: "synced" as const,
						syncedAt: result.syncedAt,
						notionPageId: result.notionPageId,
						notionBlockIds: result.blockIds,
					};
					persistNote(updatedNote);
					return updatedNote;
				}
				return note;
			});

			return updatedNotes;
		});
	};

	if (!isHydrated) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Render notes list content
	const renderNotesContent = () => {
		if (isLoading) {
			return <LoadingState />;
		}

		if (loadError) {
			return <ErrorState error={loadError} onRetry={fetchNotes} />;
		}

		if (notes.length === 0) {
			return <EmptyState />;
		}

		if (filteredNotes.length === 0) {
			return <NoResultsState query={searchQuery} />;
		}

		return (
			<div className="space-y-6">
				{Object.entries(groupedNotes).map(([mainTheme, themeNotes]) => (
					<div key={mainTheme}>
						<h3 className="mb-3 font-medium text-lg">{mainTheme}</h3>
						<div className="space-y-2">
							{themeNotes.map((note) => (
								<RevisionNoteCompact
									key={note.id}
									note={note}
									onClick={() => setSelectedNote(note)}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-2xl">Revision Notes</h2>
					<p className="text-muted-foreground">
						Generated notes for quick exam revision
					</p>
				</div>
				<Badge variant="outline">
					<FileText className="mr-1 size-3" />
					{notes.length} notes
				</Badge>
			</div>

			{/* Search and Bulk Actions */}
			{notes.length > 0 && (
				<div className="flex items-center gap-4">
					<div className="relative flex-1">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="pl-9"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search by theme..."
							value={searchQuery}
						/>
					</div>
				</div>
			)}

			{/* Bulk Sync Status */}
			{notes.length > 0 && settings.outputPageId && (
				<BulkSyncStatus
					destinationPageId={settings.outputPageId}
					notes={notes}
					onBulkSyncComplete={handleBulkSyncComplete}
				/>
			)}

			{/* Notes List */}
			{renderNotesContent()}

			{/* Stats Footer */}
			{notes.length > 0 && <NotesStats notes={notes} />}

			{/* Selected note debug - would show modal in real implementation */}
			{selectedNote && (
				<div className="sr-only">Selected: {selectedNote.id}</div>
			)}
		</div>
	);
}

function EmptyState() {
	return (
		<Card className="flex flex-col items-center justify-center p-12 text-center">
			<div className="mb-4 rounded-full bg-primary/10 p-4">
				<Sparkles className="size-8 text-primary" />
			</div>
			<h3 className="font-medium text-lg">No Notes Generated Yet</h3>
			<p className="mt-1 max-w-md text-muted-foreground text-sm">
				Visit a mini theme page and click "Generate Notes" to create your first
				revision-ready notes. Notes will appear here after generation.
			</p>
			<Button asChild className="mt-4" variant="outline">
				<a href="/themes">Browse Themes</a>
			</Button>
		</Card>
	);
}

function LoadingState() {
	return (
		<div className="flex items-center justify-center py-12">
			<Loader2 className="size-8 animate-spin text-muted-foreground" />
		</div>
	);
}

function ErrorState({
	error,
	onRetry,
}: {
	error: string;
	onRetry: () => void;
}) {
	return (
		<Card className="flex flex-col items-center justify-center gap-3 p-8 text-center">
			<p className="text-muted-foreground text-sm">{error}</p>
			<Button onClick={onRetry} size="sm" variant="outline">
				<RefreshCw className="mr-2 size-4" />
				Retry
			</Button>
		</Card>
	);
}

function NoResultsState({ query }: { query: string }) {
	return (
		<Card className="flex flex-col items-center justify-center p-12 text-center">
			<div className="mb-4 rounded-full bg-muted p-4">
				<Search className="size-8 text-muted-foreground" />
			</div>
			<h3 className="font-medium text-lg">No Notes Found</h3>
			<p className="mt-1 text-muted-foreground text-sm">
				No notes match "{query}". Try a different search term.
			</p>
		</Card>
	);
}

function NotesStats({ notes }: { notes: GeneratedNote[] }) {
	const totalWords = notes.reduce(
		(sum, n) => sum + n.yourNotes.wordCount + n.topperInsights.wordCount,
		0
	);
	const syncedCount = notes.filter((n) => n.syncStatus === "synced").length;
	const mainThemes = new Set(notes.map((n) => n.mainThemeId)).size;

	return (
		<Card className="p-4">
			<div className="flex items-center justify-between text-sm">
				<div className="flex items-center gap-6">
					<span className="text-muted-foreground">
						<FileText className="mr-1 inline size-4" />
						{notes.length} notes
					</span>
					<span className="text-muted-foreground">
						{totalWords.toLocaleString()} total words
					</span>
					<span className="text-muted-foreground">
						{mainThemes} themes covered
					</span>
				</div>
				<div className="flex items-center gap-2">
					<Cloud className="size-4 text-green-600" />
					<span className="text-green-600">
						{syncedCount}/{notes.length} synced
					</span>
				</div>
			</div>
		</Card>
	);
}
