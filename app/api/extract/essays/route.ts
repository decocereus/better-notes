/**
 * Extraction Essays API Route
 *
 * GET: Return per-essay summaries for an asset's latest extraction results.
 * Used to power partial re-extraction (missing-only / single essay).
 */

import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { downloadFromR2, validateR2Config } from "@/lib/storage";
import type { EssayExtractionResult } from "@/types/extraction";

interface ExtractionJobResults {
	essays: EssayExtractionResult[];
}

interface EssaySummary {
	essayIndex: number;
	essayTitle?: string;
	startPage: number;
	endPage: number;
	wordCount: number;
	itemsExtracted: number;
}

async function streamToString(stream: ReadableStream): Promise<string> {
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];

	let done = false;
	while (!done) {
		const result = await reader.read();
		done = result.done;
		if (result.value) {
			chunks.push(result.value);
		}
	}

	const combined = new Uint8Array(
		chunks.reduce((acc, chunk) => acc + chunk.length, 0)
	);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}

	return new TextDecoder().decode(combined);
}

export async function GET(request: NextRequest) {
	const r2Config = validateR2Config();
	if (!r2Config.valid) {
		return NextResponse.json(
			{
				error: "R2 storage not configured",
				details: `Missing: ${r2Config.missing.join(", ")}`,
			},
			{ status: 503 }
		);
	}

	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return NextResponse.json(
			{ error: "Server configuration error" },
			{ status: 500 }
		);
	}

	const { searchParams } = new URL(request.url);
	const assetId = searchParams.get("assetId");

	if (!assetId) {
		return NextResponse.json({ error: "assetId is required" }, { status: 400 });
	}

	const convex = new ConvexHttpClient(convexUrl);
	const metadata = await convex.query(api.extractionResults.getByAsset, {
		assetId: assetId as Id<"assets">,
	});

	if (!metadata?.resultsKey) {
		return NextResponse.json(
			{ error: "No extraction results found for asset" },
			{ status: 404 }
		);
	}

	try {
		const { body } = await downloadFromR2(metadata.resultsKey);
		const text = await streamToString(body);
		const parsed = JSON.parse(text) as ExtractionJobResults;
		const summaries: EssaySummary[] = (parsed.essays ?? []).map(
			(essay, index) => ({
				essayIndex: index + 1,
				essayTitle: essay.essayTitle,
				startPage: essay.startPage,
				endPage: essay.endPage,
				wordCount: essay.wordCount,
				itemsExtracted: essay.items?.length ?? 0,
			})
		);

		return NextResponse.json({
			assetId,
			totalEssays: summaries.length,
			missingEssays: summaries.filter(
				(essay) => essay.itemsExtracted === 0 && essay.wordCount >= 100
			).length,
			essays: summaries,
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to load essay data",
			},
			{ status: 500 }
		);
	}
}
