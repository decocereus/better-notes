"use client";

import { FileText, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import type { UploadResponse } from "@/app/api/upload/route";
import { OcrViewer } from "@/components/ocr-viewer";
import { ProcessingStatus } from "@/components/processing-status";
import { Button } from "@/components/ui/button";
import { UploadZone } from "@/components/upload-zone";
import type { OcrJobResults } from "@/types";

interface PdfUploadOcrProps {
	/** Project ID for organizing uploads */
	projectId: string;
	/** Called when OCR completes with results */
	onOcrComplete?: (results: OcrJobResults) => void;
	/** Custom class name */
	className?: string;
}

type Stage = "upload" | "confirm" | "processing" | "results";

interface UploadedPdf {
	key: string;
	filename: string;
	size: number;
	type: string;
}

export function PdfUploadOcr({
	projectId,
	onOcrComplete,
	className,
}: PdfUploadOcrProps) {
	const [stage, setStage] = useState<Stage>("upload");
	const [uploadedPdf, setUploadedPdf] = useState<UploadedPdf | null>(null);
	const [jobId, setJobId] = useState<string | null>(null);
	const [ocrResults, setOcrResults] = useState<OcrJobResults | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleUploadComplete = useCallback((response: UploadResponse) => {
		if (response.type === "application/pdf") {
			setUploadedPdf({
				key: response.key,
				filename: response.filename,
				size: response.size,
				type: response.type,
			});
			setStage("confirm");
		}
	}, []);

	const handleUploadError = useCallback((errorMessage: string) => {
		setError(errorMessage);
	}, []);

	const startOcrProcessing = useCallback(async () => {
		if (!uploadedPdf) {
			return;
		}

		setError(null);
		setStage("processing");

		try {
			const response = await fetch("/api/ocr", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					sourceKey: uploadedPdf.key,
					projectId,
				}),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to start OCR");
			}

			const data = await response.json();
			setJobId(data.jobId);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to start OCR");
			setStage("confirm");
		}
	}, [uploadedPdf, projectId]);

	const handleOcrComplete = useCallback(
		async (completedJobId: string) => {
			try {
				// Fetch full results
				const response = await fetch(`/api/ocr?jobId=${completedJobId}`);
				if (!response.ok) {
					throw new Error("Failed to fetch OCR results");
				}

				const data = await response.json();
				setOcrResults(data.results);
				setStage("results");
				onOcrComplete?.(data.results);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to get results");
			}
		},
		[onOcrComplete]
	);

	const handleOcrError = useCallback((_jobId: string, errorMessage: string) => {
		setError(errorMessage);
	}, []);

	const resetToUpload = useCallback(() => {
		setStage("upload");
		setUploadedPdf(null);
		setJobId(null);
		setOcrResults(null);
		setError(null);
	}, []);

	return (
		<div className={className}>
			{/* Error display */}
			{error && (
				<div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-destructive text-sm">
					{error}
				</div>
			)}

			{/* Upload stage */}
			{stage === "upload" && (
				<UploadZone
					disabled={false}
					multiple={false}
					onUploadComplete={handleUploadComplete}
					onUploadError={handleUploadError}
					projectId={projectId}
				/>
			)}

			{/* Confirm stage */}
			{stage === "confirm" && uploadedPdf && (
				<div className="space-y-4">
					<div className="rounded-lg border p-4">
						<div className="flex items-center gap-3">
							<div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
								<FileText className="size-6 text-primary" />
							</div>
							<div className="flex-1">
								<p className="font-medium">{uploadedPdf.filename}</p>
								<p className="text-muted-foreground text-sm">
									{formatFileSize(uploadedPdf.size)} • PDF document
								</p>
							</div>
						</div>
					</div>

					<div className="rounded-lg border bg-muted/50 p-4">
						<div className="flex items-start gap-3">
							<Sparkles className="mt-0.5 size-5 text-primary" />
							<div>
								<h4 className="font-medium">Process with OCR</h4>
								<p className="mt-1 text-muted-foreground text-sm">
									This will extract all text from the PDF using AI-powered OCR.
									The process may take several minutes for large documents.
								</p>
							</div>
						</div>
					</div>

					<div className="flex gap-3">
						<Button onClick={resetToUpload} variant="outline">
							Upload Different File
						</Button>
						<Button onClick={startOcrProcessing}>
							<Sparkles className="mr-2 size-4" />
							Start OCR Processing
						</Button>
					</div>
				</div>
			)}

			{/* Processing stage */}
			{stage === "processing" && jobId && (
				<div className="space-y-4">
					<ProcessingStatus
						jobId={jobId}
						onComplete={handleOcrComplete}
						onError={handleOcrError}
					/>
					<p className="text-center text-muted-foreground text-sm">
						Processing {uploadedPdf?.filename}. This may take several minutes.
					</p>
				</div>
			)}

			{/* Results stage */}
			{stage === "results" && ocrResults && (
				<div className="space-y-4">
					<OcrViewer className="h-[600px]" results={ocrResults} />
					<div className="flex justify-center">
						<Button onClick={resetToUpload} variant="outline">
							Process Another PDF
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) {
		return "0 B";
	}
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}
