"use client";

import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	Copy,
	Download,
	FileText,
	Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OcrJobResults, OcrPageResult } from "@/types";

interface OcrViewerProps {
	/** OCR results to display */
	results: OcrJobResults;
	/** Custom class name */
	className?: string;
}

export function OcrViewer({ results, className }: OcrViewerProps) {
	const [currentPage, setCurrentPage] = useState(1);
	const [viewMode, setViewMode] = useState<"page" | "full">("page");
	const [searchQuery, setSearchQuery] = useState("");
	const [copied, setCopied] = useState(false);

	const currentPageData = useMemo(() => {
		return results.pages.find((p) => p.pageNumber === currentPage);
	}, [results.pages, currentPage]);

	const filteredPages = useMemo(() => {
		if (!searchQuery) {
			return results.pages;
		}
		const query = searchQuery.toLowerCase();
		return results.pages.filter((p) => p.text.toLowerCase().includes(query));
	}, [results.pages, searchQuery]);

	const handleCopy = useCallback(async () => {
		const textToCopy =
			viewMode === "full"
				? results.combinedText
				: (currentPageData?.text ?? "");

		await navigator.clipboard.writeText(textToCopy);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [viewMode, results.combinedText, currentPageData?.text]);

	const handleDownload = useCallback(() => {
		const blob = new Blob([results.combinedText], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `ocr-results-${results.jobId}.txt`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}, [results.combinedText, results.jobId]);

	const goToPage = useCallback(
		(page: number) => {
			setCurrentPage(Math.max(1, Math.min(page, results.totalPages)));
		},
		[results.totalPages]
	);

	return (
		<div className={cn("flex flex-col rounded-lg border", className)}>
			{/* Header */}
			<div className="flex items-center justify-between border-b p-4">
				<div className="flex items-center gap-3">
					<FileText className="size-5 text-muted-foreground" />
					<div>
						<h3 className="font-medium">OCR Results</h3>
						<p className="text-muted-foreground text-sm">
							{results.totalPages} pages •{" "}
							{results.totalWordCount.toLocaleString()} words •{" "}
							{Math.round(results.averageConfidence * 100)}% confidence
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{/* View mode toggle */}
					<div className="flex rounded-md border">
						<button
							className={cn(
								"px-3 py-1.5 text-sm transition-colors",
								viewMode === "page"
									? "bg-primary text-primary-foreground"
									: "hover:bg-muted"
							)}
							onClick={() => setViewMode("page")}
							type="button"
						>
							Page
						</button>
						<button
							className={cn(
								"px-3 py-1.5 text-sm transition-colors",
								viewMode === "full"
									? "bg-primary text-primary-foreground"
									: "hover:bg-muted"
							)}
							onClick={() => setViewMode("full")}
							type="button"
						>
							Full
						</button>
					</div>

					<Button onClick={handleCopy} size="sm" variant="outline">
						<Copy className="mr-1.5 size-4" />
						{copied ? "Copied!" : "Copy"}
					</Button>

					<Button onClick={handleDownload} size="sm" variant="outline">
						<Download className="mr-1.5 size-4" />
						Download
					</Button>
				</div>
			</div>

			{/* Search bar (for page view) */}
			{viewMode === "page" && (
				<div className="border-b p-3">
					<div className="relative">
						<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<input
							className="h-9 w-full rounded-md border bg-background pr-3 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search in OCR results..."
							type="text"
							value={searchQuery}
						/>
					</div>
					{searchQuery && (
						<p className="mt-2 text-muted-foreground text-xs">
							Found in {filteredPages.length} of {results.totalPages} pages
						</p>
					)}
				</div>
			)}

			{/* Content */}
			<div className="flex-1 overflow-auto p-4">
				{viewMode === "page" ? (
					<PageView
						pageData={currentPageData}
						pageNumber={currentPage}
						searchQuery={searchQuery}
					/>
				) : (
					<FullView searchQuery={searchQuery} text={results.combinedText} />
				)}
			</div>

			{/* Pagination (for page view) */}
			{viewMode === "page" && (
				<div className="flex items-center justify-between border-t p-3">
					<div className="flex items-center gap-1">
						<Button
							disabled={currentPage === 1}
							onClick={() => goToPage(1)}
							size="sm"
							variant="ghost"
						>
							<ChevronsLeft className="size-4" />
						</Button>
						<Button
							disabled={currentPage === 1}
							onClick={() => goToPage(currentPage - 1)}
							size="sm"
							variant="ghost"
						>
							<ChevronLeft className="size-4" />
						</Button>
					</div>

					<div className="flex items-center gap-2">
						<span className="text-muted-foreground text-sm">Page</span>
						<input
							className="h-8 w-16 rounded-md border bg-background text-center text-sm"
							max={results.totalPages}
							min={1}
							onChange={(e) =>
								goToPage(Number.parseInt(e.target.value, 10) || 1)
							}
							type="number"
							value={currentPage}
						/>
						<span className="text-muted-foreground text-sm">
							of {results.totalPages}
						</span>
					</div>

					<div className="flex items-center gap-1">
						<Button
							disabled={currentPage === results.totalPages}
							onClick={() => goToPage(currentPage + 1)}
							size="sm"
							variant="ghost"
						>
							<ChevronRight className="size-4" />
						</Button>
						<Button
							disabled={currentPage === results.totalPages}
							onClick={() => goToPage(results.totalPages)}
							size="sm"
							variant="ghost"
						>
							<ChevronsRight className="size-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

interface PageViewProps {
	pageData: OcrPageResult | undefined;
	pageNumber: number;
	searchQuery: string;
}

function PageView({ pageData, pageNumber, searchQuery }: PageViewProps) {
	if (!pageData) {
		return (
			<div className="flex h-64 items-center justify-center text-muted-foreground">
				No data for page {pageNumber}
			</div>
		);
	}

	return (
		<div className="space-y-3">
			{/* Page stats */}
			<div className="flex items-center gap-4 text-muted-foreground text-xs">
				<span>{pageData.wordCount} words</span>
				<span>{Math.round(pageData.confidence * 100)}% confidence</span>
				{pageData.hasHandwriting && (
					<span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
						Handwritten
					</span>
				)}
			</div>

			{/* Text content */}
			<div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-sm leading-relaxed">
				{searchQuery ? (
					<HighlightedText query={searchQuery} text={pageData.text} />
				) : (
					pageData.text
				)}
			</div>
		</div>
	);
}

interface FullViewProps {
	text: string;
	searchQuery: string;
}

function FullView({ text, searchQuery }: FullViewProps) {
	return (
		<div className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-sm leading-relaxed">
			{searchQuery ? <HighlightedText query={searchQuery} text={text} /> : text}
		</div>
	);
}

interface HighlightedTextProps {
	text: string;
	query: string;
}

function HighlightedText({ text, query }: HighlightedTextProps) {
	if (!query) {
		return <>{text}</>;
	}

	const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"));

	return (
		<>
			{parts.map((part, index) =>
				part.toLowerCase() === query.toLowerCase() ? (
					<mark
						className="rounded bg-yellow-200 px-0.5"
						key={`highlight-${index}-${part.slice(0, 10)}`}
					>
						{part}
					</mark>
				) : (
					<span key={`text-${index}-${part.slice(0, 10)}`}>{part}</span>
				)
			)}
		</>
	);
}

function escapeRegex(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
