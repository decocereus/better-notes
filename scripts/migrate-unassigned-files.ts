#!/usr/bin/env bun
/**
 * Migration script to create asset records for existing R2 files.
 *
 * This script:
 * 1. Lists all files in the `projects/` prefix in R2
 * 2. Checks if an asset record exists for each file
 * 3. Creates a new asset record if one doesn't exist
 *
 * Run with: bunx tsx scripts/migrate-unassigned-files.ts
 */

import { ConvexHttpClient } from "convex/browser";
import { config } from "dotenv";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { getR2FileInfo, listR2Files, validateR2Config } from "../lib/storage";

// Load environment variables
config({ path: ".env.local" });

// Regex to strip timestamp prefix from filenames
const TIMESTAMP_PREFIX_REGEX = /^\d+-/;

interface MigrationResult {
	total: number;
	created: number;
	skipped: number;
	errors: string[];
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Migration script handles many edge cases
async function migrateFiles(): Promise<MigrationResult> {
	const result: MigrationResult = {
		total: 0,
		created: 0,
		skipped: 0,
		errors: [],
	};

	// Validate R2 configuration
	const r2Config = validateR2Config();
	if (!r2Config.valid) {
		throw new Error(`R2 not configured: ${r2Config.missing.join(", ")}`);
	}

	// Get Convex client
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL not set");
	}
	const convex = new ConvexHttpClient(convexUrl);

	console.log("Listing files from R2...");

	// List all files in the projects/ prefix
	// Note: If there are more than 1000 files, you'll need to paginate
	const files = await listR2Files("projects/", 1000);
	result.total = files.length;

	console.log(`Found ${files.length} files in R2`);

	for (const file of files) {
		const key = file.key;

		// Skip directories (keys ending with /)
		if (key.endsWith("/")) {
			result.skipped++;
			continue;
		}

		try {
			// Check if asset already exists for this key
			const existingAsset = await convex.query(api.assets.getByKey, { key });

			if (existingAsset) {
				console.log(`Skipping (exists): ${key}`);
				result.skipped++;
				continue;
			}

			// Get file info from R2
			const fileInfo = await getR2FileInfo(key);
			if (!fileInfo.exists) {
				console.log(`Skipping (not found): ${key}`);
				result.skipped++;
				continue;
			}

			// Extract filename from key
			// Key format: projects/{projectId}/{timestamp}-{filename}
			const parts = key.split("/");
			const filename = parts.at(-1) ?? "";
			const projectId = parts.length > 2 ? parts[1] : undefined;

			// Determine source type and MIME type
			const extension = filename.split(".").pop()?.toLowerCase() || "";
			let sourceType: "pdf" | "image" = "image";
			let mimeType = "application/octet-stream";

			if (extension === "pdf") {
				sourceType = "pdf";
				mimeType = "application/pdf";
			} else if (["jpg", "jpeg"].includes(extension)) {
				mimeType = "image/jpeg";
			} else if (extension === "png") {
				mimeType = "image/png";
			} else if (extension === "webp") {
				mimeType = "image/webp";
			}

			// Check if projectId is valid - try to look it up
			let validProjectId: Id<"projects"> | undefined;
			if (projectId && projectId !== "unassigned") {
				try {
					const project = await convex.query(api.projects.get, {
						id: projectId as Id<"projects">,
					});
					if (project) {
						validProjectId = projectId as Id<"projects">;
					}
				} catch {
					// Project doesn't exist or invalid ID
					console.log(`Project ${projectId} not found, creating unassigned`);
				}
			}

			// Create asset record
			const assetId = await convex.mutation(api.assets.create, {
				filename: filename.replace(TIMESTAMP_PREFIX_REGEX, ""), // Remove timestamp prefix
				key,
				size: fileInfo.size || 0,
				mimeType,
				sourceType,
				projectId: validProjectId,
			});

			console.log(
				`Created asset: ${assetId} for ${key}${validProjectId ? ` (project: ${validProjectId})` : " (unassigned)"}`
			);
			result.created++;
		} catch (err) {
			const errorMsg = `Failed to process ${key}: ${err instanceof Error ? err.message : String(err)}`;
			console.error(errorMsg);
			result.errors.push(errorMsg);
		}
	}

	return result;
}

// Main execution
async function main() {
	console.log("=== Asset Migration Script ===\n");

	try {
		const result = await migrateFiles();

		console.log("\n=== Migration Complete ===");
		console.log(`Total files found: ${result.total}`);
		console.log(`Assets created: ${result.created}`);
		console.log(`Skipped: ${result.skipped}`);

		if (result.errors.length > 0) {
			console.log(`\nErrors (${result.errors.length}):`);
			for (const error of result.errors) {
				console.log(`  - ${error}`);
			}
		}
	} catch (err) {
		console.error("Migration failed:", err);
		process.exit(1);
	}
}

main();
