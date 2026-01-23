import { type NextRequest, NextResponse } from "next/server";
import { deleteFromR2, validateR2Config } from "@/lib/storage";

/**
 * POST /api/storage/delete
 * Deletes a file from R2 storage.
 *
 * Expects JSON body with:
 * - key: The R2 key to delete (required)
 */
export async function POST(request: NextRequest) {
	try {
		// Validate R2 configuration
		const { valid, missing } = validateR2Config();
		if (!valid) {
			return NextResponse.json(
				{
					error: "R2 storage not configured",
					details: `Missing: ${missing.join(", ")}`,
				},
				{ status: 503 }
			);
		}

		const body = await request.json();
		const { key } = body as { key?: string };

		if (!key) {
			return NextResponse.json({ error: "Key is required" }, { status: 400 });
		}

		// Validate key format (should be a project file key)
		if (!key.startsWith("projects/")) {
			return NextResponse.json({ error: "Invalid R2 key" }, { status: 400 });
		}

		// Delete from R2
		await deleteFromR2(key);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Delete failed:", error);

		// R2 doesn't error on missing keys, so most errors are config issues
		if (error instanceof Error) {
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({ error: "Delete failed" }, { status: 500 });
	}
}
