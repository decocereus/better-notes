/**
 * Storage helpers for essay boundary results.
 * Stores detected essay boundaries in R2 so re-extractions can skip re-detection.
 */

import { z } from "zod";
import type { EssayBoundary } from "@/types/extraction";
import { downloadFromR2, getR2FileInfo, uploadToR2 } from "./r2-client";

const STORED_BOUNDARIES_SCHEMA_VERSION = 1 as const;

const StoredEssayBoundarySchema = z.object({
	startPage: z.number().int().positive(),
	endPage: z.number().int().positive(),
	title: z.string().optional(),
	wordCount: z.number().int().nonnegative(),
});

const StoredEssayBoundariesSchema = z
	.object({
		schemaVersion: z.literal(STORED_BOUNDARIES_SCHEMA_VERSION),
		assetId: z.string().min(1),
		totalPages: z.number().int().positive(),
		sourceKey: z.string().optional(),
		boundaries: z.array(StoredEssayBoundarySchema).min(1),
		storedAt: z.string().min(1),
	})
	.superRefine((value, ctx) => {
		for (const [index, boundary] of value.boundaries.entries()) {
			if (boundary.endPage < boundary.startPage) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Boundary ${index + 1} has endPage before startPage`,
				});
			}
			if (boundary.endPage > value.totalPages) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: `Boundary ${index + 1} exceeds totalPages`,
				});
			}
		}
	});

export interface StoredEssayBoundaries {
	schemaVersion: typeof STORED_BOUNDARIES_SCHEMA_VERSION;
	assetId: string;
	totalPages: number;
	sourceKey?: string;
	boundaries: EssayBoundary[];
	storedAt: string;
}

export function getEssayBoundariesKey(assetId: string): string {
	return `assets/${assetId}/extraction/essay-boundaries.json`;
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

export async function loadEssayBoundaries(
	assetId: string
): Promise<StoredEssayBoundaries | null> {
	const key = getEssayBoundariesKey(assetId);
	const info = await getR2FileInfo(key);
	if (!info.exists) {
		return null;
	}

	try {
		const { body } = await downloadFromR2(key);
		const text = await streamToString(body);
		const parsed = JSON.parse(text) as unknown;
		const validated = StoredEssayBoundariesSchema.safeParse(parsed);
		if (!validated.success) {
			return null;
		}
		return validated.data as StoredEssayBoundaries;
	} catch {
		return null;
	}
}

export async function storeEssayBoundaries(
	input: Omit<StoredEssayBoundaries, "schemaVersion" | "storedAt">
): Promise<{ key: string }> {
	const key = getEssayBoundariesKey(input.assetId);
	const payload: StoredEssayBoundaries = {
		schemaVersion: STORED_BOUNDARIES_SCHEMA_VERSION,
		assetId: input.assetId,
		totalPages: input.totalPages,
		sourceKey: input.sourceKey,
		boundaries: [...input.boundaries].sort((a, b) => a.startPage - b.startPage),
		storedAt: new Date().toISOString(),
	};

	await uploadToR2(
		key,
		Buffer.from(JSON.stringify(payload, null, 2)),
		"application/json"
	);

	return { key };
}
