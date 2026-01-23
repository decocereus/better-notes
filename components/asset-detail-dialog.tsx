"use client";

import { ExternalLink, FileText, ImageIcon, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatFileSize } from "@/lib/constants/upload";
import type { Asset, ExtractionResultMetadata } from "@/types/asset";
import { ProcessingStatusBadge } from "./processing-status-badge";

interface AssetDetailDialogProps {
	assetId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

interface AssetDetailData {
	asset: Asset;
	previewUrl?: string;
	extractionResult?: ExtractionResultMetadata;
}

export function AssetDetailDialog({
	assetId,
	open,
	onOpenChange,
}: AssetDetailDialogProps) {
	const [data, setData] = useState<AssetDetailData | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!(assetId && open)) {
			return;
		}

		const fetchAsset = async () => {
			setIsLoading(true);
			setError(null);

			try {
				const response = await fetch(`/api/assets/${assetId}`);
				if (!response.ok) {
					throw new Error("Failed to fetch asset");
				}
				const assetData = await response.json();
				setData(assetData);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load asset");
			} finally {
				setIsLoading(false);
			}
		};

		fetchAsset();
	}, [assetId, open]);

	const asset = data?.asset;

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						{asset?.sourceType === "pdf" ? (
							<FileText className="size-5 text-red-500" />
						) : (
							<ImageIcon className="size-5 text-blue-500" />
						)}
						<span className="truncate">{asset?.filename || "Loading..."}</span>
					</DialogTitle>
					<DialogDescription>
						Asset details and processing status
					</DialogDescription>
				</DialogHeader>

				{isLoading && (
					<div className="flex items-center justify-center py-8">
						<Loader2 className="size-8 animate-spin text-muted-foreground" />
					</div>
				)}

				{error && (
					<div className="rounded-lg bg-destructive/10 p-4 text-center text-destructive">
						{error}
					</div>
				)}

				{asset && !isLoading && (
					<div className="space-y-6">
						{/* Preview */}
						{data?.previewUrl && (
							<div className="overflow-hidden rounded-lg border">
								{asset.sourceType === "image" ? (
									<Image
										alt={asset.filename}
										className="h-auto w-full"
										height={400}
										src={data.previewUrl}
										width={600}
									/>
								) : (
									<div className="bg-muted p-6 text-center">
										<FileText className="mx-auto mb-2 size-12 text-muted-foreground" />
										<p className="text-muted-foreground text-sm">PDF Preview</p>
										<Button
											asChild
											className="mt-2"
											size="sm"
											variant="outline"
										>
											<a
												href={data.previewUrl}
												rel="noopener noreferrer"
												target="_blank"
											>
												<ExternalLink className="mr-2 size-4" />
												Open PDF
											</a>
										</Button>
									</div>
								)}
							</div>
						)}

						{/* File Info */}
						<div className="grid grid-cols-2 gap-4 text-sm">
							<div>
								<p className="text-muted-foreground">Size</p>
								<p className="font-medium">{formatFileSize(asset.size)}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Type</p>
								<p className="font-medium">{asset.mimeType}</p>
							</div>
							<div>
								<p className="text-muted-foreground">Uploaded</p>
								<p className="font-medium">
									{new Date(asset.uploadedAt).toLocaleString()}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground">Status</p>
								<ProcessingStatusBadge status={asset.processingStatus} />
							</div>
						</div>

						<Separator />

						{/* Processing Details */}
						<div className="space-y-3">
							<h4 className="font-medium">Processing Details</h4>

							{asset.ocrJobId && (
								<div className="text-sm">
									<span className="text-muted-foreground">OCR Job: </span>
									<code className="rounded bg-muted px-1 py-0.5">
										{asset.ocrJobId}
									</code>
								</div>
							)}

							{asset.ocrWordCount !== undefined && (
								<div className="text-sm">
									<span className="text-muted-foreground">
										Words Extracted:{" "}
									</span>
									<span className="font-medium">
										{asset.ocrWordCount.toLocaleString()}
									</span>
								</div>
							)}

							{asset.extractionJobId && (
								<div className="text-sm">
									<span className="text-muted-foreground">
										Extraction Job:{" "}
									</span>
									<code className="rounded bg-muted px-1 py-0.5">
										{asset.extractionJobId}
									</code>
								</div>
							)}

							{asset.extractedItemCount !== undefined && (
								<div className="text-sm">
									<span className="text-muted-foreground">
										Items Extracted:{" "}
									</span>
									<span className="font-medium">
										{asset.extractedItemCount}
									</span>
								</div>
							)}

							{asset.lastError && (
								<div className="rounded-lg bg-destructive/10 p-3 text-sm">
									<p className="font-medium text-destructive">Last Error:</p>
									<p className="text-destructive/80">{asset.lastError}</p>
								</div>
							)}
						</div>

						{/* Extraction Results */}
						{data?.extractionResult && (
							<>
								<Separator />
								<div className="space-y-3">
									<h4 className="font-medium">Extraction Results</h4>
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<p className="text-muted-foreground">Total Essays</p>
											<p className="font-medium">
												{data.extractionResult.totalEssays}
											</p>
										</div>
										<div>
											<p className="text-muted-foreground">Total Items</p>
											<p className="font-medium">
												{data.extractionResult.totalItems}
											</p>
										</div>
									</div>
									<Button asChild size="sm" variant="outline">
										<Link href="/patterns">View in Patterns</Link>
									</Button>
								</div>
							</>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
