import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	copyToClipboard,
	downloadAsFile,
	downloadAsJson,
	downloadAsMarkdown,
} from "../export";

describe("export utilities", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe("copyToClipboard", () => {
		it("returns true on success", async () => {
			Object.assign(navigator, {
				clipboard: {
					writeText: vi.fn().mockResolvedValue(undefined),
				},
			});
			const result = await copyToClipboard("test");
			expect(result).toBe(true);
			expect(navigator.clipboard.writeText).toHaveBeenCalledWith("test");
		});

		it("returns false on failure", async () => {
			Object.assign(navigator, {
				clipboard: {
					writeText: vi.fn().mockRejectedValue(new Error("denied")),
				},
			});
			const result = await copyToClipboard("test");
			expect(result).toBe(false);
		});
	});

	describe("downloadAsFile", () => {
		it("creates blob and triggers download with correct filename and mime type", () => {
			const createObjectURL = vi.fn().mockReturnValue("blob:test");
			const revokeObjectURL = vi.fn();
			Object.assign(URL, { createObjectURL, revokeObjectURL });

			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
			};
			vi.spyOn(document, "createElement").mockReturnValue(
				mockLink as unknown as HTMLElement
			);
			vi.spyOn(document.body, "appendChild").mockImplementation(
				() => mockLink as unknown as HTMLElement
			);
			vi.spyOn(document.body, "removeChild").mockImplementation(
				() => mockLink as unknown as HTMLElement
			);

			downloadAsFile("content here", "my-file.txt", "text/plain");

			expect(createObjectURL).toHaveBeenCalled();
			expect(mockLink.download).toBe("my-file.txt");
			expect(mockLink.click).toHaveBeenCalled();
			expect(revokeObjectURL).toHaveBeenCalled();
		});
	});

	describe("downloadAsMarkdown", () => {
		it("creates blob and triggers download with .md extension", () => {
			const createObjectURL = vi.fn().mockReturnValue("blob:test");
			const revokeObjectURL = vi.fn();
			Object.assign(URL, { createObjectURL, revokeObjectURL });

			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
			};
			vi.spyOn(document, "createElement").mockReturnValue(
				mockLink as unknown as HTMLElement
			);
			vi.spyOn(document.body, "appendChild").mockImplementation(
				() => mockLink as unknown as HTMLElement
			);
			vi.spyOn(document.body, "removeChild").mockImplementation(
				() => mockLink as unknown as HTMLElement
			);

			downloadAsMarkdown("# Hello", "test-file");

			expect(mockLink.download).toBe("test-file.md");
			expect(mockLink.click).toHaveBeenCalled();
			expect(revokeObjectURL).toHaveBeenCalled();
		});
	});

	describe("downloadAsJson", () => {
		it("stringifies data and triggers download with .json extension", () => {
			const createObjectURL = vi.fn().mockReturnValue("blob:test");
			const revokeObjectURL = vi.fn();
			Object.assign(URL, { createObjectURL, revokeObjectURL });

			const mockLink = {
				href: "",
				download: "",
				click: vi.fn(),
			};
			vi.spyOn(document, "createElement").mockReturnValue(
				mockLink as unknown as HTMLElement
			);
			vi.spyOn(document.body, "appendChild").mockImplementation(
				() => mockLink as unknown as HTMLElement
			);
			vi.spyOn(document.body, "removeChild").mockImplementation(
				() => mockLink as unknown as HTMLElement
			);

			downloadAsJson({ key: "value" }, "data-export");

			expect(mockLink.download).toBe("data-export.json");
			expect(mockLink.click).toHaveBeenCalled();
			expect(revokeObjectURL).toHaveBeenCalled();
		});
	});
});
