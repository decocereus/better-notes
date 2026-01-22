"use client";

import {
	BarChart3,
	ChevronDown,
	ChevronRight,
	Filter,
	Layers,
	Search,
	Sparkles,
	Tag,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { ThemeContent } from "@/lib/classification/aggregator";
import type {
	ContentType,
	ExtractedContent,
	ThemeMapping,
} from "@/types/extraction";
import type { MainTheme } from "@/types/theme";

/**
 * Display names for content types.
 */
const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
	introduction: "Introduction",
	conclusion: "Conclusion",
	example: "Example",
	quote: "Quote",
	thinker: "Thinker",
	argument: "Argument",
	book_poem: "Book/Poem",
	keyword_phrase: "Keyword/Phrase",
};

interface ClassificationReviewProps {
	/** Classified content items */
	content: ExtractedContent[];
	/** Theme hierarchy */
	themes: MainTheme[];
	/** Aggregated content by theme */
	aggregatedContent: ThemeContent[];
	/** Classification statistics */
	stats: {
		totalClassified: number;
		unclassified: number;
		multiThemeCount: number;
		averageMappings: number;
	};
	/** Callback when content item is selected */
	onItemSelect?: (item: ExtractedContent) => void;
}

/**
 * Component for reviewing and browsing classified content.
 */
export function ClassificationReview({
	content,
	themes,
	aggregatedContent,
	stats,
	onItemSelect,
}: ClassificationReviewProps) {
	const [viewMode, setViewMode] = useState<"byTheme" | "byContent">("byTheme");
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedMainTheme, setSelectedMainTheme] = useState<string>("all");
	const [selectedMiniTheme, setSelectedMiniTheme] = useState<string>("all");
	const [minRelevance, setMinRelevance] = useState<number>(0.5);

	// Get mini themes for selected main theme
	const availableMiniThemes = useMemo(() => {
		if (selectedMainTheme === "all") {
			return [];
		}
		const mainTheme = themes.find((t) => t.id === selectedMainTheme);
		return mainTheme?.miniThemes || [];
	}, [themes, selectedMainTheme]);

	// Filter content based on search and theme filters
	const filteredContent = useMemo(() => {
		return content.filter((item) => {
			// Search filter
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesContent = item.content.toLowerCase().includes(query);
				const matchesContext = item.context?.toLowerCase().includes(query);
				if (!(matchesContent || matchesContext)) {
					return false;
				}
			}

			// Theme filter
			if (selectedMainTheme !== "all") {
				const hasMatchingTheme = item.themes.some((mapping) => {
					if (mapping.mainThemeId !== selectedMainTheme) {
						return false;
					}
					if (
						selectedMiniTheme !== "all" &&
						mapping.miniThemeId !== selectedMiniTheme
					) {
						return false;
					}
					return mapping.relevanceScore >= minRelevance;
				});
				if (!hasMatchingTheme) {
					return false;
				}
			}

			return true;
		});
	}, [
		content,
		searchQuery,
		selectedMainTheme,
		selectedMiniTheme,
		minRelevance,
	]);

	// Filter aggregated content by theme
	const filteredAggregated = useMemo(() => {
		if (selectedMainTheme === "all") {
			return aggregatedContent;
		}
		return aggregatedContent.filter((tc) => {
			if (tc.mainThemeId !== selectedMainTheme) {
				return false;
			}
			if (selectedMiniTheme !== "all" && tc.miniThemeId !== selectedMiniTheme) {
				return false;
			}
			return true;
		});
	}, [aggregatedContent, selectedMainTheme, selectedMiniTheme]);

	// Reset mini theme when main theme changes
	const handleMainThemeChange = (value: string) => {
		setSelectedMainTheme(value);
		setSelectedMiniTheme("all");
	};

	return (
		<div className="space-y-6">
			{/* Stats Overview */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				<StatCard
					icon={<Tag className="size-4" />}
					label="Classified"
					value={stats.totalClassified}
				/>
				<StatCard
					icon={<Layers className="size-4" />}
					label="Multi-Theme"
					value={stats.multiThemeCount}
					variant="info"
				/>
				<StatCard
					icon={<BarChart3 className="size-4" />}
					label="Avg Themes/Item"
					value={stats.averageMappings.toFixed(1)}
				/>
				<StatCard
					icon={<Filter className="size-4" />}
					label="Unclassified"
					value={stats.unclassified}
					variant={stats.unclassified > 0 ? "warning" : "default"}
				/>
			</div>

			{/* Filters */}
			<Card className="p-4">
				<div className="flex flex-wrap items-center gap-3">
					{/* Search */}
					<div className="relative min-w-[200px] flex-1">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="pl-9"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search content..."
							value={searchQuery}
						/>
					</div>

					{/* Main Theme Filter */}
					<Select
						onValueChange={handleMainThemeChange}
						value={selectedMainTheme}
					>
						<SelectTrigger className="w-[180px]">
							<SelectValue placeholder="Main Theme" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Themes</SelectItem>
							{themes.map((theme) => (
								<SelectItem key={theme.id} value={theme.id}>
									{theme.title}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Mini Theme Filter */}
					{selectedMainTheme !== "all" && (
						<Select
							onValueChange={setSelectedMiniTheme}
							value={selectedMiniTheme}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Mini Theme" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Mini Themes</SelectItem>
								{availableMiniThemes.map((mini) => (
									<SelectItem key={mini.id} value={mini.id}>
										{mini.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					)}

					{/* View Mode Toggle */}
					<div className="flex rounded-lg border p-1">
						<Button
							className="px-3"
							onClick={() => setViewMode("byTheme")}
							size="sm"
							variant={viewMode === "byTheme" ? "secondary" : "ghost"}
						>
							By Theme
						</Button>
						<Button
							className="px-3"
							onClick={() => setViewMode("byContent")}
							size="sm"
							variant={viewMode === "byContent" ? "secondary" : "ghost"}
						>
							By Content
						</Button>
					</div>
				</div>

				{/* Relevance Filter */}
				<div className="mt-3 flex items-center gap-2">
					<span className="text-muted-foreground text-sm">Min Relevance:</span>
					<input
						className="w-24"
						max="1"
						min="0"
						onChange={(e) => setMinRelevance(Number.parseFloat(e.target.value))}
						step="0.1"
						type="range"
						value={minRelevance}
					/>
					<span className="text-sm">{minRelevance.toFixed(1)}</span>
				</div>
			</Card>

			{/* Results */}
			<div className="text-muted-foreground text-sm">
				{viewMode === "byTheme"
					? `Showing ${filteredAggregated.length} themes`
					: `Showing ${filteredContent.length} of ${content.length} items`}
			</div>

			{/* Content View */}
			{viewMode === "byTheme" ? (
				<ThemeView
					aggregatedContent={filteredAggregated}
					onItemSelect={onItemSelect}
				/>
			) : (
				<ContentView content={filteredContent} onItemSelect={onItemSelect} />
			)}
		</div>
	);
}

interface StatCardProps {
	label: string;
	value: string | number;
	icon?: React.ReactNode;
	variant?: "default" | "info" | "warning";
}

function StatCard({ label, value, icon, variant = "default" }: StatCardProps) {
	const variantClasses = {
		default: "bg-card",
		info: "bg-blue-500/10 border-blue-500/20",
		warning: "bg-amber-500/10 border-amber-500/20",
	};

	return (
		<Card className={`p-4 ${variantClasses[variant]}`}>
			<div className="flex items-center gap-2 text-muted-foreground">
				{icon}
				<span className="text-xs">{label}</span>
			</div>
			<p className="mt-1 font-semibold text-2xl">{value}</p>
		</Card>
	);
}

interface ThemeViewProps {
	aggregatedContent: ThemeContent[];
	onItemSelect?: (item: ExtractedContent) => void;
}

function ThemeView({ aggregatedContent, onItemSelect }: ThemeViewProps) {
	if (aggregatedContent.length === 0) {
		return (
			<Card className="p-8 text-center">
				<p className="text-muted-foreground">
					No themes match your filters. Try adjusting your search criteria.
				</p>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			{aggregatedContent.map((themeContent) => (
				<ThemeContentCard
					key={themeContent.miniThemeId}
					onItemSelect={onItemSelect}
					themeContent={themeContent}
				/>
			))}
		</div>
	);
}

interface ThemeContentCardProps {
	themeContent: ThemeContent;
	onItemSelect?: (item: ExtractedContent) => void;
}

function ThemeContentCard({
	themeContent,
	onItemSelect,
}: ThemeContentCardProps) {
	const [isOpen, setIsOpen] = useState(false);

	const allItems = [
		...themeContent.content.introductions,
		...themeContent.content.conclusions,
		...themeContent.content.examples,
		...themeContent.content.quotes,
		...themeContent.content.thinkers,
		...themeContent.content.arguments,
		...themeContent.content.booksPoems,
		...themeContent.content.keywords,
	];

	return (
		<Collapsible onOpenChange={setIsOpen} open={isOpen}>
			<Card>
				<CollapsibleTrigger asChild>
					<button
						className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
						type="button"
					>
						<div className="flex-1">
							<div className="flex items-center gap-2">
								{isOpen ? (
									<ChevronDown className="size-4" />
								) : (
									<ChevronRight className="size-4" />
								)}
								<span className="font-medium">
									{themeContent.miniThemeName}
								</span>
								<Badge variant="secondary">{themeContent.stats.total}</Badge>
							</div>
							<p className="ml-6 text-muted-foreground text-sm">
								{themeContent.mainThemeName}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<Badge variant="outline">
								{themeContent.stats.bySource.topper} topper
							</Badge>
							<Badge variant="outline">
								{themeContent.stats.bySource.user} user
							</Badge>
							{themeContent.stats.multiUseCount > 0 && (
								<Badge className="gap-1 bg-blue-500/10 text-blue-700">
									<Sparkles className="size-3" />
									{themeContent.stats.multiUseCount} multi-use
								</Badge>
							)}
						</div>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="space-y-3 border-t p-4">
						{/* Content grouped by type */}
						{Object.entries(CONTENT_TYPE_LABELS).map(([type, label]) => {
							const items = allItems.filter((i) => i.contentType === type);
							if (items.length === 0) {
								return null;
							}
							return (
								<div key={type}>
									<h4 className="mb-2 font-medium text-sm">
										{label} ({items.length})
									</h4>
									<div className="space-y-2">
										{items.slice(0, 5).map((item) => (
											<ContentItemWithThemes
												item={item}
												key={item.id}
												onClick={() => onItemSelect?.(item)}
												themeId={themeContent.miniThemeId}
											/>
										))}
										{items.length > 5 && (
											<p className="text-muted-foreground text-xs">
												+{items.length - 5} more items
											</p>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
}

interface ContentViewProps {
	content: ExtractedContent[];
	onItemSelect?: (item: ExtractedContent) => void;
}

function ContentView({ content, onItemSelect }: ContentViewProps) {
	if (content.length === 0) {
		return (
			<Card className="p-8 text-center">
				<p className="text-muted-foreground">
					No content matches your filters. Try adjusting your search criteria.
				</p>
			</Card>
		);
	}

	return (
		<div className="space-y-3">
			{content.slice(0, 50).map((item) => (
				<ContentItemWithThemes
					item={item}
					key={item.id}
					onClick={() => onItemSelect?.(item)}
				/>
			))}
			{content.length > 50 && (
				<p className="text-center text-muted-foreground text-sm">
					Showing first 50 of {content.length} items
				</p>
			)}
		</div>
	);
}

interface ContentItemWithThemesProps {
	item: ExtractedContent;
	onClick?: () => void;
	/** Highlight this specific theme */
	themeId?: string;
}

function ContentItemWithThemes({
	item,
	onClick,
	themeId,
}: ContentItemWithThemesProps) {
	return (
		<button
			className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
			onClick={onClick}
			type="button"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1">
					<div className="mb-1 flex items-center gap-2">
						<Badge variant="outline">
							{CONTENT_TYPE_LABELS[item.contentType]}
						</Badge>
						<Badge variant={item.quality === "high" ? "default" : "secondary"}>
							{item.quality}
						</Badge>
						{item.multiUse && (
							<Badge className="gap-1 bg-blue-500/10 text-blue-700">
								<Sparkles className="size-3" />
								Multi-use
							</Badge>
						)}
					</div>
					<p className="line-clamp-2 text-sm">{item.content}</p>
				</div>
			</div>

			{/* Theme mappings */}
			{item.themes.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1">
					{item.themes.slice(0, 5).map((mapping) => (
						<ThemeBadge
							highlight={mapping.miniThemeId === themeId}
							key={`${mapping.mainThemeId}-${mapping.miniThemeId}`}
							mapping={mapping}
						/>
					))}
					{item.themes.length > 5 && (
						<Badge variant="outline">+{item.themes.length - 5} more</Badge>
					)}
				</div>
			)}
		</button>
	);
}

interface ThemeBadgeProps {
	mapping: ThemeMapping;
	highlight?: boolean;
}

function getRelevanceColor(score: number): string {
	if (score >= 0.8) {
		return "bg-green-500/10 text-green-700 border-green-500/20";
	}
	if (score >= 0.6) {
		return "bg-blue-500/10 text-blue-700 border-blue-500/20";
	}
	return "bg-gray-500/10 text-gray-700 border-gray-500/20";
}

function ThemeBadge({ mapping, highlight }: ThemeBadgeProps) {
	const relevanceColor = getRelevanceColor(mapping.relevanceScore);

	return (
		<Badge
			className={`gap-1 text-xs ${highlight ? "ring-2 ring-primary" : ""} ${relevanceColor}`}
			variant="outline"
		>
			<span className="max-w-[120px] truncate">{mapping.miniThemeId}</span>
			<span className="opacity-60">
				{(mapping.relevanceScore * 100).toFixed(0)}%
			</span>
		</Badge>
	);
}
