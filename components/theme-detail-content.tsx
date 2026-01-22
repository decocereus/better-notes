"use client";

import {
	AlertCircle,
	ArrowLeft,
	BookOpen,
	Layers,
	Lightbulb,
	MessageSquareQuote,
	Sparkles,
	Star,
	User,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { NoteGenerationPanel } from "@/components/note-generation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { ThemeContent } from "@/lib/classification/aggregator";
import { useSettings } from "@/lib/hooks/use-settings";
import type { ContentType, ExtractedContent } from "@/types/extraction";
import type { EssayQuestion, MainTheme, MiniTheme } from "@/types/theme";

/**
 * Content type icons.
 */
const CONTENT_TYPE_ICONS: Record<ContentType, React.ReactNode> = {
	introduction: <Sparkles className="size-4" />,
	conclusion: <Sparkles className="size-4" />,
	example: <Lightbulb className="size-4" />,
	quote: <MessageSquareQuote className="size-4" />,
	thinker: <User className="size-4" />,
	argument: <Lightbulb className="size-4" />,
	book_poem: <BookOpen className="size-4" />,
	keyword_phrase: <Star className="size-4" />,
};

/**
 * Content type labels.
 */
const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
	introduction: "Introductions",
	conclusion: "Conclusions",
	example: "Examples",
	quote: "Quotes",
	thinker: "Thinkers",
	argument: "Arguments",
	book_poem: "Books & Poems",
	keyword_phrase: "Keywords",
};

interface ThemeDetailContentProps {
	themeId: string;
}

interface ThemeData {
	mainTheme: MainTheme | null;
	miniTheme: MiniTheme | null;
	classifiedContent: ThemeContent | null;
}

/**
 * Finds a theme by ID in the theme hierarchy.
 * Returns both main theme and mini theme if the ID is a mini theme.
 */
function findThemeById(
	themes: MainTheme[],
	themeId: string
): { mainTheme: MainTheme | null; miniTheme: MiniTheme | null } {
	for (const mt of themes) {
		if (mt.id === themeId) {
			return { mainTheme: mt, miniTheme: null };
		}
		for (const mini of mt.miniThemes) {
			if (mini.id === themeId) {
				return { mainTheme: mt, miniTheme: mini };
			}
		}
	}
	return { mainTheme: null, miniTheme: null };
}

/**
 * Client component for displaying theme details and classified content.
 */
export function ThemeDetailContent({ themeId }: ThemeDetailContentProps) {
	const { settings, isHydrated } = useSettings();
	const [themeData, setThemeData] = useState<ThemeData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	/**
	 * Fetches theme and classified content data.
	 */
	const fetchThemeData = useCallback(async () => {
		if (!settings.themePageId) {
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const themesResponse = await fetch("/api/themes", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ pageId: settings.themePageId }),
			});

			if (!themesResponse.ok) {
				throw new Error("Failed to fetch themes");
			}

			const themesData = (await themesResponse.json()) as {
				themes: MainTheme[];
			};

			const { mainTheme, miniTheme } = findThemeById(
				themesData.themes,
				themeId
			);

			setThemeData({
				mainTheme,
				miniTheme,
				classifiedContent: null,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load theme");
		} finally {
			setIsLoading(false);
		}
	}, [settings.themePageId, themeId]);

	useEffect(() => {
		if (isHydrated) {
			fetchThemeData();
		}
	}, [isHydrated, fetchThemeData]);

	if (!isHydrated || isLoading) {
		return (
			<div className="flex items-center justify-center py-12">
				<LoadingSpinner />
			</div>
		);
	}

	if (!settings.themePageId) {
		return <NoThemePageState />;
	}

	if (error) {
		return <ErrorState error={error} onRetry={fetchThemeData} />;
	}

	if (!themeData?.mainTheme) {
		return <NotFoundState themeId={themeId} />;
	}

	// Determine what we're showing
	const isMainThemeView = !themeData.miniTheme;
	const displayTitle = themeData.miniTheme
		? themeData.miniTheme.title
		: themeData.mainTheme.title;
	const parentTitle = themeData.miniTheme ? themeData.mainTheme.title : null;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="font-semibold text-2xl">{displayTitle}</h2>
					{parentTitle && (
						<p className="text-muted-foreground text-sm">{parentTitle}</p>
					)}
				</div>
				<Badge variant={isMainThemeView ? "default" : "secondary"}>
					{isMainThemeView ? "Main Theme" : "Mini Theme"}
				</Badge>
			</div>

			{/* Mini Themes - Only for Main Theme view */}
			{isMainThemeView && themeData.mainTheme.miniThemes.length > 0 && (
				<Card className="p-6">
					<h3 className="mb-4 flex items-center gap-2 font-medium text-lg">
						<Layers className="size-5" />
						Mini Themes ({themeData.mainTheme.miniThemes.length})
					</h3>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{themeData.mainTheme.miniThemes.map((mini) => (
							<MiniThemeCard key={mini.id} miniTheme={mini} />
						))}
					</div>
				</Card>
			)}

			{/* Questions (PYQs) - For Mini Theme view */}
			{!isMainThemeView && themeData.miniTheme && (
				<Card className="p-6">
					<h3 className="mb-4 font-medium text-lg">
						Previous Year Questions ({themeData.miniTheme.questions.length})
					</h3>
					{themeData.miniTheme.questions.length > 0 ? (
						<div className="space-y-3">
							{themeData.miniTheme.questions.map((pyq, index) => (
								<QuestionCard key={`${pyq.year}-${index}`} question={pyq} />
							))}
						</div>
					) : (
						<p className="text-muted-foreground text-sm">
							No questions found for this mini theme.
						</p>
					)}
				</Card>
			)}

			{/* Classified Content */}
			<Card className="p-6">
				<h3 className="mb-4 flex items-center gap-2 font-medium text-lg">
					<BookOpen className="size-5" />
					Related Content
				</h3>
				{themeData.classifiedContent ? (
					<ClassifiedContentDisplay content={themeData.classifiedContent} />
				) : (
					<div className="rounded-lg border border-dashed p-8 text-center">
						<AlertCircle className="mx-auto size-8 text-muted-foreground" />
						<p className="mt-2 font-medium">No Classified Content Yet</p>
						<p className="mt-1 text-muted-foreground text-sm">
							Process your topper essays and run classification to see content
							mapped to this theme.
						</p>
						<Link href="/projects">
							<Button className="mt-4" variant="outline">
								Go to Projects
							</Button>
						</Link>
					</div>
				)}
			</Card>

			{/* Note Generation - Only for Mini Theme view with content */}
			{!isMainThemeView &&
				themeData.miniTheme &&
				themeData.classifiedContent && (
					<NoteGenerationPanel
						content={getAllContentFromThemeContent(themeData.classifiedContent)}
						mainTheme={themeData.mainTheme}
						miniTheme={themeData.miniTheme}
					/>
				)}
		</div>
	);
}

/**
 * Extracts all content items from a ThemeContent object.
 */
function getAllContentFromThemeContent(
	themeContent: ThemeContent
): ExtractedContent[] {
	const { content } = themeContent;
	return [
		...content.introductions,
		...content.conclusions,
		...content.examples,
		...content.quotes,
		...content.thinkers,
		...content.arguments,
		...content.booksPoems,
		...content.keywords,
	];
}

function NoThemePageState() {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<h2 className="font-semibold text-2xl">Theme Details</h2>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<BookOpen className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">No Theme Page Selected</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Please connect to Notion and select a theme page first.
				</p>
				<Link href="/themes">
					<Button className="mt-4" variant="outline">
						Go to Themes
					</Button>
				</Link>
			</Card>
		</div>
	);
}

interface ErrorStateProps {
	error: string;
	onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<h2 className="font-semibold text-2xl">Theme Details</h2>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-destructive/10 p-4">
					<AlertCircle className="size-8 text-destructive" />
				</div>
				<h3 className="font-medium text-lg">Failed to Load Theme</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">{error}</p>
				<Button className="mt-4" onClick={onRetry} variant="outline">
					Try Again
				</Button>
			</Card>
		</div>
	);
}

interface NotFoundStateProps {
	themeId: string;
}

function NotFoundState({ themeId }: NotFoundStateProps) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<h2 className="font-semibold text-2xl">Theme Details</h2>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<BookOpen className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Theme Not Found</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					No theme found with ID: {themeId}
				</p>
				<Link href="/themes">
					<Button className="mt-4" variant="outline">
						Back to Themes
					</Button>
				</Link>
			</Card>
		</div>
	);
}

interface MiniThemeCardProps {
	miniTheme: MiniTheme;
}

function MiniThemeCard({ miniTheme }: MiniThemeCardProps) {
	return (
		<Link href={`/themes/${miniTheme.id}`}>
			<Card className="p-4 transition-colors hover:bg-muted/50">
				<h4 className="font-medium">{miniTheme.title}</h4>
				<p className="mt-1 text-muted-foreground text-sm">
					{miniTheme.questions.length} questions
				</p>
			</Card>
		</Link>
	);
}

interface QuestionCardProps {
	question: EssayQuestion;
}

function QuestionCard({ question }: QuestionCardProps) {
	return (
		<div className="rounded-lg border p-3">
			<div className="flex items-start justify-between gap-2">
				<p className="text-sm">{question.text}</p>
				<Badge variant="outline">{question.year}</Badge>
			</div>
		</div>
	);
}

interface ClassifiedContentDisplayProps {
	content: ThemeContent;
}

function ClassifiedContentDisplay({ content }: ClassifiedContentDisplayProps) {
	const contentSections: Array<{
		key: ContentType;
		items: ExtractedContent[];
	}> = [
		{ key: "introduction", items: content.content.introductions },
		{ key: "conclusion", items: content.content.conclusions },
		{ key: "example", items: content.content.examples },
		{ key: "quote", items: content.content.quotes },
		{ key: "thinker", items: content.content.thinkers },
		{ key: "argument", items: content.content.arguments },
		{ key: "book_poem", items: content.content.booksPoems },
		{ key: "keyword_phrase", items: content.content.keywords },
	];

	return (
		<div className="space-y-4">
			{/* Stats */}
			<div className="flex flex-wrap gap-2">
				<Badge variant="secondary">{content.stats.total} items</Badge>
				<Badge variant="outline">{content.stats.bySource.topper} topper</Badge>
				<Badge variant="outline">{content.stats.bySource.user} user</Badge>
				<Badge variant="outline">
					{content.stats.byQuality.high} high quality
				</Badge>
			</div>

			{/* Content by type */}
			{contentSections.map(
				({ key, items }) =>
					items.length > 0 && (
						<ContentSection items={items} key={key} type={key} />
					)
			)}
		</div>
	);
}

interface ContentSectionProps {
	type: ContentType;
	items: ExtractedContent[];
}

function ContentSection({ type, items }: ContentSectionProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Collapsible onOpenChange={setIsOpen} open={isOpen}>
			<CollapsibleTrigger asChild>
				<button
					className="flex w-full items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
					type="button"
				>
					{CONTENT_TYPE_ICONS[type]}
					<span className="flex-1 font-medium">
						{CONTENT_TYPE_LABELS[type]}
					</span>
					<Badge variant="secondary">{items.length}</Badge>
				</button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="mt-2 space-y-2 pl-6">
					{items.slice(0, 10).map((item) => (
						<ContentItemCard item={item} key={item.id} />
					))}
					{items.length > 10 && (
						<p className="text-muted-foreground text-sm">
							+{items.length - 10} more items
						</p>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

interface ContentItemCardProps {
	item: ExtractedContent;
}

function ContentItemCard({ item }: ContentItemCardProps) {
	return (
		<div className="rounded-lg border p-3">
			<p className="line-clamp-3 text-sm">{item.content}</p>
			<div className="mt-2 flex flex-wrap items-center gap-2">
				<Badge variant={item.quality === "high" ? "default" : "secondary"}>
					{item.quality}
				</Badge>
				<Badge variant="outline">{item.sourceType}</Badge>
				{item.multiUse && (
					<Badge className="gap-1 bg-blue-500/10 text-blue-700">
						<Sparkles className="size-3" />
						Multi-use
					</Badge>
				)}
			</div>
		</div>
	);
}
