/**
 * Notes storage helpers for persisting generated notes in R2.
 */

import type { GeneratedNote } from "@/types/generation";
import { downloadFromR2, listR2Files, uploadToR2 } from "./r2-client";

const NOTES_PREFIX = "notes";

/**
 * Builds an R2 key for a generated note.
 */
export function buildNoteStorageKey(note: GeneratedNote): string {
	if (!note.projectId) {
		throw new Error("projectId is required to store notes");
	}

	return `${NOTES_PREFIX}/${note.projectId}/${note.id}.json`;
}

/**
 * Stores a generated note in R2.
 */
export async function storeNote(note: GeneratedNote): Promise<{ key: string }> {
	const key = buildNoteStorageKey(note);
	await uploadToR2(
		key,
		Buffer.from(JSON.stringify(note, null, 2)),
		"application/json"
	);
	return { key };
}

/**
 * Loads a generated note from R2 by key.
 */
export async function loadNote(key: string): Promise<GeneratedNote> {
	const { body: stream } = await downloadFromR2(key);
	const text = await streamToString(stream);
	return JSON.parse(text) as GeneratedNote;
}

/**
 * Lists stored note keys by prefix.
 */
export async function listNoteKeys(
	prefix: string,
	maxKeys = 200
): Promise<string[]> {
	const files = await listR2Files(prefix, maxKeys);
	return files.map((file) => file.key).filter(Boolean);
}

/**
 * Converts a ReadableStream to string.
 */
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
