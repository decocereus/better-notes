"use client";

import {
	AlertTriangle,
	BookMarked,
	BookOpen,
	ChevronDown,
	FileText,
	Lightbulb,
	MessageSquareQuote,
	Search,
	Sparkles,
	User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MessageResponse } from "@/components/ai-elements/message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
	ContentQuality,
	ContentType,
	ExampleCategory,
	ExtractedContent,
} from "@/types/extraction";

const FILENAME_PREFIX_REGEX = /^\d+-/;

/** Content type configuration with colors and icons */
const CONTENT_CONFIG: Record<
	ContentType,
	{ label: string; icon: React.ReactNode; color: string; bg: string }
> = {
	introduction: {
		label: "Introduction",
		icon: <Sparkles className="size-4" />,
		color: "text-amber-400",
		bg: "bg-amber-500/10 border-amber-500/20",
	},
	conclusion: {
		label: "Conclusion",
		icon: <BookMarked className="size-4" />,
		color: "text-emerald-400",
		bg: "bg-emerald-500/10 border-emerald-500/20",
	},
	example: {
		label: "Example",
		icon: <Lightbulb className="size-4" />,
		color: "text-blue-400",
		bg: "bg-blue-500/10 border-blue-500/20",
	},
	quote: {
		label: "Quote",
		icon: <MessageSquareQuote className="size-4" />,
		color: "text-purple-400",
		bg: "bg-purple-500/10 border-purple-500/20",
	},
	thinker: {
		label: "Thinker",
		icon: <User className="size-4" />,
		color: "text-rose-400",
		bg: "bg-rose-500/10 border-rose-500/20",
	},
	argument: {
		label: "Argument",
		icon: <Lightbulb className="size-4" />,
		color: "text-cyan-400",
		bg: "bg-cyan-500/10 border-cyan-500/20",
	},
	book_poem: {
		label: "Book/Poem",
		icon: <BookOpen className="size-4" />,
		color: "text-orange-400",
		bg: "bg-orange-500/10 border-orange-500/20",
	},
	keyword_phrase: {
		label: "Keyword",
		icon: <FileText className="size-4" />,
		color: "text-slate-400",
		bg: "bg-slate-500/10 border-slate-500/20",
	},
};

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
	international_relations: "Intl Relations",
	science_tech: "Science & Tech",
};

const QUALITY_CONFIG: Record<
	ContentQuality,
	{ label: string; dotClass: string }
> = {
	high: { label: "High", dotClass: "bg-emerald-500" },
	medium: { label: "Medium", dotClass: "bg-amber-500" },
	low: { label: "Low", dotClass: "bg-slate-500" },
};

interface FilterCriteria {
	searchQuery: string;
	typeFilter: ContentType | "all";
	qualityFilter: ContentQuality | "all";
	categoryFilter: ExampleCategory | "all";
	showOverused: boolean;
	showMultiUseOnly: boolean;
}

function matchesFilters(
	item: ExtractedContent,
	criteria: FilterCriteria
): boolean {
	if (criteria.searchQuery) {
		const q = criteria.searchQuery.toLowerCase();
		const inContent = item.content.toLowerCase().includes(q);
		const inVerbatim = item.verbatimText?.toLowerCase().includes(q);
		const inContext = item.context?.toLowerCase().includes(q);
		if (!(inContent || inVerbatim || inContext)) {
			return false;
		}
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

interface ExtractedContentBrowserProps {
	items: ExtractedContent[];
	onItemSelect?: (item: ExtractedContent) => void;
	/** Number of essays to show per page (default: 5) */
	essaysPerPage?: number;
}

const DEFAULT_ESSAYS_PER_PAGE = 5;

export function ExtractedContentBrowser({
	items,
	onItemSelect,
	essaysPerPage = DEFAULT_ESSAYS_PER_PAGE,
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
	const [currentPage, setCurrentPage] = useState(1);

	const stats = useMemo(() => {
		let high = 0;
		let multiUse = 0;
		let overused = 0;
		for (const item of items) {
			if (item.quality === "high") {
				high++;
			}
			if (item.multiUse) {
				multiUse++;
			}
			if (item.isOverused) {
				overused++;
			}
		}
		return { total: items.length, high, multiUse, overused };
	}, [items]);

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

	// Group by essay
	const groupedByEssay = useMemo(() => {
		const groups = new Map<string, ExtractedContent[]>();
		for (const item of filteredItems) {
			const key = item.essayTitle || `Essay #${item.essayIndex || "?"}`;
			const list = groups.get(key) || [];
			list.push(item);
			groups.set(key, list);
		}
		return groups;
	}, [filteredItems]);

	// Pagination logic
	const essayEntries = useMemo(
		() => Array.from(groupedByEssay.entries()),
		[groupedByEssay]
	);
	const totalEssays = essayEntries.length;
	const totalPages = Math.max(1, Math.ceil(totalEssays / essaysPerPage));

	// Reset to page 1 when filters change
	// biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally reset page when filter dependencies change
	useEffect(() => {
		setCurrentPage(1);
	}, [
		searchQuery,
		typeFilter,
		qualityFilter,
		categoryFilter,
		showOverused,
		showMultiUseOnly,
	]);

	// Get current page essays
	const paginatedEssays = useMemo(() => {
		const startIndex = (currentPage - 1) * essaysPerPage;
		return essayEntries.slice(startIndex, startIndex + essaysPerPage);
	}, [essayEntries, currentPage, essaysPerPage]);

	return (
		<div className="space-y-6">
			{/* Stats Bar */}
			<div className="flex items-center gap-6 border-border/50 border-b pb-4">
				<StatPill label="Total" value={stats.total} />
				<StatPill accent="emerald" label="High Quality" value={stats.high} />
				<StatPill accent="blue" label="Multi-Use" value={stats.multiUse} />
				<StatPill accent="amber" label="Overused" value={stats.overused} />
			</div>

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3">
				<div className="relative min-w-[220px] flex-1">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="border-0 bg-muted/30 pl-9"
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search content..."
						value={searchQuery}
					/>
				</div>

				<Select
					onValueChange={(v) => setTypeFilter(v as ContentType | "all")}
					value={typeFilter}
				>
					<SelectTrigger className="w-[140px] border-0 bg-muted/30">
						<SelectValue placeholder="Type" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Types</SelectItem>
						{Object.entries(CONTENT_CONFIG).map(([value, config]) => (
							<SelectItem key={value} value={value}>
								<span className="flex items-center gap-2">
									<span className={config.color}>{config.icon}</span>
									{config.label}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					onValueChange={(v) => setQualityFilter(v as ContentQuality | "all")}
					value={qualityFilter}
				>
					<SelectTrigger className="w-[120px] border-0 bg-muted/30">
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
					onValueChange={(v) => setCategoryFilter(v as ExampleCategory | "all")}
					value={categoryFilter}
				>
					<SelectTrigger className="w-[150px] border-0 bg-muted/30">
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

				<div className="flex gap-2">
					<Button
						className="text-xs"
						onClick={() => setShowOverused(!showOverused)}
						size="sm"
						variant={showOverused ? "ghost" : "secondary"}
					>
						{showOverused ? "Show" : "Hide"} Overused
					</Button>
					<Button
						className="text-xs"
						onClick={() => setShowMultiUseOnly(!showMultiUseOnly)}
						size="sm"
						variant={showMultiUseOnly ? "secondary" : "ghost"}
					>
						Multi-Use Only
					</Button>
				</div>
			</div>

			{/* Results count */}
			<p className="text-muted-foreground text-xs uppercase tracking-wide">
				{filteredItems.length} of {items.length} items
			</p>

			{/* Content grouped by essay */}
			{filteredItems.length === 0 ? (
				<div className="py-16 text-center">
					<p className="text-muted-foreground">No items match your filters.</p>
				</div>
			) : (
				<div className="space-y-6">
					{paginatedEssays.map(([essayTitle, essayItems]) => (
						<EssayGroup
							items={essayItems}
							key={essayTitle}
							onItemSelect={onItemSelect}
							title={essayTitle}
						/>
					))}
				</div>
			)}

			{/* Pagination */}
			{totalEssays > essaysPerPage && (
				<div className="pt-4">
					<Pagination>
						<PaginationContent>
							<PaginationItem>
								<PaginationPrevious
									aria-disabled={currentPage === 1}
									className={
										currentPage === 1 ? "pointer-events-none opacity-50" : ""
									}
									href="#"
									onClick={(e) => {
										e.preventDefault();
										setCurrentPage((p) => Math.max(1, p - 1));
									}}
								/>
							</PaginationItem>

							{Array.from({ length: totalPages }, (_, i) => i + 1).map(
								(page) => (
									<PaginationItem key={page}>
										<PaginationLink
											href="#"
											isActive={page === currentPage}
											onClick={(e) => {
												e.preventDefault();
												setCurrentPage(page);
											}}
										>
											{page}
										</PaginationLink>
									</PaginationItem>
								)
							)}

							<PaginationItem>
								<PaginationNext
									aria-disabled={currentPage === totalPages}
									className={
										currentPage === totalPages
											? "pointer-events-none opacity-50"
											: ""
									}
									href="#"
									onClick={(e) => {
										e.preventDefault();
										setCurrentPage((p) => Math.min(totalPages, p + 1));
									}}
								/>
							</PaginationItem>
						</PaginationContent>
					</Pagination>
					<p className="text-center text-muted-foreground text-xs">
						Showing {(currentPage - 1) * essaysPerPage + 1}–
						{Math.min(currentPage * essaysPerPage, totalEssays)} of{" "}
						{totalEssays} total essays
					</p>
				</div>
			)}
		</div>
	);
}

function StatPill({
	label,
	value,
	accent,
}: {
	label: string;
	value: number;
	accent?: "emerald" | "blue" | "amber";
}) {
	const accentColors = {
		emerald: "text-emerald-400",
		blue: "text-blue-400",
		amber: "text-amber-400",
	};
	const accentClass = accent ? accentColors[accent] : "text-foreground";

	return (
		<div className="flex items-baseline gap-2">
			<span className={cn("font-light text-2xl tabular-nums", accentClass)}>
				{value}
			</span>
			<span className="text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</span>
		</div>
	);
}

function EssayGroup({
	title,
	items,
	onItemSelect,
}: {
	title: string;
	items: ExtractedContent[];
	onItemSelect?: (item: ExtractedContent) => void;
}) {
	const [isOpen, setIsOpen] = useState(true);
	const firstItem = items[0];
	const pageRange =
		firstItem?.essayStartPage && firstItem?.essayEndPage
			? `pp. ${firstItem.essayStartPage}–${firstItem.essayEndPage}`
			: null;

	// Group items by content type within essay
	const byType = useMemo(() => {
		const groups = new Map<ContentType, ExtractedContent[]>();
		for (const item of items) {
			const list = groups.get(item.contentType) || [];
			list.push(item);
			groups.set(item.contentType, list);
		}
		return groups;
	}, [items]);

	return (
		<Collapsible onOpenChange={setIsOpen} open={isOpen}>
			<div className="overflow-hidden rounded-xl border border-border/50 bg-card/30">
				{/* Essay Header */}
				<CollapsibleTrigger asChild>
					<Button
						className="flex h-auto w-full items-center justify-between px-5 py-4 hover:bg-muted/20"
						variant="ghost"
					>
						<div className="flex items-center gap-4">
							<div className="flex flex-col items-start">
								<h3 className="text-left font-medium text-foreground text-lg leading-tight">
									{title}
								</h3>
								<div className="mt-1 flex items-center gap-3">
									{pageRange && (
										<span className="font-mono text-muted-foreground text-xs">
											{pageRange}
										</span>
									)}
									<span className="text-muted-foreground text-xs">
										{items.length} items
									</span>
								</div>
							</div>
						</div>
						<ChevronDown
							className={cn(
								"size-4 text-muted-foreground transition-transform duration-200",
								!isOpen && "-rotate-90"
							)}
						/>
					</Button>
				</CollapsibleTrigger>

				{/* Content by Type */}
				<CollapsibleContent>
					<div className="border-border/50 border-t">
						{Array.from(byType.entries()).map(([contentType, typeItems]) => (
							<ContentTypeSection
								contentType={contentType}
								items={typeItems}
								key={contentType}
								onItemSelect={onItemSelect}
							/>
						))}
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

function ContentTypeSection({
	contentType,
	items,
	onItemSelect,
}: {
	contentType: ContentType;
	items: ExtractedContent[];
	onItemSelect?: (item: ExtractedContent) => void;
}) {
	const [isOpen, setIsOpen] = useState(true);
	const config = CONTENT_CONFIG[contentType];

	return (
		<Collapsible onOpenChange={setIsOpen} open={isOpen}>
			<div className="border-border/30 border-b last:border-b-0">
				{/* Type Header */}
				<CollapsibleTrigger asChild>
					<Button
						className="flex h-auto w-full items-center justify-between bg-muted/10 px-5 py-3 hover:bg-muted/20"
						variant="ghost"
					>
						<div className="flex items-center gap-2">
							<span className={config.color}>{config.icon}</span>
							<span className="font-medium text-muted-foreground text-sm uppercase tracking-wider">
								{config.label}
							</span>
							<span className="text-muted-foreground/60 text-xs">
								({items.length})
							</span>
						</div>
						<ChevronDown
							className={cn(
								"size-4 text-muted-foreground transition-transform duration-200",
								!isOpen && "-rotate-90"
							)}
						/>
					</Button>
				</CollapsibleTrigger>

				{/* Items */}
				<CollapsibleContent>
					<div className="divide-y divide-border/20">
						{items.map((item) => (
							<ContentItem
								item={item}
								key={item.id}
								onSelect={() => onItemSelect?.(item)}
							/>
						))}
					</div>
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

function ContentItem({
	item,
	onSelect,
}: {
	item: ExtractedContent;
	onSelect?: () => void;
}) {
	const [isOpen, setIsOpen] = useState(false);

	const hasExpandableContent =
		item.verbatimText ||
		item.detailsMarkdown ||
		item.attribution ||
		item.context;

	const handleToggle = (open: boolean) => {
		setIsOpen(open);
		if (open) {
			onSelect?.();
		}
	};

	if (!hasExpandableContent) {
		return (
			<div className="px-5 py-4">
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1">
						<p className="text-sm leading-relaxed">{item.content}</p>
						<MetadataIndicators item={item} />
					</div>
				</div>
			</div>
		);
	}

	return (
		<Collapsible onOpenChange={handleToggle} open={isOpen}>
			<div className="px-5 py-4">
				<CollapsibleTrigger asChild>
					<Button
						className="flex h-auto w-full items-start gap-3 p-0 text-left hover:bg-transparent"
						variant="ghost"
					>
						<ChevronDown
							className={cn(
								"mt-1 size-4 shrink-0 text-muted-foreground/50 transition-transform duration-200",
								!isOpen && "-rotate-90"
							)}
						/>
						<div className="min-w-0 flex-1">
							<p className="text-sm leading-relaxed">{item.content}</p>
							<MetadataIndicators item={item} />
						</div>
					</Button>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<ExpandedDetails item={item} />
				</CollapsibleContent>
			</div>
		</Collapsible>
	);
}

/** Inline metadata indicators - dots and small icons */
function MetadataIndicators({ item }: { item: ExtractedContent }) {
	const qualityConfig = QUALITY_CONFIG[item.quality];

	return (
		<div className="mt-2 flex flex-wrap items-center gap-3">
			{/* Quality dot */}
			<span
				className="flex items-center gap-1.5"
				title={`${qualityConfig.label} quality`}
			>
				<span className={cn("size-2 rounded-full", qualityConfig.dotClass)} />
				<span className="text-[10px] text-muted-foreground/70 uppercase">
					{qualityConfig.label}
				</span>
			</span>

			{/* Multi-use indicator */}
			{item.multiUse && (
				<span
					className="flex items-center gap-1 text-blue-400"
					title="Multi-use"
				>
					<Sparkles className="size-3" />
				</span>
			)}

			{/* Overused indicator */}
			{item.isOverused && (
				<span
					className="flex items-center gap-1 text-amber-500"
					title="Overused"
				>
					<AlertTriangle className="size-3" />
				</span>
			)}

			{/* Category badge for examples */}
			{item.exampleCategory && (
				<Badge className="px-1.5 py-0 text-[10px]" variant="outline">
					{CATEGORY_LABELS[item.exampleCategory]}
				</Badge>
			)}

			{/* Page reference */}
			{(item.sourcePageStart || item.sourcePageEnd) && (
				<span className="font-mono text-[10px] text-muted-foreground/60">
					p.{item.sourcePageStart}
					{item.sourcePageEnd && item.sourcePageEnd !== item.sourcePageStart
						? `–${item.sourcePageEnd}`
						: ""}
				</span>
			)}
		</div>
	);
}

/** Expanded details section */
function ExpandedDetails({ item }: { item: ExtractedContent }) {
	return (
		<div className="mt-4 ml-7 space-y-4">
			{/* Verbatim text as blockquote */}
			{item.verbatimText && (
				<blockquote className="rounded-r-lg border-primary/30 border-l-2 bg-muted/10 py-3 pr-3 pl-4">
					<p className="text-foreground/90 text-sm italic leading-relaxed">
						{item.verbatimText}
					</p>
				</blockquote>
			)}

			{/* Attribution */}
			{item.attribution && <Attribution attribution={item.attribution} />}

			{/* Context */}
			{item.context && (
				<div className="rounded-lg bg-muted/5 p-4">
					<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Usage Context
					</p>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{item.context}
					</p>
				</div>
			)}

			{/* Details markdown */}
			{item.detailsMarkdown && (
				<div className="rounded-lg bg-muted/5 p-4">
					<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
						Details
					</p>
					<div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-muted-foreground">
						<MessageResponse>{item.detailsMarkdown}</MessageResponse>
					</div>
				</div>
			)}

			{/* Source reference */}
			<div className="pt-2 text-muted-foreground/60 text-xs">
				<span className="font-mono">{getSourceLabel(item.sourceRef)}</span>
			</div>
		</div>
	);
}

/** Attribution display */
function Attribution({
	attribution,
}: {
	attribution: ExtractedContent["attribution"];
}) {
	if (!(attribution && Object.values(attribution).some(Boolean))) {
		return null;
	}

	return (
		<div className="flex items-baseline gap-2 text-sm">
			{attribution.name && (
				<>
					<span className="text-muted-foreground">—</span>
					<span className="font-medium text-foreground">
						{attribution.name}
					</span>
				</>
			)}
			{attribution.role && (
				<span className="text-muted-foreground">({attribution.role})</span>
			)}
			{attribution.work && (
				<span className="text-muted-foreground italic">
					, {attribution.work}
				</span>
			)}
			{attribution.year && (
				<span className="text-muted-foreground/70">({attribution.year})</span>
			)}
		</div>
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
