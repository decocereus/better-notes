import { del } from "@vercel/blob";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/upload/delete
 * Deletes a file from Vercel Blob storage.
 *
 * Expects JSON body with:
 * - url: The blob URL to delete (required)
 */
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { url } = body as { url?: string };

		if (!url) {
			return NextResponse.json({ error: "URL is required" }, { status: 400 });
		}

		// Validate URL is a Vercel Blob URL
		if (!url.includes("blob.vercel-storage.com")) {
			return NextResponse.json({ error: "Invalid blob URL" }, { status: 400 });
		}

		// Delete from Vercel Blob
		await del(url);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Delete failed:", error);

		// Check for specific Vercel Blob errors
		if (error instanceof Error) {
			if (error.message.includes("BLOB_READ_WRITE_TOKEN")) {
				return NextResponse.json(
					{
						error:
							"Storage not configured. Please set BLOB_READ_WRITE_TOKEN environment variable.",
					},
					{ status: 500 }
				);
			}

			// Blob not found is not an error for us - consider it successful
			if (error.message.includes("not found")) {
				return NextResponse.json({ success: true });
			}
		}

		return NextResponse.json({ error: "Delete failed" }, { status: 500 });
	}
}
