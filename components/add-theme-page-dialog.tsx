"use client";

import { useMutation } from "convex/react";
import { AlertCircle, BookOpen, Check, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { NotionPageSearch } from "@/components/notion-page-search";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface ThemeData {
	themes: unknown[];
	pageTitle: string;
	pageId: string;
	stats: {
		totalMainThemes: number;
		totalMiniThemes: number;
		totalQuestions: number;
		yearRange?: { min: number; max: number };
	};
}

interface AddThemePageDialogProps {
	/** Trigger element - if not provided, dialog is controlled via open/onOpenChange */
	trigger?: React.ReactNode;
	/** Controlled open state */
	open?: boolean;
	/** Controlled open change handler */
	onOpenChange?: (open: boolean) => void;
	/** Callback when theme page is successfully added */
	onThemePageAdded?: (id: Id<"themePages">) => void;
}

type Step = "search" | "parsing" | "confirm" | "saving";

/**
 * Dialog for adding a new theme page from Notion.
 * Handles search, parsing, duplicate prevention, and saving to Convex.
 * Can be used with a trigger element or controlled via open/onOpenChange props.
 */
export function AddThemePageDialog({
	trigger,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	onThemePageAdded,
}: AddThemePageDialogProps) {
	const createThemePage = useMutation(api.themePages.create);

	const [internalOpen, setInternalOpen] = useState(false);
	const [step, setStep] = useState<Step>("search");
	const [selectedPage, setSelectedPage] = useState<{
		id: string;
		title: string;
	} | null>(null);
	const [themeData, setThemeData] = useState<ThemeData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [existingPageTitle, setExistingPageTitle] = useState<string | null>(
		null
	);

	// Use controlled or internal state
	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;

	const resetDialog = useCallback(() => {
		setStep("search");
		setSelectedPage(null);
		setThemeData(null);
		setError(null);
		setExistingPageTitle(null);
	}, []);

	const handleOpenChange = useCallback(
		(newOpen: boolean) => {
			if (isControlled) {
				controlledOnOpenChange?.(newOpen);
			} else {
				setInternalOpen(newOpen);
			}
			if (!newOpen) {
				resetDialog();
			}
		},
		[isControlled, controlledOnOpenChange, resetDialog]
	);

	const handlePageSelect = useCallback(
		async (pageId: string, pageTitle: string) => {
			setSelectedPage({ id: pageId, title: pageTitle });
			setError(null);
			setExistingPageTitle(null);
			setStep("parsing");

			try {
				// Check for duplicate first
				const duplicateCheck = await fetch(
					`/api/notion/check-duplicate?pageId=${pageId}`
				);
				if (duplicateCheck.ok) {
					const duplicateData = (await duplicateCheck.json()) as {
						exists: boolean;
						title?: string;
					};
					if (duplicateData.exists) {
						setExistingPageTitle(duplicateData.title ?? pageTitle);
						setStep("search");
						return;
					}
				}

				// Parse the theme page
				const response = await fetch("/api/themes", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ pageId }),
				});

				if (!response.ok) {
					const errorData = (await response.json()) as { error: string };
					throw new Error(errorData.error || "Failed to parse theme page");
				}

				const data = (await response.json()) as ThemeData;
				setThemeData(data);
				setStep("confirm");
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to parse themes");
				setStep("search");
			}
		},
		[]
	);

	const handleConfirmAdd = useCallback(async () => {
		if (!(themeData && selectedPage)) {
			return;
		}

		setStep("saving");
		setError(null);

		try {
			const themePageId = await createThemePage({
				notionPageId: selectedPage.id,
				title: themeData.pageTitle,
				themes: themeData.themes,
				stats: {
					mainThemes: themeData.stats.totalMainThemes,
					miniThemes: themeData.stats.totalMiniThemes,
					questions: themeData.stats.totalQuestions,
					yearRange: themeData.stats.yearRange,
				},
			});

			onThemePageAdded?.(themePageId);
			handleOpenChange(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save theme page"
			);
			setStep("confirm");
		}
	}, [
		themeData,
		selectedPage,
		createThemePage,
		onThemePageAdded,
		handleOpenChange,
	]);

	const dialogContent = (
		<DialogContent className="sm:max-w-lg">
			<DialogHeader>
				<DialogTitle>Add Theme Page</DialogTitle>
				<DialogDescription>
					Search for a Notion page containing your theme hierarchy.
				</DialogDescription>
			</DialogHeader>

			<div className="space-y-4 py-4">
				{/* Step: Search */}
				{step === "search" && (
					<>
						<div className="relative">
							<NotionPageSearch
								onError={setError}
								onSelect={handlePageSelect}
								placeholder="Search for a theme page..."
							/>
						</div>

						{existingPageTitle && (
							<Alert>
								<AlertCircle className="size-4" />
								<AlertTitle>Already Added</AlertTitle>
								<AlertDescription>
									This Notion page is already added as "{existingPageTitle}".
								</AlertDescription>
							</Alert>
						)}

						{error && (
							<Alert variant="destructive">
								<AlertCircle className="size-4" />
								<AlertTitle>Error</AlertTitle>
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
					</>
				)}

				{/* Step: Parsing */}
				{step === "parsing" && (
					<div className="flex flex-col items-center justify-center py-8">
						<Loader2 className="mb-4 size-8 animate-spin text-primary" />
						<p className="font-medium">Parsing Theme Page</p>
						<p className="text-muted-foreground text-sm">
							{selectedPage?.title}
						</p>
					</div>
				)}

				{/* Step: Confirm */}
				{step === "confirm" && themeData && (
					<div className="space-y-4">
						<div className="flex items-start gap-3 rounded-lg border p-4">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
								<BookOpen className="size-5 text-primary" />
							</div>
							<div className="min-w-0 flex-1">
								<h4 className="truncate font-medium">{themeData.pageTitle}</h4>
								<p className="text-muted-foreground text-sm">
									{themeData.stats.totalMainThemes} main themes ·{" "}
									{themeData.stats.totalMiniThemes} mini themes ·{" "}
									{themeData.stats.totalQuestions} questions
								</p>
								{themeData.stats.yearRange && (
									<p className="text-muted-foreground text-xs">
										Year range: {themeData.stats.yearRange.min}-
										{themeData.stats.yearRange.max}
									</p>
								)}
							</div>
							<Check className="size-5 text-green-500" />
						</div>

						{error && (
							<Alert variant="destructive">
								<AlertCircle className="size-4" />
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
					</div>
				)}

				{/* Step: Saving */}
				{step === "saving" && (
					<div className="flex flex-col items-center justify-center py-8">
						<Loader2 className="mb-4 size-8 animate-spin text-primary" />
						<p className="font-medium">Saving Theme Page</p>
					</div>
				)}
			</div>

			<DialogFooter>
				{step === "search" && (
					<Button onClick={() => handleOpenChange(false)} variant="outline">
						Cancel
					</Button>
				)}

				{step === "confirm" && (
					<>
						<Button onClick={resetDialog} variant="outline">
							Choose Different Page
						</Button>
						<Button onClick={handleConfirmAdd}>Add Theme Page</Button>
					</>
				)}
			</DialogFooter>
		</DialogContent>
	);

	// If trigger is provided, use DialogTrigger pattern
	if (trigger) {
		return (
			<Dialog onOpenChange={handleOpenChange} open={open}>
				<DialogTrigger asChild>{trigger}</DialogTrigger>
				{dialogContent}
			</Dialog>
		);
	}

	// Otherwise, return controlled dialog without trigger
	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			{dialogContent}
		</Dialog>
	);
}
