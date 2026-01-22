"use client";

import { Database, FileText, Loader2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";
import type { SearchResultItem } from "@/lib/notion/types";

const STORAGE_KEY = "betternotes:notion-api-key";
const DEBOUNCE_MS = 300;

interface NotionPageSearchProps {
	/** Called when a page is selected */
	onSelect: (item: SearchResultItem) => void;
	/** Placeholder text for the search input */
	placeholder?: string;
	/** Optional class name for the container */
	className?: string;
	/** Optional API key override (uses localStorage if not provided) */
	apiKey?: string;
	/** Optional error callback */
	onError?: (error: string) => void;
}

/**
 * Search input with results dropdown for finding Notion pages.
 * Uses debounced search and displays results in a dropdown.
 */
export function NotionPageSearch({
	onSelect,
	placeholder = "Search Notion pages...",
	className,
	apiKey: apiKeyProp,
	onError,
}: NotionPageSearchProps) {
	const [storedApiKey] = useLocalStorage(STORAGE_KEY, "");
	const apiKey = apiKeyProp ?? storedApiKey;
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResultItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [selectedIndex, setSelectedIndex] = useState(-1);

	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Debounced search
	useEffect(() => {
		if (!(query.trim() && apiKey)) {
			setResults([]);
			setIsOpen(false);
			return;
		}

		const timeoutId = setTimeout(async () => {
			setIsLoading(true);
			setError(null);

			try {
				const response = await fetch("/api/notion/search", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ apiKey, query }),
				});

				const data = (await response.json()) as {
					results?: SearchResultItem[];
					error?: string;
				};

				if (data.error) {
					setError(data.error);
					onError?.(data.error);
					setResults([]);
				} else {
					setResults(data.results ?? []);
					setIsOpen(true);
				}
			} catch (err) {
				const errorMessage =
					err instanceof Error ? err.message : "Search failed";
				setError(errorMessage);
				onError?.(errorMessage);
				setResults([]);
			} finally {
				setIsLoading(false);
			}
		}, DEBOUNCE_MS);

		return () => clearTimeout(timeoutId);
	}, [query, apiKey, onError]);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSelect = useCallback(
		(item: SearchResultItem) => {
			onSelect(item);
			setQuery("");
			setResults([]);
			setIsOpen(false);
			setSelectedIndex(-1);
		},
		[onSelect]
	);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (!isOpen || results.length === 0) {
				return;
			}

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev < results.length - 1 ? prev + 1 : prev
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
					break;
				case "Enter":
					e.preventDefault();
					if (selectedIndex >= 0 && selectedIndex < results.length) {
						handleSelect(results[selectedIndex]);
					}
					break;
				case "Escape":
					setIsOpen(false);
					setSelectedIndex(-1);
					break;
				default:
					// Other keys are handled by the input element
					break;
			}
		},
		[isOpen, results, selectedIndex, handleSelect]
	);

	const showNoConnection = useMemo(() => !apiKey, [apiKey]);

	if (showNoConnection) {
		return (
			<div className={className}>
				<div className="relative">
					<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="pl-9"
						disabled
						placeholder="Connect Notion first..."
					/>
				</div>
				<p className="mt-1 text-muted-foreground text-xs">
					Connect your Notion account in Settings to search pages.
				</p>
			</div>
		);
	}

	return (
		<div className={className} ref={containerRef}>
			<div className="relative">
				<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					className="pr-9 pl-9"
					onChange={(e) => setQuery(e.target.value)}
					onFocus={() => {
						if (results.length > 0) {
							setIsOpen(true);
						}
					}}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					ref={inputRef}
					type="text"
					value={query}
				/>
				{isLoading && (
					<Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
				)}
			</div>

			{/* Error message */}
			{error && <p className="mt-1 text-destructive text-xs">{error}</p>}

			{/* Results dropdown */}
			{isOpen && results.length > 0 && (
				<div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
					{results.map((item, index) => (
						<button
							className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted ${
								index === selectedIndex ? "bg-muted" : ""
							}`}
							key={item.id}
							onClick={() => handleSelect(item)}
							type="button"
						>
							<span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-sm">
								{item.icon ??
									(item.type === "database" ? (
										<Database className="size-4 text-muted-foreground" />
									) : (
										<FileText className="size-4 text-muted-foreground" />
									))}
							</span>
							<span className="flex-1 truncate text-sm">{item.title}</span>
							<span className="text-muted-foreground text-xs capitalize">
								{item.type}
							</span>
						</button>
					))}
				</div>
			)}

			{/* Empty state */}
			{isOpen &&
				!isLoading &&
				query.trim() &&
				results.length === 0 &&
				!error && (
					<div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover p-4 text-center shadow-md">
						<p className="text-muted-foreground text-sm">No pages found</p>
					</div>
				)}
		</div>
	);
}
