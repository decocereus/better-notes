import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock the hooks
vi.mock("@/lib/hooks/use-settings", () => ({
	useSettings: vi.fn(() => ({
		settings: {},
		isHydrated: true,
		updateSetting: vi.fn(),
		updateSettings: vi.fn(),
		clearSetting: vi.fn(),
		resetSettings: vi.fn(),
	})),
}));

// Mock Convex for child components (DashboardStats, RecentProjects)
vi.mock("convex/react", () => ({
	useQuery: vi.fn(() => []),
}));

import { useQuery } from "convex/react";
import { useSettings } from "@/lib/hooks/use-settings";
// Import after mocks
import { DashboardContent } from "../dashboard-content";

describe("DashboardContent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: Notion not connected, no theme pages
		vi.mocked(global.fetch).mockResolvedValue({
			json: () => Promise.resolve({ valid: false }),
		} as Response);
		vi.mocked(useQuery).mockReturnValue([]);
	});

	it("shows loading spinner when not hydrated", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		// Loading spinner uses Loader2 icon with animate-spin class
		const spinner = document.querySelector(".animate-spin");
		expect(spinner).toBeInTheDocument();
	});

	it("renders welcome section", async () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		await waitFor(() => {
			expect(screen.getByText("Welcome to BetterNotes")).toBeInTheDocument();
			expect(
				screen.getByText("Your intelligent UPSC essay preparation assistant")
			).toBeInTheDocument();
		});
	});

	it("shows setup wizard when setup is incomplete", async () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);

		// Wait for fetch to complete
		await waitFor(() => {
			expect(screen.getByText("Complete Setup")).toBeInTheDocument();
		});
		expect(screen.getByText("Connect Notion API")).toBeInTheDocument();
		expect(screen.getByText("Add Theme Page")).toBeInTheDocument();
		expect(screen.getByText("Configure LLM Models")).toBeInTheDocument();
	});

	it("shows completion progress in setup wizard", async () => {
		// Notion connected
		vi.mocked(global.fetch).mockResolvedValue({
			json: () => Promise.resolve({ valid: true }),
		} as Response);
		// No theme pages yet
		vi.mocked(useQuery).mockReturnValue([]);

		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);

		await waitFor(() => {
			expect(screen.getByText("1/3 completed")).toBeInTheDocument();
		});
	});

	it("hides setup wizard when basic setup is complete", async () => {
		// Notion connected
		vi.mocked(global.fetch).mockResolvedValue({
			json: () => Promise.resolve({ valid: true }),
		} as Response);
		// Mock useQuery to return data that works for all components:
		// - theme pages (needs _id, title)
		// - projects (needs id, name, sources, createdAt, updatedAt)
		vi.mocked(useQuery).mockReturnValue([
			{
				_id: "1",
				id: "1",
				title: "Test",
				name: "Test Project",
				sources: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);

		vi.mocked(useSettings).mockReturnValue({
			settings: { modelConfig: { ocr: "custom" } },
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);

		// Wait for setup wizard to fully process (loading completes, wizard evaluates isComplete)
		// When isComplete is true, the wizard returns null, so we verify:
		// 1. The loading spinner is NOT present (setup wizard finished loading)
		// 2. "Complete Setup" is NOT present (wizard returns null because isComplete=true)
		await waitFor(
			() => {
				// First verify loading is done by checking Overview is visible
				expect(screen.getByText("Overview")).toBeInTheDocument();
				// Then verify setup wizard is not shown
				expect(screen.queryByText("Complete Setup")).not.toBeInTheDocument();
			},
			{ timeout: 3000 }
		);
	});

	it("renders overview section", async () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		await waitFor(() => {
			expect(screen.getByText("Overview")).toBeInTheDocument();
		});
	});

	it("renders quick actions section", async () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		await waitFor(() => {
			expect(screen.getByText("Quick Actions")).toBeInTheDocument();
		});
	});

	it("renders recent projects section", async () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		await waitFor(() => {
			expect(screen.getByText("Recent Projects")).toBeInTheDocument();
		});
	});

	it("has setup step links with correct hrefs", async () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);

		// Wait for setup wizard to render
		await waitFor(() => {
			expect(screen.getByText("Connect Notion API")).toBeInTheDocument();
		});

		// Use getByText to find links by their text content
		const notionLink = screen.getByText("Connect Notion API").closest("a");
		expect(notionLink).toHaveAttribute("href", "/settings");

		const themeLink = screen.getByText("Add Theme Page").closest("a");
		expect(themeLink).toHaveAttribute("href", "/themes");

		const llmLink = screen.getByText("Configure LLM Models").closest("a");
		expect(llmLink).toHaveAttribute("href", "/settings/models");
	});
});
