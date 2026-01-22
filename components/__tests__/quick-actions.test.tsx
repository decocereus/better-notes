import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuickActions } from "../quick-actions";

describe("QuickActions", () => {
	it("renders the section title", () => {
		render(<QuickActions />);
		expect(screen.getByText("Quick Actions")).toBeInTheDocument();
	});

	it("renders all quick action cards", () => {
		render(<QuickActions />);

		// Check for all action labels
		expect(screen.getByText("New Project")).toBeInTheDocument();
		expect(screen.getByText("Upload Files")).toBeInTheDocument();
		expect(screen.getByText("View Themes")).toBeInTheDocument();
		expect(screen.getByText("Patterns")).toBeInTheDocument();
		expect(screen.getByText("Settings")).toBeInTheDocument();
	});

	it("renders action descriptions", () => {
		render(<QuickActions />);

		expect(screen.getByText("Start a new project session")).toBeInTheDocument();
		expect(screen.getByText("Upload PDFs or images")).toBeInTheDocument();
		expect(screen.getByText("Browse essay themes")).toBeInTheDocument();
		expect(screen.getByText("View topper patterns")).toBeInTheDocument();
		expect(screen.getByText("Configure connections")).toBeInTheDocument();
	});

	it("has correct navigation links", () => {
		render(<QuickActions />);

		// Use getByText to find links by their label text
		const projectLink = screen.getByText("New Project").closest("a");
		expect(projectLink).toHaveAttribute("href", "/projects");

		const uploadLink = screen.getByText("Upload Files").closest("a");
		expect(uploadLink).toHaveAttribute("href", "/upload");

		const themesLink = screen.getByText("View Themes").closest("a");
		expect(themesLink).toHaveAttribute("href", "/themes");

		const patternsLink = screen.getByText("Patterns").closest("a");
		expect(patternsLink).toHaveAttribute("href", "/patterns");

		const settingsLink = screen.getByText("Settings").closest("a");
		expect(settingsLink).toHaveAttribute("href", "/settings");
	});

	it("renders 5 action cards in total", () => {
		render(<QuickActions />);

		// All links are rendered as cards
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(5);
	});
});
