import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the hooks
vi.mock("@/lib/hooks/use-settings", () => ({
	useSettings: vi.fn(() => ({
		settings: {},
		isHydrated: true,
		isNotionConnected: false,
		hasThemePage: false,
	})),
}));

// Mock Convex for child components (DashboardStats, RecentProjects)
vi.mock("convex/react", () => ({
	useQuery: vi.fn(() => []),
}));

import { useSettings } from "@/lib/hooks/use-settings";
// Import after mocks
import { DashboardContent } from "../dashboard-content";

describe("DashboardContent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("shows loading spinner when not hydrated", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: false,
			isNotionConnected: false,
			hasThemePage: false,
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

	it("renders welcome section", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			isNotionConnected: false,
			hasThemePage: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		expect(screen.getByText("Welcome to BetterNotes")).toBeInTheDocument();
		expect(
			screen.getByText("Your intelligent UPSC essay preparation assistant")
		).toBeInTheDocument();
	});

	it("shows setup wizard when setup is incomplete", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			isNotionConnected: false,
			hasThemePage: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		expect(screen.getByText("Complete Setup")).toBeInTheDocument();
		expect(screen.getByText("Connect Notion API")).toBeInTheDocument();
		expect(screen.getByText("Select Theme Page")).toBeInTheDocument();
		expect(screen.getByText("Configure LLM Models")).toBeInTheDocument();
	});

	it("shows completion progress in setup wizard", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			isNotionConnected: true,
			hasThemePage: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		expect(screen.getByText("1/3 completed")).toBeInTheDocument();
	});

	it("hides setup wizard when basic setup is complete", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: { modelConfig: { ocr: "custom" } },
			isHydrated: true,
			isNotionConnected: true,
			hasThemePage: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		expect(screen.queryByText("Complete Setup")).not.toBeInTheDocument();
	});

	it("renders overview section", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			isNotionConnected: false,
			hasThemePage: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		expect(screen.getByText("Overview")).toBeInTheDocument();
	});

	it("renders quick actions section", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			isNotionConnected: false,
			hasThemePage: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		expect(screen.getByText("Quick Actions")).toBeInTheDocument();
	});

	it("renders recent projects section", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			isNotionConnected: false,
			hasThemePage: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);
		expect(screen.getByText("Recent Projects")).toBeInTheDocument();
	});

	it("has setup step links with correct hrefs", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			isNotionConnected: false,
			hasThemePage: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardContent />);

		// Use getByText to find links by their text content
		const notionLink = screen.getByText("Connect Notion API").closest("a");
		expect(notionLink).toHaveAttribute("href", "/settings");

		const themeLink = screen.getByText("Select Theme Page").closest("a");
		expect(themeLink).toHaveAttribute("href", "/themes");

		const llmLink = screen.getByText("Configure LLM Models").closest("a");
		expect(llmLink).toHaveAttribute("href", "/settings/models");
	});
});
