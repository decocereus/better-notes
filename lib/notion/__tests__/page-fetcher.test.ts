import { describe, expect, it } from "vitest";
import {
	extractPageIdFromUrl,
	isValidNotionPageReference,
} from "../page-fetcher";

describe("extractPageIdFromUrl", () => {
	// Valid 32-character hex ID for testing
	const VALID_ID = "abc123def4567890abcdef1234567890";

	describe("full Notion URLs", () => {
		it("extracts ID from standard Notion URL", () => {
			const url = `https://www.notion.so/workspace/Page-Title-${VALID_ID}`;
			expect(extractPageIdFromUrl(url)).toBe(VALID_ID);
		});

		it("extracts ID from notion.site URL", () => {
			const url = `https://workspace.notion.site/Page-Title-${VALID_ID}`;
			expect(extractPageIdFromUrl(url)).toBe(VALID_ID);
		});

		it("handles URL with query parameters", () => {
			const url = `https://www.notion.so/workspace/Page-${VALID_ID}?v=123`;
			expect(extractPageIdFromUrl(url)).toBe(VALID_ID);
		});

		it("handles URL with hash", () => {
			const url = `https://www.notion.so/workspace/Page-${VALID_ID}#section`;
			expect(extractPageIdFromUrl(url)).toBe(VALID_ID);
		});
	});

	describe("UUID format", () => {
		it("extracts ID from UUID with dashes", () => {
			const uuid = "abc12345-def6-7890-abcd-ef1234567890";
			expect(extractPageIdFromUrl(uuid)).toBe(
				"abc12345def67890abcdef1234567890"
			);
		});

		it("extracts ID from UUID in URL", () => {
			const url = "https://www.notion.so/abc12345-def6-7890-abcd-ef1234567890";
			expect(extractPageIdFromUrl(url)).toBe(
				"abc12345def67890abcdef1234567890"
			);
		});
	});

	describe("raw ID", () => {
		it("accepts raw 32-character ID", () => {
			expect(extractPageIdFromUrl(VALID_ID)).toBe(VALID_ID);
		});

		it("handles whitespace", () => {
			const id = `  ${VALID_ID}  `;
			expect(extractPageIdFromUrl(id)).toBe(VALID_ID);
		});
	});

	describe("invalid inputs", () => {
		it("returns null for empty string", () => {
			expect(extractPageIdFromUrl("")).toBeNull();
		});

		it("returns null for random URL", () => {
			expect(extractPageIdFromUrl("https://google.com")).toBeNull();
		});

		it("returns null for invalid ID length", () => {
			expect(extractPageIdFromUrl("abc123")).toBeNull();
		});

		it("returns null for non-hex characters", () => {
			// 32 chars but contains non-hex 'x', 'y', 'z'
			expect(
				extractPageIdFromUrl("xyz123def4567890abcdef1234567890")
			).toBeNull();
		});
	});
});

describe("isValidNotionPageReference", () => {
	// Valid 32-character hex ID for testing
	const VALID_ID = "abc123def4567890abcdef1234567890";

	it("returns true for valid Notion URL", () => {
		const url = `https://www.notion.so/workspace/Page-${VALID_ID}`;
		expect(isValidNotionPageReference(url)).toBe(true);
	});

	it("returns true for valid UUID", () => {
		expect(
			isValidNotionPageReference("abc12345-def6-7890-abcd-ef1234567890")
		).toBe(true);
	});

	it("returns true for valid raw ID", () => {
		expect(isValidNotionPageReference(VALID_ID)).toBe(true);
	});

	it("returns false for invalid URL", () => {
		expect(isValidNotionPageReference("https://google.com")).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isValidNotionPageReference("")).toBe(false);
	});
});
