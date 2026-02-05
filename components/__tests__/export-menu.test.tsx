import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
	toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/utils/export", () => ({
	copyToClipboard: vi.fn().mockResolvedValue(true),
	downloadAsJson: vi.fn(),
	downloadAsMarkdown: vi.fn(),
}));

import { ExportMenu } from "../export-menu";

describe("ExportMenu", () => {
	it("renders the export button", () => {
		render(
			<ExportMenu filename="test" jsonData={{ test: true }} markdown="# Test" />
		);
		expect(screen.getByText("Export")).toBeInTheDocument();
	});

	it("renders as a button element", () => {
		render(
			<ExportMenu filename="test" jsonData={{ test: true }} markdown="# Test" />
		);
		const button = screen.getByRole("button");
		expect(button).toBeInTheDocument();
		expect(button).toHaveTextContent("Export");
	});
});
