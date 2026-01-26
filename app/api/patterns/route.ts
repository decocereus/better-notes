/**
 * Patterns API Route
 *
 * GET: Aggregate extracted content from all extraction results stored in R2.
 */

import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { downloadFromR2, validateR2Config } from "@/lib/storage";
import type { Asset } from "@/types/asset";
import type { ContentType, ExtractedContent } from "@/types/extraction";

interface ExtractionJobResults {
	allItems: ExtractedContent[];
	totalEssays: number;
	stats?: {
		totalItems?: number;
	};
	essays?: Array<{
		sections?: Array<{ type: ContentType; markdown: string }>;
	}>;
	processedAt?: string;
}

interface LoadOptions {
	includeItems: boolean;
	includeCounts: boolean;
}

const QUALITY_SCORE: Record<ExtractedContent["quality"], number> = {
	high: 3,
	medium: 2,
	low: 1,
};

function buildFallbackSections(
	items: ExtractedContent[]
): Partial<Record<ContentType, string[]>> {
	const grouped = new Map<ContentType, ExtractedContent[]>();

	for (const item of items) {
		const list = grouped.get(item.contentType) ?? [];
		list.push(item);
		grouped.set(item.contentType, list);
	}

	const sections: Partial<Record<ContentType, string[]>> = {};

	for (const [type, group] of grouped) {
		const sorted = [...group].sort((a, b) => {
			const qualityDiff = QUALITY_SCORE[b.quality] - QUALITY_SCORE[a.quality];
			if (qualityDiff !== 0) {
				return qualityDiff;
			}
			if (a.multiUse !== b.multiUse) {
				return a.multiUse ? -1 : 1;
			}
			return 0;
		});

		const lines = sorted.slice(0, 6).map((item) => {
			const context =
				item.context && item.context.length <= 140 ? ` - ${item.context}` : "";
			return `- ${item.content}${context}`;
		});

		if (lines.length > 0) {
			sections[type] = [lines.join("\n")];
		}
	}

	return sections;
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

async function fetchExtractionResults(
	resultsKey: string
): Promise<ExtractionJobResults | null> {
	try {
		const { body } = await downloadFromR2(resultsKey);
		const text = await streamToString(body);
		return JSON.parse(text) as ExtractionJobResults;
	} catch (error) {
		console.error(
			`Failed to load extraction results from ${resultsKey}:`,
			error
		);
		return null;
	}
}

function extractItemCount(parsed: ExtractionJobResults): number {
	if (typeof parsed.stats?.totalItems === "number") {
		return parsed.stats.totalItems;
	}
	if (Array.isArray(parsed.allItems)) {
		return parsed.allItems.length;
	}
	return 0;
}

/**
 * Aggregator class to manage state while loading extraction results.
 */
class PatternsAggregator {
	allItems: ExtractedContent[] = [];
	totalEssays = 0;
	totalItems = 0;
	lastUpdatedAt: string | null = null;
	sources = new Set<string>();
	sectionMarkdownByType: Partial<Record<ContentType, string[]>> = {};
	sectionsUpdatedAt: string | null = null;

	updateLastUpdated(timestamp?: string | null): void {
		if (!timestamp) {
			return;
		}
		if (!this.lastUpdatedAt) {
			this.lastUpdatedAt = timestamp;
			return;
		}
		const newTime = new Date(timestamp).getTime();
		const currentTime = new Date(this.lastUpdatedAt).getTime();
		if (newTime > currentTime) {
			this.lastUpdatedAt = timestamp;
		}
	}

	addItems(items: ExtractedContent[]): void {
		this.allItems.push(...items);
	}

	addCounts(parsed: ExtractionJobResults): void {
		this.totalEssays += parsed.totalEssays ?? 0;
		this.totalItems += extractItemCount(parsed);
	}

	updateSections(parsed: ExtractionJobResults): void {
		const essays = parsed.essays;
		if (!essays?.length) {
			return;
		}

		const processedAt = parsed.processedAt ?? null;
		const shouldClearSections = this.shouldReplaceSections(processedAt);

		if (shouldClearSections) {
			this.clearSections();
			this.sectionsUpdatedAt = processedAt ?? this.sectionsUpdatedAt;
		}

		this.collectSections(essays);
	}

	private shouldReplaceSections(processedAt: string | null): boolean {
		if (!this.sectionsUpdatedAt) {
			return true;
		}
		if (!processedAt) {
			return false;
		}
		const newTime = new Date(processedAt).getTime();
		const currentTime = new Date(this.sectionsUpdatedAt).getTime();
		return newTime > currentTime;
	}

	private clearSections(): void {
		for (const key of Object.keys(this.sectionMarkdownByType)) {
			delete this.sectionMarkdownByType[key as ContentType];
		}
	}

	private collectSections(
		essays: Array<{ sections?: Array<{ type: ContentType; markdown: string }> }>
	): void {
		for (const essay of essays) {
			for (const section of essay.sections ?? []) {
				const bucket = this.sectionMarkdownByType[section.type] ?? [];
				if (bucket.length < 3) {
					bucket.push(section.markdown);
				}
				this.sectionMarkdownByType[section.type] = bucket;
			}
		}
	}

	async loadResults(resultsKey: string, options: LoadOptions): Promise<void> {
		const parsed = await fetchExtractionResults(resultsKey);
		if (!parsed) {
			return;
		}

		if (options.includeItems && Array.isArray(parsed.allItems)) {
			this.addItems(parsed.allItems);
		}

		if (options.includeCounts) {
			this.addCounts(parsed);
		}

		this.sources.add(resultsKey);

		if (options.includeItems) {
			this.updateSections(parsed);
		}
	}

	getSections(): Partial<Record<ContentType, string[]>> {
		if (Object.keys(this.sectionMarkdownByType).length > 0) {
			return this.sectionMarkdownByType;
		}
		return buildFallbackSections(this.allItems);
	}
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

	try {
		const { searchParams } = new URL(request.url);
		const includeItems = searchParams.get("includeItems") !== "false";

		const convex = new ConvexHttpClient(convexUrl);
		const aggregator = new PatternsAggregator();

		// Load from extraction results table
		const extractionResults = await convex.query(
			api.extractionResults.list,
			{}
		);

		for (const result of extractionResults) {
			aggregator.totalEssays += result.totalEssays ?? 0;
			aggregator.totalItems += result.totalItems ?? 0;
			aggregator.sources.add(result.resultsKey);
			aggregator.updateLastUpdated(result.createdAt);

			if (includeItems) {
				await aggregator.loadResults(result.resultsKey, {
					includeItems: true,
					includeCounts: false,
				});
			}
		}

		// Backfill from assets if extraction results are missing
		const assets = (await convex.query(api.assets.list, {
			status: "extraction_completed",
		})) as Asset[];

		for (const asset of assets) {
			await processAssetBackfill(aggregator, asset, includeItems);
		}

		return NextResponse.json({
			items: includeItems ? aggregator.allItems : [],
			totalItems: aggregator.totalItems,
			totalEssays: aggregator.totalEssays,
			sources: aggregator.sources.size,
			lastUpdatedAt: aggregator.lastUpdatedAt,
			sections: aggregator.getSections(),
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to load patterns",
			},
			{ status: 500 }
		);
	}
}

async function processAssetBackfill(
	aggregator: PatternsAggregator,
	asset: Asset,
	includeItems: boolean
): Promise<void> {
	if (!asset.extractionJobId) {
		return;
	}

	const resultsKey = `processing/${asset.extractionJobId}/extraction-results.json`;
	if (aggregator.sources.has(resultsKey)) {
		return;
	}

	aggregator.updateLastUpdated(asset.processedAt);

	if (includeItems) {
		await aggregator.loadResults(resultsKey, {
			includeItems: true,
			includeCounts: true,
		});
		return;
	}

	// For counts-only mode, try loading from R2, fall back to asset metadata
	await aggregator.loadResults(resultsKey, {
		includeItems: false,
		includeCounts: true,
	});

	// If loading failed and we have asset metadata, use that
	if (
		!aggregator.sources.has(resultsKey) &&
		typeof asset.extractedItemCount === "number"
	) {
		aggregator.totalItems += asset.extractedItemCount;
	}
}
