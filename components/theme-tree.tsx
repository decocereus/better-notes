"use client";

import {
	ChevronDown,
	ChevronRight,
	FileText,
	Folder,
	Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { EssayQuestion, MainTheme, MiniTheme } from "@/types";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";

interface ThemeTreeProps {
	themes: MainTheme[];
	onSelectTheme?: (theme: MainTheme) => void;
	onSelectMiniTheme?: (miniTheme: MiniTheme, parentTheme: MainTheme) => void;
	onSelectQuestion?: (
		question: EssayQuestion,
		miniTheme: MiniTheme,
		mainTheme: MainTheme
	) => void;
}

/**
 * Collapsible tree view for displaying theme hierarchy.
 * Supports search/filter and selection callbacks.
 */
export function ThemeTree({
	themes,
	onSelectTheme,
	onSelectMiniTheme,
	onSelectQuestion,
}: ThemeTreeProps) {
	const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
	const [expandedMiniThemes, setExpandedMiniThemes] = useState<Set<string>>(
		new Set()
	);
	const [searchQuery, setSearchQuery] = useState("");

	// Filter themes based on search query
	const filteredThemes = useMemo(() => {
		if (!searchQuery.trim()) {
			return themes;
		}

		const query = searchQuery.toLowerCase();

		return themes
			.map((mainTheme) => {
				// Check if main theme matches
				const mainThemeMatches = mainTheme.title.toLowerCase().includes(query);

				// Filter mini themes
				const filteredMiniThemes = mainTheme.miniThemes
					.map((miniTheme) => {
						// Check if mini theme matches
						const miniThemeMatches = miniTheme.title
							.toLowerCase()
							.includes(query);

						// Filter questions
						const filteredQuestions = miniTheme.questions.filter(
							(q) =>
								q.text.toLowerCase().includes(query) ||
								q.year.toString().includes(query)
						);

						// Keep mini theme if it matches or has matching questions
						if (miniThemeMatches || filteredQuestions.length > 0) {
							return {
								...miniTheme,
								questions: miniThemeMatches
									? miniTheme.questions
									: filteredQuestions,
							};
						}
						return null;
					})
					.filter((mt): mt is MiniTheme => mt !== null);

				// Keep main theme if it matches or has matching mini themes
				if (mainThemeMatches || filteredMiniThemes.length > 0) {
					return {
						...mainTheme,
						miniThemes: mainThemeMatches
							? mainTheme.miniThemes
							: filteredMiniThemes,
					};
				}
				return null;
			})
			.filter((mt): mt is MainTheme => mt !== null);
	}, [themes, searchQuery]);

	// Auto-expand all when searching
	const effectiveExpandedThemes = useMemo(() => {
		if (searchQuery.trim()) {
			return new Set(filteredThemes.map((t) => t.id));
		}
		return expandedThemes;
	}, [searchQuery, filteredThemes, expandedThemes]);

	const effectiveExpandedMiniThemes = useMemo(() => {
		if (searchQuery.trim()) {
			return new Set(
				filteredThemes.flatMap((t) => t.miniThemes.map((mt) => mt.id))
			);
		}
		return expandedMiniThemes;
	}, [searchQuery, filteredThemes, expandedMiniThemes]);

	const toggleTheme = useCallback((themeId: string) => {
		setExpandedThemes((prev) => {
			const next = new Set(prev);
			if (next.has(themeId)) {
				next.delete(themeId);
			} else {
				next.add(themeId);
			}
			return next;
		});
	}, []);

	const toggleMiniTheme = useCallback((miniThemeId: string) => {
		setExpandedMiniThemes((prev) => {
			const next = new Set(prev);
			if (next.has(miniThemeId)) {
				next.delete(miniThemeId);
			} else {
				next.add(miniThemeId);
			}
			return next;
		});
	}, []);

	const handleThemeClick = useCallback(
		(theme: MainTheme) => {
			toggleTheme(theme.id);
			onSelectTheme?.(theme);
		},
		[toggleTheme, onSelectTheme]
	);

	const handleMiniThemeClick = useCallback(
		(miniTheme: MiniTheme, parentTheme: MainTheme) => {
			toggleMiniTheme(miniTheme.id);
			onSelectMiniTheme?.(miniTheme, parentTheme);
		},
		[toggleMiniTheme, onSelectMiniTheme]
	);

	if (themes.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<Folder className="mb-4 size-12 text-muted-foreground" />
				<p className="text-muted-foreground">No themes found</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Search input */}
			<div className="relative">
				<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					className="pl-9"
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Search themes, questions, or years..."
					type="text"
					value={searchQuery}
				/>
			</div>

			{/* Theme tree */}
			<div className="space-y-1">
				{filteredThemes.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No themes match your search
					</p>
				) : (
					filteredThemes.map((mainTheme) => (
						<MainThemeNode
							expandedMiniThemes={effectiveExpandedMiniThemes}
							isExpanded={effectiveExpandedThemes.has(mainTheme.id)}
							key={mainTheme.id}
							onMiniThemeClick={(mt) => handleMiniThemeClick(mt, mainTheme)}
							onQuestionClick={(q, mt) => onSelectQuestion?.(q, mt, mainTheme)}
							onThemeClick={() => handleThemeClick(mainTheme)}
							theme={mainTheme}
						/>
					))
				)}
			</div>
		</div>
	);
}

interface MainThemeNodeProps {
	theme: MainTheme;
	isExpanded: boolean;
	expandedMiniThemes: Set<string>;
	onThemeClick: () => void;
	onMiniThemeClick: (miniTheme: MiniTheme) => void;
	onQuestionClick: (question: EssayQuestion, miniTheme: MiniTheme) => void;
}

function MainThemeNode({
	theme,
	isExpanded,
	expandedMiniThemes,
	onThemeClick,
	onMiniThemeClick,
	onQuestionClick,
}: MainThemeNodeProps) {
	const questionCount = theme.miniThemes.reduce(
		(sum, mt) => sum + mt.questions.length,
		0
	);

	return (
		<div className="rounded-lg border">
			{/* Main theme header */}
			<button
				className="flex w-full cursor-pointer items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50"
				onClick={onThemeClick}
				type="button"
			>
				{isExpanded ? (
					<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
				) : (
					<ChevronRight className="size-4 shrink-0 text-muted-foreground" />
				)}
				<Folder className="size-4 shrink-0 text-primary" />
				<span className="flex-1 font-medium">{theme.title}</span>
				<Badge className="text-xs" variant="secondary">
					{theme.miniThemes.length} topics
				</Badge>
				<Badge className="text-xs" variant="outline">
					{questionCount} questions
				</Badge>
			</button>

			{/* Mini themes */}
			{isExpanded && theme.miniThemes.length > 0 && (
				<div className="border-t">
					{theme.miniThemes.map((miniTheme) => (
						<MiniThemeNode
							isExpanded={expandedMiniThemes.has(miniTheme.id)}
							key={miniTheme.id}
							miniTheme={miniTheme}
							onMiniThemeClick={() => onMiniThemeClick(miniTheme)}
							onQuestionClick={(q) => onQuestionClick(q, miniTheme)}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/**
 * Chevron indicator for mini theme expansion state.
 */
function MiniThemeChevron({
	hasQuestions,
	isExpanded,
}: {
	hasQuestions: boolean;
	isExpanded: boolean;
}) {
	if (!hasQuestions) {
		return <span className="size-3" />;
	}

	if (isExpanded) {
		return <ChevronDown className="size-3 shrink-0 text-muted-foreground" />;
	}

	return <ChevronRight className="size-3 shrink-0 text-muted-foreground" />;
}

interface MiniThemeNodeProps {
	miniTheme: MiniTheme;
	isExpanded: boolean;
	onMiniThemeClick: () => void;
	onQuestionClick: (question: EssayQuestion) => void;
}

function MiniThemeNode({
	miniTheme,
	isExpanded,
	onMiniThemeClick,
	onQuestionClick,
}: MiniThemeNodeProps) {
	return (
		<div>
			{/* Mini theme header */}
			<button
				className="flex w-full cursor-pointer items-center gap-2 py-2 pr-3 pl-8 text-left transition-colors hover:bg-muted/50"
				onClick={onMiniThemeClick}
				type="button"
			>
				<MiniThemeChevron
					hasQuestions={miniTheme.questions.length > 0}
					isExpanded={isExpanded}
				/>
				<FileText className="size-3 shrink-0 text-muted-foreground" />
				<span className="flex-1 text-sm">{miniTheme.title}</span>
				{miniTheme.questions.length > 0 && (
					<Badge className="text-xs" variant="outline">
						{miniTheme.questions.length}
					</Badge>
				)}
			</button>

			{/* Questions */}
			{isExpanded && miniTheme.questions.length > 0 && (
				<div className="space-y-1 pb-2">
					{miniTheme.questions.map((question) => (
						<QuestionNode
							key={question.id}
							onClick={() => onQuestionClick(question)}
							question={question}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface QuestionNodeProps {
	question: EssayQuestion;
	onClick: () => void;
}

function QuestionNode({ question, onClick }: QuestionNodeProps) {
	return (
		<button
			className="flex w-full cursor-pointer items-start gap-2 py-1.5 pr-3 pl-14 text-left transition-colors hover:bg-muted/50"
			onClick={onClick}
			type="button"
		>
			<Badge className="shrink-0 text-xs" variant="default">
				{question.year}
			</Badge>
			<span className="text-muted-foreground text-sm">{question.text}</span>
		</button>
	);
}
