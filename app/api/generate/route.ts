import { NextResponse } from "next/server";
import { filterBySource } from "@/lib/comparison/gap-analyzer";
import { enforceNoteConciseness } from "@/lib/generation/conciseness";
import { generateNotesForTheme } from "@/lib/generation/note-generator";
import type { ExtractedContent } from "@/types/extraction";
import type { GeneratedNote, GenerationConfig } from "@/types/generation";
import { DEFAULT_GENERATION_CONFIG } from "@/types/generation";
import type { MainTheme, MiniTheme } from "@/types/theme";

interface GenerateRequest {
	/** Main theme info */
	mainTheme: MainTheme;
	/** Mini theme info */
	miniTheme: MiniTheme;
	/** All extracted content for this theme (user + topper) */
	content: ExtractedContent[];
	/** Project ID for storage */
	projectId?: string;
	/** Optional custom configuration */
	config?: Partial<GenerationConfig>;
	/** Whether to enforce conciseness limits */
	enforceConciseness?: boolean;
}

interface GenerateResponse {
	success: boolean;
	note?: GeneratedNote;
	error?: string;
}

/**
 * POST /api/generate
 * Generates dual-section notes for a theme.
 *
 * Request body: {
 *   mainTheme: MainTheme,
 *   miniTheme: MiniTheme,
 *   content: ExtractedContent[],
 *   projectId?: string,
 *   config?: Partial<GenerationConfig>,
 *   enforceConciseness?: boolean
 * }
 * Response: { success: boolean, note?: GeneratedNote, error?: string }
 */
export async function POST(
	request: Request
): Promise<NextResponse<GenerateResponse>> {
	try {
		const body = (await request.json()) as GenerateRequest;
		const {
			mainTheme,
			miniTheme,
			content,
			projectId,
			config: customConfig,
			enforceConciseness = true,
		} = body;

		// Validate inputs
		if (!(mainTheme && miniTheme)) {
			return NextResponse.json(
				{ success: false, error: "Main theme and mini theme are required" },
				{ status: 400 }
			);
		}

		if (!content || content.length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: "Content is required for note generation",
				},
				{ status: 400 }
			);
		}

		// Merge config with defaults
		const config: GenerationConfig = {
			...DEFAULT_GENERATION_CONFIG,
			...customConfig,
		};

		// Split content by source
		const userContent = filterBySource(content, "user");
		const topperContent = filterBySource(content, "topper");

		// Validate we have at least some content
		if (userContent.length === 0 && topperContent.length === 0) {
			return NextResponse.json(
				{
					success: false,
					error:
						"No valid content found. Please ensure content has sourceType set.",
				},
				{ status: 400 }
			);
		}

		// Generate notes
		let note = await generateNotesForTheme(
			mainTheme,
			miniTheme,
			userContent,
			topperContent,
			config
		);

		// Enforce conciseness if enabled
		if (enforceConciseness) {
			note = await enforceNoteConciseness(note, { mainTheme, miniTheme });
		}

		if (projectId) {
			note = { ...note, projectId };
		}

		return NextResponse.json({ success: true, note });
	} catch (error) {
		console.error("Note generation failed:", error);
		const message =
			error instanceof Error ? error.message : "Generation failed";
		return NextResponse.json(
			{ success: false, error: message },
			{ status: 500 }
		);
	}
}
