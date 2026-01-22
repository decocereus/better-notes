import { describe, expect, it } from "vitest";
import {
	ALLOWED_MIME_TYPES,
	formatFileSize,
	isAllowedMimeType,
	MAX_FILE_SIZE_BYTES,
	MIME_TO_SOURCE_TYPE,
} from "../upload";

describe("upload constants", () => {
	describe("ALLOWED_MIME_TYPES", () => {
		it("includes PDF type", () => {
			expect(ALLOWED_MIME_TYPES).toContain("application/pdf");
		});

		it("includes PNG type", () => {
			expect(ALLOWED_MIME_TYPES).toContain("image/png");
		});

		it("includes JPEG type", () => {
			expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
		});

		it("includes WebP type", () => {
			expect(ALLOWED_MIME_TYPES).toContain("image/webp");
		});

		it("has exactly 4 allowed types", () => {
			expect(ALLOWED_MIME_TYPES).toHaveLength(4);
		});
	});

	describe("MAX_FILE_SIZE_BYTES", () => {
		it("equals 10MB in bytes", () => {
			expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
		});
	});

	describe("MIME_TO_SOURCE_TYPE", () => {
		it("maps PDF to pdf source type", () => {
			expect(MIME_TO_SOURCE_TYPE["application/pdf"]).toBe("pdf");
		});

		it("maps PNG to image source type", () => {
			expect(MIME_TO_SOURCE_TYPE["image/png"]).toBe("image");
		});

		it("maps JPEG to image source type", () => {
			expect(MIME_TO_SOURCE_TYPE["image/jpeg"]).toBe("image");
		});

		it("maps WebP to image source type", () => {
			expect(MIME_TO_SOURCE_TYPE["image/webp"]).toBe("image");
		});
	});
});

describe("isAllowedMimeType", () => {
	it("returns true for application/pdf", () => {
		expect(isAllowedMimeType("application/pdf")).toBe(true);
	});

	it("returns true for image/png", () => {
		expect(isAllowedMimeType("image/png")).toBe(true);
	});

	it("returns true for image/jpeg", () => {
		expect(isAllowedMimeType("image/jpeg")).toBe(true);
	});

	it("returns true for image/webp", () => {
		expect(isAllowedMimeType("image/webp")).toBe(true);
	});

	it("returns false for text/plain", () => {
		expect(isAllowedMimeType("text/plain")).toBe(false);
	});

	it("returns false for application/json", () => {
		expect(isAllowedMimeType("application/json")).toBe(false);
	});

	it("returns false for image/gif", () => {
		expect(isAllowedMimeType("image/gif")).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isAllowedMimeType("")).toBe(false);
	});

	it("returns false for arbitrary string", () => {
		expect(isAllowedMimeType("not-a-mime-type")).toBe(false);
	});
});

describe("formatFileSize", () => {
	it("formats 0 bytes", () => {
		expect(formatFileSize(0)).toBe("0 Bytes");
	});

	it("formats bytes (< 1KB)", () => {
		expect(formatFileSize(500)).toBe("500 Bytes");
	});

	it("formats exactly 1 KB", () => {
		expect(formatFileSize(1024)).toBe("1 KB");
	});

	it("formats kilobytes", () => {
		expect(formatFileSize(1536)).toBe("1.5 KB");
	});

	it("formats exactly 1 MB", () => {
		expect(formatFileSize(1024 * 1024)).toBe("1 MB");
	});

	it("formats megabytes", () => {
		expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
	});

	it("formats megabytes with decimals", () => {
		expect(formatFileSize(2.5 * 1024 * 1024)).toBe("2.5 MB");
	});

	it("formats exactly 1 GB", () => {
		expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
	});

	it("formats large file sizes", () => {
		expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
	});

	it("formats 10MB (max file size)", () => {
		expect(formatFileSize(MAX_FILE_SIZE_BYTES)).toBe("10 MB");
	});
});
