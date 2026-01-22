"use client";

import {
	BookOpen,
	Clock,
	Copy,
	ExternalLink,
	Lightbulb,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GeneratedNote, NoteSection } from "@/types/generation";

// Top-level regex patterns for performance
const BULLET_REGEX = /^[-*•]\s+(.+)$/;
const HEADER_REGEX = /^###\s*/;
const BOLD_REGEX = /(\*\*[^*]+\*\*)/g;

interface RevisionNoteProps {
	/** The generated note to display */
	note: GeneratedNote;
	/** Called when regenerate is clicked */
	onRegenerate?: () => void;
	/** Called when sync is clicked */
	onSync?: () => void;
	/** Whether regeneration is in progress */
	isRegenerating?: boolean;
	/** Whether sync is in progress */
	isSyncing?: boolean;
}

/**
 * Revision Note Preview Component
 * Displays generated notes in the dual-section format:
 * - Your Notes (Concise & Revision-Ready)
 * - Topper Insights (Enriches Your Content)
 */
export function RevisionNote({
	note,
	onRegenerate,
	onSync,
	isRegenerating = false,
	isSyncing = false,
}: RevisionNoteProps) {
	const [copiedSection, setCopiedSection] = useState<string | null>(null);

	const handleCopy = useCallback(async (content: string, section: string) => {
		try {
			await navigator.clipboard.writeText(content);
			setCopiedSection(section);
			setTimeout(() => setCopiedSection(null), 2000);
		} catch {
			// Clipboard access failed
		}
	}, []);

	const renderSyncButtonContent = () => {
		if (isSyncing) {
			return (
				<>
					<RefreshCw className="size-4 animate-spin" />
					Syncing...
				</>
			);
		}

		if (note.syncStatus === "synced") {
			return (
				<>
					<ExternalLink className="size-4" />
					Synced
				</>
			);
		}

		return (
			<>
				<ExternalLink className="size-4" />
				Sync to Notion
			</>
		);
	};

	return (
		<Card className="overflow-hidden">
			{/* Header */}
			<div className="border-b bg-muted/30 p-4">
				<div className="flex items-start justify-between">
					<div>
						<h3 className="font-semibold text-lg">
							{note.mainThemeName} &gt; {note.miniThemeName}
						</h3>
						<div className="mt-1 flex items-center gap-2 text-muted-foreground text-sm">
							<Clock className="size-3.5" />
							<span>
								Generated {new Date(note.generatedAt).toLocaleDateString()}
							</span>
							<span className="text-muted-foreground/50">•</span>
							<span>v{note.version}</span>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{onRegenerate && (
							<Button
								disabled={isRegenerating}
								onClick={onRegenerate}
								size="sm"
								variant="outline"
							>
								<RefreshCw
									className={`size-4 ${isRegenerating ? "animate-spin" : ""}`}
								/>
								{isRegenerating ? "Regenerating..." : "Regenerate"}
							</Button>
						)}
						{onSync && (
							<Button
								disabled={isSyncing || note.syncStatus === "synced"}
								onClick={onSync}
								size="sm"
								variant={note.syncStatus === "synced" ? "secondary" : "default"}
							>
								{renderSyncButtonContent()}
							</Button>
						)}
					</div>
				</div>
			</div>

			{/* Your Notes Section */}
			<NoteSectionDisplay
				copiedSection={copiedSection}
				icon={<BookOpen className="size-4 text-blue-600" />}
				onCopy={handleCopy}
				section={note.yourNotes}
				sectionKey="yourNotes"
				title="Your Notes (Concise & Revision-Ready)"
				variant="user"
			/>

			{/* Divider */}
			<div className="border-y bg-muted/20 px-4 py-2">
				<div className="flex items-center gap-2 text-muted-foreground text-xs">
					<div className="h-px flex-1 bg-border" />
					<span>Topper additions below</span>
					<div className="h-px flex-1 bg-border" />
				</div>
			</div>

			{/* Topper Insights Section */}
			<NoteSectionDisplay
				copiedSection={copiedSection}
				icon={<Sparkles className="size-4 text-amber-600" />}
				onCopy={handleCopy}
				section={note.topperInsights}
				sectionKey="topperInsights"
				title="Topper Insights (Enriches Your Content)"
				variant="topper"
			/>

			{/* Cross-Theme References */}
			{note.crossThemeRefs.length > 0 && (
				<div className="border-t p-4">
					<div className="mb-3 flex items-center gap-2">
						<Lightbulb className="size-4 text-purple-600" />
						<h4 className="font-medium text-sm">
							Cross-Theme Applicable ({note.crossThemeRefs.length})
						</h4>
					</div>
					<div className="space-y-2">
						{note.crossThemeRefs.map((ref) => (
							<div
								className="rounded-md bg-purple-500/5 p-3"
								key={`cross-ref-${ref.content.slice(0, 30)}`}
							>
								<p className="text-sm">{ref.content}</p>
								<div className="mt-2 flex flex-wrap gap-1">
									{ref.applicableThemeNames.map((theme) => (
										<Badge className="text-xs" key={theme} variant="secondary">
											<span aria-hidden="true">↔️</span> {theme}
										</Badge>
									))}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Footer Stats */}
			<div className="border-t bg-muted/30 px-4 py-3">
				<div className="flex items-center justify-between text-muted-foreground text-xs">
					<div className="flex items-center gap-4">
						<span>
							Your Notes: {note.yourNotes.wordCount} words (
							{note.yourNotes.itemCount} items)
						</span>
						<span>
							Topper Insights: {note.topperInsights.wordCount} words (
							{note.topperInsights.itemCount} items)
						</span>
					</div>
					<div>
						Total: {note.yourNotes.wordCount + note.topperInsights.wordCount}{" "}
						words
					</div>
				</div>
			</div>
		</Card>
	);
}

interface NoteSectionDisplayProps {
	section: NoteSection;
	title: string;
	sectionKey: string;
	icon: React.ReactNode;
	variant: "user" | "topper";
	onCopy: (content: string, section: string) => void;
	copiedSection: string | null;
}

function NoteSectionDisplay({
	section,
	title,
	sectionKey,
	icon,
	variant,
	onCopy,
	copiedSection,
}: NoteSectionDisplayProps) {
	const bgClass = variant === "user" ? "bg-blue-500/5" : "bg-amber-500/5";
	const isCopied = copiedSection === sectionKey;

	return (
		<div className={`p-4 ${bgClass}`}>
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2">
					{icon}
					<h4 className="font-medium text-sm">{title}</h4>
				</div>
				<Button
					onClick={() => onCopy(section.content, sectionKey)}
					size="sm"
					variant="ghost"
				>
					<Copy className="size-3.5" />
					{isCopied ? "Copied!" : "Copy"}
				</Button>
			</div>

			{/* Markdown Content */}
			<div className="prose prose-sm dark:prose-invert max-w-none">
				<NoteContentRenderer content={section.content} />
			</div>
		</div>
	);
}

interface NoteContentRendererProps {
	content: string;
}

/**
 * Renders note content as formatted HTML.
 * Handles bullet points, bold text, and quotes.
 */
function NoteContentRenderer({ content }: NoteContentRendererProps) {
	const lines = content.split("\n");
	const elements: React.ReactNode[] = [];

	let currentList: string[] = [];

	const flushList = () => {
		if (currentList.length > 0) {
			elements.push(
				<ul
					className="list-disc space-y-1 pl-4"
					key={`list-${elements.length}`}
				>
					{currentList.map((item) => (
						<li className="text-sm" key={`item-${item.slice(0, 30)}`}>
							{formatInlineContent(item)}
						</li>
					))}
				</ul>
			);
			currentList = [];
		}
	};

	for (const line of lines) {
		const trimmed = line.trim();

		if (!trimmed) {
			flushList();
			continue;
		}

		// Check for bullet points
		const bulletMatch = trimmed.match(BULLET_REGEX);
		if (bulletMatch) {
			currentList.push(bulletMatch[1]);
			continue;
		}

		// Check for headers
		if (trimmed.startsWith("###")) {
			flushList();
			elements.push(
				<h4 className="mt-3 font-medium text-sm" key={`h4-${elements.length}`}>
					{trimmed.replace(HEADER_REGEX, "")}
				</h4>
			);
			continue;
		}

		// Regular paragraph
		flushList();
		elements.push(
			<p className="text-sm" key={`p-${elements.length}`}>
				{formatInlineContent(trimmed)}
			</p>
		);
	}

	flushList();

	return <>{elements}</>;
}

/**
 * Formats inline content (bold, italic, quotes).
 */
function formatInlineContent(text: string): React.ReactNode {
	// Handle bold text (**text**)
	const parts = text.split(BOLD_REGEX);

	return parts.map((part) => {
		if (part.startsWith("**") && part.endsWith("**")) {
			const content = part.slice(2, -2);
			return (
				<strong className="font-semibold" key={`bold-${content}`}>
					{content}
				</strong>
			);
		}
		return part;
	});
}

/**
 * Compact version of the revision note for list views.
 */
export function RevisionNoteCompact({
	note,
	onClick,
}: {
	note: GeneratedNote;
	onClick?: () => void;
}) {
	return (
		<Card
			className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
			onClick={onClick}
		>
			<div className="flex items-start justify-between">
				<div>
					<h4 className="font-medium">
						{note.mainThemeName} &gt; {note.miniThemeName}
					</h4>
					<p className="mt-1 text-muted-foreground text-sm">
						{note.yourNotes.wordCount + note.topperInsights.wordCount} words •{" "}
						{note.yourNotes.itemCount + note.topperInsights.itemCount} items
					</p>
				</div>
				<div className="flex items-center gap-2">
					{note.syncStatus === "synced" && (
						<Badge variant="secondary">
							<ExternalLink className="mr-1 size-3" />
							Synced
						</Badge>
					)}
					<Badge variant="outline">v{note.version}</Badge>
				</div>
			</div>
		</Card>
	);
}
