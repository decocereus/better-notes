"use client";

import {
	AlertTriangle,
	BookOpen,
	ChevronDown,
	Filter,
	Lightbulb,
	MessageSquareQuote,
	Search,
	Sparkles,
	Star,
	User,
} from "lucide-react";

const FILENAME_PREFIX_REGEX = /^\d+-/;

import { useMemo, useState } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
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
import type {
	ContentQuality,
	ContentType,
	ExampleCategory,
	ExtractedContent,
} from "@/types/extraction";

/**
 * Filter criteria for content items.
 */
interface FilterCriteria {
	searchQuery: string;
	typeFilter: ContentType | "all";
	qualityFilter: ContentQuality | "all";
	categoryFilter: ExampleCategory | "all";
	showOverused: boolean;
	showMultiUseOnly: boolean;
}

/**
 * Checks if item matches search query.
 */
function matchesSearch(item: ExtractedContent, query: string): boolean {
	if (!query) {
		return true;
	}
	const lowerQuery = query.toLowerCase();
	const matchesContent = item.content.toLowerCase().includes(lowerQuery);
	const matchesContext = item.context?.toLowerCase().includes(lowerQuery);
	return matchesContent || Boolean(matchesContext);
}

/**
 * Checks if item matches all filter criteria.
 */
function matchesFilters(
	item: ExtractedContent,
	criteria: FilterCriteria
): boolean {
	if (!matchesSearch(item, criteria.searchQuery)) {
		return false;
	}
	if (
		criteria.typeFilter !== "all" &&
		item.contentType !== criteria.typeFilter
	) {
		return false;
	}
	if (
		criteria.qualityFilter !== "all" &&
		item.quality !== criteria.qualityFilter
	) {
		return false;
	}
	if (
		criteria.categoryFilter !== "all" &&
		(item.contentType !== "example" ||
			item.exampleCategory !== criteria.categoryFilter)
	) {
		return false;
	}
	if (!criteria.showOverused && item.isOverused) {
		return false;
	}
	if (criteria.showMultiUseOnly && !item.multiUse) {
		return false;
	}
	return true;
}

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

/**
 * Icons for content types.
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
 * Display names for example categories.
 */
const CATEGORY_LABELS: Record<ExampleCategory, string> = {
	individual: "Individual",
	ethical: "Ethical",
	governance: "Governance",
	societal: "Societal",
	environment: "Environment",
	mythological: "Mythological",
	sports: "Sports",
	religion: "Religion",
	business: "Business",
	international_relations: "International Relations",
	science_tech: "Science & Tech",
};

/**
 * Quality badge variants.
 */
const QUALITY_VARIANTS: Record<
	ContentQuality,
	"default" | "secondary" | "outline"
> = {
	high: "default",
	medium: "secondary",
	low: "outline",
};

interface ExtractedContentBrowserProps {
	items: ExtractedContent[];
	onItemSelect?: (item: ExtractedContent) => void;
	sectionsByType?: Partial<Record<ContentType, string[]>>;
}

/**
 * Browser component for viewing and filtering extracted content.
 */
export function ExtractedContentBrowser({
	items,
	onItemSelect,
	sectionsByType = {},
}: ExtractedContentBrowserProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
	const [qualityFilter, setQualityFilter] = useState<ContentQuality | "all">(
		"all"
	);
	const [categoryFilter, setCategoryFilter] = useState<ExampleCategory | "all">(
		"all"
	);
	const [showOverused, setShowOverused] = useState(true);
	const [showMultiUseOnly, setShowMultiUseOnly] = useState(false);

	// Calculate stats
	const stats = useMemo(() => {
		const byType: Partial<Record<ContentType, number>> = {};
		const byQuality: Record<ContentQuality, number> = {
			high: 0,
			medium: 0,
			low: 0,
		};
		let overused = 0;
		let multiUse = 0;

		for (const item of items) {
			byType[item.contentType] = (byType[item.contentType] || 0) + 1;
			byQuality[item.quality]++;
			if (item.isOverused) {
				overused++;
			}
			if (item.multiUse) {
				multiUse++;
			}
		}

		return { byType, byQuality, overused, multiUse, total: items.length };
	}, [items]);

	// Filter items using extracted predicate function
	const filteredItems = useMemo(() => {
		const criteria: FilterCriteria = {
			searchQuery,
			typeFilter,
			qualityFilter,
			categoryFilter,
			showOverused,
			showMultiUseOnly,
		};
		return items.filter((item) => matchesFilters(item, criteria));
	}, [
		items,
		searchQuery,
		typeFilter,
		qualityFilter,
		categoryFilter,
		showOverused,
		showMultiUseOnly,
	]);

	// Group filtered items by type
	const groupedItems = useMemo(() => {
		const groups: Partial<Record<ContentType, ExtractedContent[]>> = {};

		for (const item of filteredItems) {
			if (!groups[item.contentType]) {
				groups[item.contentType] = [];
			}
			groups[item.contentType]?.push(item);
		}

		return groups;
	}, [filteredItems]);

	const contentTypes = Object.keys(groupedItems) as ContentType[];

	return (
		<div className="space-y-4">
			{/* Stats Summary */}
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
				<StatCard label="Total" value={stats.total} />
				<StatCard
					label="High Quality"
					value={stats.byQuality.high}
					variant="success"
				/>
				<StatCard label="Multi-Use" value={stats.multiUse} variant="info" />
				<StatCard label="Overused" value={stats.overused} variant="warning" />
			</div>

			{/* Filters */}
			<Card className="p-4">
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative min-w-[200px] flex-1">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							className="pl-9"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search content..."
							value={searchQuery}
						/>
					</div>

					<Select
						onValueChange={(v) => setTypeFilter(v as ContentType | "all")}
						value={typeFilter}
					>
						<SelectTrigger className="w-[150px]">
							<Filter className="mr-2 size-4" />
							<SelectValue placeholder="Type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							{Object.entries(CONTENT_TYPE_LABELS).map(([value, label]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select
						onValueChange={(v) => setQualityFilter(v as ContentQuality | "all")}
						value={qualityFilter}
					>
						<SelectTrigger className="w-[130px]">
							<SelectValue placeholder="Quality" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Quality</SelectItem>
							<SelectItem value="high">High</SelectItem>
							<SelectItem value="medium">Medium</SelectItem>
							<SelectItem value="low">Low</SelectItem>
						</SelectContent>
					</Select>

					<Select
						onValueChange={(v) =>
							setCategoryFilter(v as ExampleCategory | "all")
						}
						value={categoryFilter}
					>
						<SelectTrigger className="w-[160px]">
							<SelectValue placeholder="Category" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							{Object.entries(CATEGORY_LABELS).map(([value, label]) => (
								<SelectItem key={value} value={value}>
									{label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="mt-3 flex flex-wrap gap-2">
					<Button
						onClick={() => setShowOverused(!showOverused)}
						size="sm"
						variant={showOverused ? "outline" : "secondary"}
					>
						{showOverused ? "Showing" : "Hiding"} Overused
					</Button>
					<Button
						onClick={() => setShowMultiUseOnly(!showMultiUseOnly)}
						size="sm"
						variant={showMultiUseOnly ? "secondary" : "outline"}
					>
						{showMultiUseOnly ? "Multi-Use Only" : "All Items"}
					</Button>
				</div>
			</Card>

			{/* Results */}
			<div className="text-muted-foreground text-sm">
				Showing {filteredItems.length} of {items.length} items
			</div>

			{/* Grouped Content */}
			{contentTypes.length === 0 ? (
				<Card className="p-8 text-center">
					<p className="text-muted-foreground">
						No items match your filters. Try adjusting your search or filters.
					</p>
				</Card>
			) : (
				<div className="space-y-4">
					{contentTypes.map((type) => (
						<ContentTypeGroup
							items={groupedItems[type] || []}
							key={type}
							onItemSelect={onItemSelect}
							sectionMarkdown={sectionsByType[type]}
							type={type}
						/>
					))}
				</div>
			)}
		</div>
	);
}

interface StatCardProps {
	label: string;
	value: number;
	variant?: "default" | "success" | "warning" | "info";
}

function StatCard({ label, value, variant = "default" }: StatCardProps) {
	const variantClasses = {
		default: "bg-card",
		success: "bg-green-500/10 border-green-500/20",
		warning: "bg-amber-500/10 border-amber-500/20",
		info: "bg-blue-500/10 border-blue-500/20",
	};

	return (
		<Card className={`p-3 ${variantClasses[variant]}`}>
			<p className="font-semibold text-lg">{value}</p>
			<p className="text-muted-foreground text-xs">{label}</p>
		</Card>
	);
}

interface ContentTypeGroupProps {
	type: ContentType;
	items: ExtractedContent[];
	onItemSelect?: (item: ExtractedContent) => void;
	sectionMarkdown?: string[];
}

function ContentTypeGroup({
	type,
	items,
	onItemSelect,
	sectionMarkdown,
}: ContentTypeGroupProps) {
	const [isOpen, setIsOpen] = useState(true);
	const summaryMarkdown = sectionMarkdown?.filter(Boolean).join("\n\n");

	return (
		<Collapsible onOpenChange={setIsOpen} open={isOpen}>
			<Card>
				<CollapsibleTrigger asChild>
					<button
						className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50"
						type="button"
					>
						<div className="flex items-center gap-2">
							{CONTENT_TYPE_ICONS[type]}
							<span className="font-medium">{CONTENT_TYPE_LABELS[type]}</span>
							<Badge variant="secondary">{items.length}</Badge>
						</div>
						<ChevronDown
							className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
						/>
					</button>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<div className="space-y-2 border-t p-4">
						{summaryMarkdown ? (
							<div className="rounded-lg border bg-muted/30 p-3">
								<p className="text-muted-foreground text-xs">Highlights</p>
								<MessageResponse className="mt-2 text-pretty text-sm">
									{summaryMarkdown}
								</MessageResponse>
							</div>
						) : null}
						{items.map((item) => (
							<ContentItemCard
								item={item}
								key={item.id}
								onClick={() => onItemSelect?.(item)}
							/>
						))}
					</div>
				</CollapsibleContent>
			</Card>
		</Collapsible>
	);
}

interface ContentItemCardProps {
	item: ExtractedContent;
	onClick?: () => void;
}

function ContentItemCard({ item, onClick }: ContentItemCardProps) {
	const sourceLabel = getSourceLabel(item.sourceRef);
	const essayLabel = getEssayLabel(item);

	return (
		<button
			className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
			onClick={onClick}
			type="button"
		>
			<div className="flex items-start justify-between gap-2">
				<div className="flex-1">
					<p className="text-muted-foreground text-xs">Snippet</p>
					<p className="mt-1 line-clamp-3 text-pretty text-sm">
						{item.content}
					</p>
				</div>
				<div className="flex flex-col items-end gap-1">
					<Badge variant={QUALITY_VARIANTS[item.quality]}>{item.quality}</Badge>
					{item.isOverused && (
						<Badge className="gap-1" variant="outline">
							<AlertTriangle className="size-3" />
							Overused
						</Badge>
					)}
					{item.multiUse && (
						<Badge
							className="gap-1 bg-blue-500/10 text-blue-700"
							variant="outline"
						>
							<Sparkles className="size-3" />
							Multi-use
						</Badge>
					)}
				</div>
			</div>

			{item.context && (
				<p className="mt-2 line-clamp-2 text-pretty text-muted-foreground text-xs">
					<span className="font-medium">Use:</span> {item.context}
				</p>
			)}

			<div className="mt-2 flex flex-wrap gap-2">
				<Badge className="max-w-full truncate" variant="outline">
					Source: {sourceLabel}
				</Badge>
				{essayLabel ? (
					<Badge className="tabular-nums" variant="outline">
						Essay: {essayLabel}
					</Badge>
				) : null}
			</div>

			{item.exampleCategory && (
				<Badge className="mt-2" variant="outline">
					{CATEGORY_LABELS[item.exampleCategory]}
				</Badge>
			)}
		</button>
	);
}

function getSourceLabel(sourceRef: string): string {
	if (!sourceRef) {
		return "Unknown";
	}
	const parts = sourceRef.split("/");
	const filename = parts.at(-1) || sourceRef;
	return filename.replace(FILENAME_PREFIX_REGEX, "");
}

function getEssayLabel(item: ExtractedContent): string | null {
	if (item.essayTitle) {
		return item.essayTitle;
	}
	if (item.essayStartPage && item.essayEndPage) {
		return `Pages ${item.essayStartPage}-${item.essayEndPage}`;
	}
	if (item.essayIndex) {
		return `#${item.essayIndex}`;
	}
	return null;
}
