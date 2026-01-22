"use client";

import {
	ArrowLeft,
	CheckCircle,
	FileText,
	Loader2,
	RotateCcw,
	Save,
	X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { NotionPageSearch } from "@/components/notion-page-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/lib/hooks/use-settings";
import type {
	ContentQuality,
	ExampleCategory,
	ExtractionParameters,
} from "@/types/extraction";
import { DEFAULT_EXTRACTION_PARAMETERS } from "@/types/extraction";

/**
 * All example categories with display names.
 */
const EXAMPLE_CATEGORIES: { value: ExampleCategory; label: string }[] = [
	{ value: "individual", label: "Individual" },
	{ value: "ethical", label: "Ethical" },
	{ value: "governance", label: "Governance" },
	{ value: "societal", label: "Societal" },
	{ value: "environment", label: "Environment" },
	{ value: "mythological", label: "Mythological" },
	{ value: "sports", label: "Sports" },
	{ value: "religion", label: "Religion" },
	{ value: "business", label: "Business" },
	{ value: "international_relations", label: "International Relations" },
	{ value: "science_tech", label: "Science & Tech" },
];

/**
 * Parameters page content - configures strategy document and extraction parameters.
 */
export function ParametersContent() {
	const { settings, isHydrated, updateSettings, isNotionConnected } =
		useSettings();
	const [isCheckingConnection, setIsCheckingConnection] = useState(true);
	const [isConnected, setIsConnected] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [newOverusedItem, setNewOverusedItem] = useState("");

	// Local state for parameters (to avoid constant updates)
	const [localParams, setLocalParams] = useState<ExtractionParameters>(
		settings.extractionParameters || DEFAULT_EXTRACTION_PARAMETERS
	);

	// Sync local params when settings load
	useEffect(() => {
		if (settings.extractionParameters) {
			setLocalParams(settings.extractionParameters);
		}
	}, [settings.extractionParameters]);

	// Check actual connection status via API (handles env variable)
	useEffect(() => {
		async function checkConnection() {
			try {
				const response = await fetch("/api/notion/connect", { method: "GET" });
				const data = (await response.json()) as { valid: boolean };
				setIsConnected(data.valid);
			} catch {
				setIsConnected(false);
			} finally {
				setIsCheckingConnection(false);
			}
		}

		checkConnection();
	}, []);

	const handleSelectStrategyPage = (pageId: string, _pageTitle: string) => {
		updateSettings({
			strategyPageId: pageId,
		});
	};

	const handleClearStrategyPage = () => {
		updateSettings({
			strategyPageId: undefined,
		});
	};

	const handleSaveParameters = () => {
		setIsSaving(true);
		updateSettings({
			extractionParameters: localParams,
		});
		setTimeout(() => setIsSaving(false), 500);
	};

	const handleResetToDefaults = () => {
		setLocalParams(DEFAULT_EXTRACTION_PARAMETERS);
	};

	const toggleCategory = (category: ExampleCategory) => {
		const current = localParams.enabledCategories;
		const newCategories = current.includes(category)
			? current.filter((c) => c !== category)
			: [...current, category];

		// Ensure at least one category is enabled
		if (newCategories.length > 0) {
			setLocalParams({ ...localParams, enabledCategories: newCategories });
		}
	};

	const addOverusedItem = () => {
		const trimmed = newOverusedItem.trim().toLowerCase();
		if (trimmed && !localParams.overusedExamples.includes(trimmed)) {
			setLocalParams({
				...localParams,
				overusedExamples: [...localParams.overusedExamples, trimmed],
			});
			setNewOverusedItem("");
		}
	};

	const removeOverusedItem = (item: string) => {
		setLocalParams({
			...localParams,
			overusedExamples: localParams.overusedExamples.filter((i) => i !== item),
		});
	};

	// Combine API check with localStorage check
	const notionReady = isConnected || isNotionConnected;

	if (!isHydrated || isCheckingConnection) {
		return (
			<div className="flex items-center justify-center p-12">
				<Loader2 className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/settings">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="font-semibold text-2xl">Extraction Parameters</h2>
					<p className="text-muted-foreground">
						Configure how content is extracted and analyzed
					</p>
				</div>
				<Button onClick={handleResetToDefaults} variant="outline">
					<RotateCcw className="size-4" />
					Reset to Defaults
				</Button>
				<Button disabled={isSaving} onClick={handleSaveParameters}>
					{isSaving ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Save className="size-4" />
					)}
					Save Changes
				</Button>
			</div>

			{/* Strategy Document */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Strategy Document</h3>
				<p className="text-muted-foreground text-sm">
					Link a Notion page containing your strategy document. Parameters will
					be extracted automatically.
				</p>

				<div className="mt-4">
					<StrategyDocumentSection
						notionReady={notionReady}
						onClear={handleClearStrategyPage}
						onSelect={handleSelectStrategyPage}
						strategyPageId={settings.strategyPageId}
					/>
				</div>
			</Card>

			{/* Example Categories */}
			<Card className="p-6">
				<h3 className="mb-2 font-medium text-lg">Example Categories</h3>
				<p className="mb-4 text-muted-foreground text-sm">
					Select which types of examples to extract from essays.
				</p>

				<div className="flex flex-wrap gap-2">
					{EXAMPLE_CATEGORIES.map((cat) => {
						const isEnabled = localParams.enabledCategories.includes(cat.value);
						return (
							<Badge
								className="cursor-pointer transition-colors"
								key={cat.value}
								onClick={() => toggleCategory(cat.value)}
								variant={isEnabled ? "default" : "outline"}
							>
								{cat.label}
							</Badge>
						);
					})}
				</div>
				<p className="mt-2 text-muted-foreground text-xs">
					{localParams.enabledCategories.length} of {EXAMPLE_CATEGORIES.length}{" "}
					categories enabled
				</p>
			</Card>

			{/* Thinker & Quote Preferences */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">
					Thinker & Quote Preferences
				</h3>

				<div className="grid gap-6 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="thinker-priority">Thinker Priority</Label>
						<Select
							onValueChange={(value) =>
								setLocalParams({
									...localParams,
									thinkerPriority:
										value as ExtractionParameters["thinkerPriority"],
								})
							}
							value={localParams.thinkerPriority}
						>
							<SelectTrigger id="thinker-priority">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="balanced">
									Balanced (Indian & Western)
								</SelectItem>
								<SelectItem value="indian">
									Prioritize Indian Thinkers
								</SelectItem>
								<SelectItem value="western">
									Prioritize Western Thinkers
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							Which thinkers to prioritize during extraction
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="quote-style">Quote Style</Label>
						<Select
							onValueChange={(value) =>
								setLocalParams({
									...localParams,
									quoteStyle: value as ExtractionParameters["quoteStyle"],
								})
							}
							value={localParams.quoteStyle}
						>
							<SelectTrigger id="quote-style">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="multi_use_preferred">
									Prefer Multi-Use Quotes
								</SelectItem>
								<SelectItem value="theme_specific">
									Theme-Specific Quotes
								</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							Preference for universally applicable vs. theme-specific quotes
						</p>
					</div>
				</div>
			</Card>

			{/* Quality & Filtering */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Quality & Filtering</h3>

				<div className="grid gap-6 md:grid-cols-2">
					<div className="space-y-2">
						<Label htmlFor="quality-threshold">Minimum Quality Threshold</Label>
						<Select
							onValueChange={(value) =>
								setLocalParams({
									...localParams,
									minQualityThreshold: value as ContentQuality,
								})
							}
							value={localParams.minQualityThreshold}
						>
							<SelectTrigger id="quality-threshold">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="high">High Only</SelectItem>
								<SelectItem value="medium">Medium & Above</SelectItem>
								<SelectItem value="low">Include All</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							Minimum quality level for extracted content
						</p>
					</div>

					<div className="space-y-2">
						<Label>Cross-Theme References</Label>
						<div className="flex items-center gap-2">
							<Button
								onClick={() =>
									setLocalParams({
										...localParams,
										extractCrossThemeRefs: !localParams.extractCrossThemeRefs,
									})
								}
								size="sm"
								variant={
									localParams.extractCrossThemeRefs ? "default" : "outline"
								}
							>
								{localParams.extractCrossThemeRefs ? "Enabled" : "Disabled"}
							</Button>
						</div>
						<p className="text-muted-foreground text-xs">
							Extract content that applies across multiple themes
						</p>
					</div>
				</div>
			</Card>

			{/* Overused Examples */}
			<Card className="p-6">
				<h3 className="mb-2 font-medium text-lg">Overused Examples</h3>
				<p className="mb-4 text-muted-foreground text-sm">
					These examples will be flagged during extraction. Add commonly
					overused references to avoid repetitive content.
				</p>

				<div className="mb-4 flex flex-wrap gap-2">
					{localParams.overusedExamples.map((item) => (
						<Badge className="gap-1 pr-1" key={item} variant="secondary">
							{item}
							<button
								className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
								onClick={() => removeOverusedItem(item)}
								type="button"
							>
								<X className="size-3" />
							</button>
						</Badge>
					))}
				</div>

				<div className="flex gap-2">
					<Input
						className="max-w-xs"
						onChange={(e) => setNewOverusedItem(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								addOverusedItem();
							}
						}}
						placeholder="Add overused example..."
						value={newOverusedItem}
					/>
					<Button onClick={addOverusedItem} variant="outline">
						Add
					</Button>
				</div>
			</Card>
		</div>
	);
}

interface StrategyDocumentSectionProps {
	notionReady: boolean;
	strategyPageId: string | undefined;
	onClear: () => void;
	onSelect: (pageId: string, pageTitle: string) => void;
}

function StrategyDocumentSection({
	notionReady,
	strategyPageId,
	onClear,
	onSelect,
}: StrategyDocumentSectionProps) {
	if (!notionReady) {
		return (
			<div className="flex flex-col items-center justify-center rounded-md border-2 border-border border-dashed p-8 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<FileText className="size-8 text-muted-foreground" />
				</div>
				<p className="font-medium">No strategy document linked</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Connect Notion first to link a strategy document
				</p>
				<Link href="/settings">
					<Button className="mt-4" variant="outline">
						Configure Notion
					</Button>
				</Link>
			</div>
		);
	}

	if (strategyPageId) {
		return (
			<div className="space-y-4">
				<div className="flex items-center gap-3 rounded-md bg-green-500/10 p-4">
					<CheckCircle className="size-5 text-green-600" />
					<div className="flex-1">
						<p className="font-medium text-green-800 dark:text-green-200">
							Strategy document linked
						</p>
						<p className="text-green-700 text-sm dark:text-green-300">
							Page ID: {strategyPageId}
						</p>
					</div>
					<Button onClick={onClear} size="sm" variant="outline">
						Change
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<p className="font-medium text-sm">Select a Notion page:</p>
			<NotionPageSearch
				onSelect={onSelect}
				placeholder="Search for strategy document..."
			/>
		</div>
	);
}
