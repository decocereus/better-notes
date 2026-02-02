import { NextResponse } from "next/server";
import {
	listNoteKeys,
	loadNote,
	storeNote,
	validateR2Config,
} from "@/lib/storage";
import type { GeneratedNote } from "@/types/generation";

const PROJECT_ID_FROM_KEY_REGEX = /^notes\/([^/]+)\//;

interface NotesResponse {
	success: boolean;
	notes?: GeneratedNote[];
	skippedKeys?: string[];
	error?: string;
}

interface NotesSaveRequest {
	note?: GeneratedNote;
}

function getProjectIdFromKey(key: string): string | null {
	const match = PROJECT_ID_FROM_KEY_REGEX.exec(key);
	return match ? (match[1] ?? null) : null;
}

/**
 * GET /api/notes
 * Optional query params:
 * - projectId: filter notes by project
 * - mainThemeId: filter by main theme
 * - miniThemeId: filter by mini theme
 * - limit: max number of notes to load
 */
export async function GET(
	request: Request
): Promise<NextResponse<NotesResponse>> {
	const r2Config = validateR2Config();
	if (!r2Config.valid) {
		return NextResponse.json(
			{
				success: false,
				error: `R2 storage not configured (missing: ${r2Config.missing.join(", ")})`,
			},
			{ status: 503 }
		);
	}

	const { searchParams } = new URL(request.url);
	const projectId = searchParams.get("projectId") ?? undefined;
	const mainThemeId = searchParams.get("mainThemeId") ?? undefined;
	const miniThemeId = searchParams.get("miniThemeId") ?? undefined;
	const limit = Number(searchParams.get("limit") ?? "200");

	const prefix = projectId ? `notes/${projectId}/` : "notes/";
	const keys = await listNoteKeys(prefix, Number.isNaN(limit) ? 200 : limit);

	const results = await Promise.allSettled(keys.map((key) => loadNote(key)));
	const skippedKeys: string[] = [];
	const notes: GeneratedNote[] = [];

	results.forEach((result, index) => {
		if (result.status === "fulfilled") {
			const note = result.value;
			if (!note.projectId) {
				const inferred = getProjectIdFromKey(keys[index] ?? "");
				if (inferred) {
					note.projectId = inferred;
				}
			}
			notes.push(note);
		} else if (keys[index]) {
			skippedKeys.push(keys[index]);
		}
	});

	const filteredNotes = notes.filter((note) => {
		if (mainThemeId && note.mainThemeId !== mainThemeId) {
			return false;
		}
		if (miniThemeId && note.miniThemeId !== miniThemeId) {
			return false;
		}
		return true;
	});

	return NextResponse.json({
		success: true,
		notes: filteredNotes,
		skippedKeys: skippedKeys.length > 0 ? skippedKeys : undefined,
	});
}

/**
 * POST /api/notes
 * Body: { note: GeneratedNote }
 */
export async function POST(
	request: Request
): Promise<NextResponse<NotesResponse>> {
	const r2Config = validateR2Config();
	if (!r2Config.valid) {
		return NextResponse.json(
			{
				success: false,
				error: `R2 storage not configured (missing: ${r2Config.missing.join(", ")})`,
			},
			{ status: 503 }
		);
	}

	const body = (await request.json()) as NotesSaveRequest;
	if (!body.note) {
		return NextResponse.json(
			{ success: false, error: "Note is required" },
			{ status: 400 }
		);
	}

	if (!body.note.projectId) {
		return NextResponse.json(
			{ success: false, error: "projectId is required to store notes" },
			{ status: 400 }
		);
	}

	await storeNote(body.note);

	return NextResponse.json({ success: true });
}
