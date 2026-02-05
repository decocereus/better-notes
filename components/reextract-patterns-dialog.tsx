"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
	type ContentQuality,
	DEFAULT_EXTRACTION_PARAMETERS,
	type ExtractionParameters,
} from "@/types/extraction";
import type { StartExtractionJobInput } from "@/types/processing";

interface ReextractAsset {
	id: string;
	filename: string;
	processingStatus: string;
	sourceType: string;
	ocrWordCount?: number;
	extractedItemCount?: number;
}

type ReextractMode = "all" | "missing" | "single";

interface EssaySummary {
	essayIndex: number;
	essayTitle?: string;
	startPage: number;
	endPage: number;
	wordCount: number;
	itemsExtracted: number;
}

interface EssaysApiResponse {
	assetId: string;
	totalEssays: number;
	missingEssays: number;
	essays: EssaySummary[];
}

interface AssetsApiResponse {
	assets: ReextractAsset[];
}

function getEligibleAssets(assets: ReextractAsset[]): ReextractAsset[] {
	return assets.filter(
		(asset) =>
			asset.sourceType === "pdf" &&
			[
				"ocr_completed",
				"extraction_failed",
				"extraction_completed",
				"extraction_processing",
			].includes(asset.processingStatus)
	);
}

function buildRunParameters({
	saved,
	minQualityThreshold,
}: {
	saved: ExtractionParameters | undefined;
	minQualityThreshold: ContentQuality;
}): ExtractionParameters {
	return {
		...DEFAULT_EXTRACTION_PARAMETERS,
		...saved,
		minQualityThreshold,
	};
}

function validateRun({
	assetId,
	mode,
	essayIndex,
}: {
	assetId: string;
	mode: ReextractMode;
	essayIndex: string;
}): string | null {
	if (!assetId) {
		return "Select an asset to re-extract.";
	}
	if (mode === "single" && !essayIndex) {
		return "Select an essay to re-extract.";
	}
	return null;
}

function buildRunPayload({
	assetId,
	parameters,
	modelConfig,
	mode,
	selectedEssayIndex,
	recomputeBoundaries,
}: {
	assetId: string;
	parameters: ExtractionParameters;
	modelConfig: Record<string, string> | undefined;
	mode: ReextractMode;
	selectedEssayIndex: string;
	recomputeBoundaries: boolean;
}): StartExtractionJobInput {
	const payload: StartExtractionJobInput = {
		assetId,
		parameters,
		modelConfig,
	};

	if (mode === "missing") {
		payload.onlyMissingEssays = true;
	}

	if (mode === "single") {
		payload.essayIndices = [Number.parseInt(selectedEssayIndex, 10)];
	}

	if (mode === "all") {
		payload.recomputeBoundaries = recomputeBoundaries;
	}

	return payload;
}

export function ReextractPatternsDialog({
	open,
	onOpenChange,
	onJobStarted,
	savedExtractionParameters,
	modelConfig,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onJobStarted: (jobId: string) => void;
	savedExtractionParameters: ExtractionParameters | undefined;
	modelConfig: Record<string, string> | undefined;
}) {
	const [assets, setAssets] = useState<ReextractAsset[]>([]);
	const [assetsLoading, setAssetsLoading] = useState(false);
	const [assetsError, setAssetsError] = useState<string | null>(null);

	const [selectedAssetId, setSelectedAssetId] = useState("");
	const [reextractMode, setReextractMode] = useState<ReextractMode>("all");
	const [selectedEssayIndex, setSelectedEssayIndex] = useState("");
	const [recomputeBoundaries, setRecomputeBoundaries] = useState(false);
	const [minQualityThreshold, setMinQualityThreshold] =
		useState<ContentQuality>("low");

	const [essaySummaries, setEssaySummaries] = useState<EssaySummary[]>([]);
	const [essaySummariesLoading, setEssaySummariesLoading] = useState(false);
	const [essaySummariesError, setEssaySummariesError] = useState<string | null>(
		null
	);

	const [isStarting, setIsStarting] = useState(false);

	const eligibleAssets = useMemo(() => getEligibleAssets(assets), [assets]);
	const missingEssayCount = useMemo(
		() =>
			essaySummaries.filter(
				(essay) => essay.itemsExtracted === 0 && essay.wordCount >= 100
			).length,
		[essaySummaries]
	);

	useEffect(() => {
		if (!open) {
			setAssetsError(null);
			setSelectedAssetId("");
			setSelectedEssayIndex("");
			setReextractMode("all");
			setRecomputeBoundaries(false);
			setEssaySummaries([]);
			setEssaySummariesError(null);
			return;
		}

		const controller = new AbortController();

		const loadAssets = async (): Promise<ReextractAsset[]> => {
			const response = await fetch("/api/assets", {
				signal: controller.signal,
			});
			if (!response.ok) {
				throw new Error("Failed to load assets");
			}
			const data = (await response.json()) as AssetsApiResponse;
			return data.assets ?? [];
		};

		setAssetsLoading(true);
		setAssetsError(null);

		loadAssets()
			.then(setAssets)
			.catch((error) => {
				if (error instanceof Error && error.name !== "AbortError") {
					setAssetsError(error.message);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setAssetsLoading(false);
				}
			});

		return () => controller.abort();
	}, [open]);

	useEffect(() => {
		if (!selectedAssetId) {
			setEssaySummaries([]);
			setEssaySummariesError(null);
			return;
		}

		const controller = new AbortController();

		const loadEssays = async (): Promise<EssaysApiResponse> => {
			const response = await fetch(
				`/api/extract/essays?assetId=${encodeURIComponent(selectedAssetId)}`,
				{ signal: controller.signal }
			);
			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? "Failed to load essay summaries");
			}
			return (await response.json()) as EssaysApiResponse;
		};

		setEssaySummariesLoading(true);
		setEssaySummariesError(null);

		loadEssays()
			.then((data) => {
				setEssaySummaries(data.essays ?? []);
				setSelectedEssayIndex("");
				setReextractMode(data.missingEssays > 0 ? "missing" : "all");
			})
			.catch((error) => {
				if (error instanceof Error && error.name !== "AbortError") {
					setEssaySummariesError(error.message);
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) {
					setEssaySummariesLoading(false);
				}
			});

		return () => controller.abort();
	}, [selectedAssetId]);

	const canSubmit = useMemo(() => {
		if (isStarting) {
			return false;
		}
		if (!selectedAssetId) {
			return false;
		}
		if (reextractMode === "single") {
			return Boolean(selectedEssayIndex);
		}
		return true;
	}, [isStarting, reextractMode, selectedAssetId, selectedEssayIndex]);

	const submit = async (): Promise<void> => {
		const validationError = validateRun({
			assetId: selectedAssetId,
			mode: reextractMode,
			essayIndex: selectedEssayIndex,
		});
		if (validationError) {
			setAssetsError(validationError);
			return;
		}

		setIsStarting(true);
		setAssetsError(null);

		try {
			const parameters = buildRunParameters({
				saved: savedExtractionParameters,
				minQualityThreshold,
			});

			const payload = buildRunPayload({
				assetId: selectedAssetId,
				parameters,
				modelConfig,
				mode: reextractMode,
				selectedEssayIndex,
				recomputeBoundaries,
			});

			const response = await fetch("/api/extract", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const data = (await response.json()) as { error?: string };
				throw new Error(data.error ?? "Failed to start re-extraction");
			}

			const data = (await response.json()) as { jobId?: string };
			if (data.jobId) {
				onJobStarted(data.jobId);
			}

			onOpenChange(false);
		} catch (error) {
			setAssetsError(
				error instanceof Error ? error.message : "Failed to start re-extraction"
			);
		} finally {
			setIsStarting(false);
		}
	};

	const handleSubmit = (): void => {
		submit().catch(() => {
			// submit() handles errors internally.
		});
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Re-extract patterns</DialogTitle>
					<DialogDescription>
						Choose a PDF with OCR results, then rerun extraction.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<Select onValueChange={setSelectedAssetId} value={selectedAssetId}>
						<SelectTrigger>
							<SelectValue placeholder="Select an asset" />
						</SelectTrigger>
						<SelectContent>
							{eligibleAssets.map((asset) => (
								<SelectItem key={asset.id} value={asset.id}>
									{asset.filename}
								</SelectItem>
							))}
							{eligibleAssets.length === 0 && (
								<SelectItem disabled value="none">
									No eligible assets
								</SelectItem>
							)}
						</SelectContent>
					</Select>

					<div className="space-y-2">
						<p className="text-muted-foreground text-xs">What to re-extract</p>
						<Select
							onValueChange={(value) =>
								setReextractMode(value as ReextractMode)
							}
							value={reextractMode}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select scope" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All essays</SelectItem>
								<SelectItem
									disabled={!selectedAssetId || essaySummaries.length === 0}
									value="missing"
								>
									Only missing essays (0 patterns)
								</SelectItem>
								<SelectItem
									disabled={!selectedAssetId || essaySummaries.length === 0}
									value="single"
								>
									One essay
								</SelectItem>
							</SelectContent>
						</Select>

						{reextractMode === "missing" && essaySummaries.length > 0 && (
							<p className="text-muted-foreground text-xs">
								Will re-extract {missingEssayCount} essays with 0 extracted
								items.
							</p>
						)}

						{reextractMode !== "all" && (
							<p className="text-muted-foreground text-xs">
								Uses stored essay boundaries to avoid re-detection.
							</p>
						)}
					</div>

					{reextractMode === "single" && (
						<div className="space-y-2">
							<p className="text-muted-foreground text-xs">
								Select essay to re-extract
							</p>
							<Select
								disabled={!selectedAssetId || essaySummaries.length === 0}
								onValueChange={setSelectedEssayIndex}
								value={selectedEssayIndex}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select an essay" />
								</SelectTrigger>
								<SelectContent>
									{essaySummaries.map((essay) => {
										const label = essay.essayTitle
											? essay.essayTitle
											: `Essay #${essay.essayIndex}`;
										return (
											<SelectItem
												key={essay.essayIndex}
												value={String(essay.essayIndex)}
											>
												{label} (pp. {essay.startPage}-{essay.endPage}){" "}
												{essay.itemsExtracted === 0 ? "• missing" : ""}
											</SelectItem>
										);
									})}
									{essaySummaries.length === 0 && (
										<SelectItem disabled value="none">
											No essays found
										</SelectItem>
									)}
								</SelectContent>
							</Select>
						</div>
					)}

					{reextractMode === "all" && (
						<div className="flex items-center justify-between rounded-lg border px-3 py-2">
							<div>
								<p className="font-medium text-sm">
									Recompute essay boundaries
								</p>
								<p className="text-muted-foreground text-xs">
									Slower, but can fix bad essay splits.
								</p>
							</div>
							<Switch
								aria-label="Recompute essay boundaries"
								checked={recomputeBoundaries}
								onCheckedChange={setRecomputeBoundaries}
							/>
						</div>
					)}

					<div className="space-y-2">
						<p className="text-muted-foreground text-xs">
							Minimum quality for this re-extract
						</p>
						<Select
							onValueChange={(value) =>
								setMinQualityThreshold(value as ContentQuality)
							}
							value={minQualityThreshold}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select quality threshold" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="low">Low (backfill everything)</SelectItem>
								<SelectItem value="medium">Medium</SelectItem>
								<SelectItem value="high">High</SelectItem>
							</SelectContent>
						</Select>
						<p className="text-muted-foreground text-xs">
							This only affects this run and won’t change your saved settings.
						</p>
					</div>

					{assetsLoading && (
						<p className="text-muted-foreground text-sm">Loading assets...</p>
					)}
					{assetsError && (
						<p className="text-destructive text-sm">{assetsError}</p>
					)}
					{selectedAssetId && essaySummariesLoading && (
						<p className="text-muted-foreground text-sm">
							Loading essay summaries...
						</p>
					)}
					{selectedAssetId && essaySummariesError && (
						<p className="text-destructive text-sm">{essaySummariesError}</p>
					)}
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button disabled={!canSubmit} onClick={handleSubmit}>
						{isStarting ? "Starting..." : "Re-extract"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
