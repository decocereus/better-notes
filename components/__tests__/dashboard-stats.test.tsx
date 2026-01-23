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

vi.mock("convex/react", () => ({
	useQuery: vi.fn(() => []),
}));

import { useQuery } from "convex/react";
import { useSettings } from "@/lib/hooks/use-settings";
// Import after mocks
import { DashboardStats } from "../dashboard-stats";

describe("DashboardStats", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: Notion not connected
		vi.mocked(global.fetch).mockResolvedValue({
			json: () => Promise.resolve({ valid: false }),
		} as Response);
	});

	it("renders stats cards with default values when no data", async () => {
		vi.mocked(useQuery).mockReturnValue([]);
		render(<DashboardStats />);

		await waitFor(() => {
			expect(screen.getByText("Main Themes")).toBeInTheDocument();
		});
		expect(screen.getByText("Questions")).toBeInTheDocument();
		expect(screen.getByText("Projects")).toBeInTheDocument();
		expect(screen.getByText("Mini Themes")).toBeInTheDocument();
	});

	it("shows project count from hook", async () => {
		// Mock useQuery to return projects for any query (simplifies testing)
		const mockProjects = [
			{
				id: "1",
				name: "Test",
				createdAt: "",
				updatedAt: "",
				sources: [],
			},
			{
				id: "2",
				name: "Test2",
				createdAt: "",
				updatedAt: "",
				sources: [],
			},
		];
		vi.mocked(useQuery).mockReturnValue(mockProjects);

		render(<DashboardStats />);

		await waitFor(() => {
			expect(screen.getByText("2")).toBeInTheDocument();
		});
	});

	it("renders connection status section", async () => {
		vi.mocked(useQuery).mockReturnValue([]);
		render(<DashboardStats />);

		await waitFor(() => {
			expect(screen.getByText("Connection Status")).toBeInTheDocument();
		});
		expect(screen.getByText("Notion API")).toBeInTheDocument();
		expect(screen.getByText("Theme Pages")).toBeInTheDocument();
		expect(screen.getByText("LLM Models")).toBeInTheDocument();
	});

	it("shows not configured when Notion is not connected", async () => {
		vi.mocked(useQuery).mockReturnValue([]);
		vi.mocked(useSettings).mockReturnValue({
			settings: {},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardStats />);

		await waitFor(() => {
			const notConfiguredElements = screen.getAllByText("Not configured");
			expect(notConfiguredElements.length).toBeGreaterThanOrEqual(2);
		});
	});

	it("shows using defaults for LLM when no custom config", async () => {
		vi.mocked(useQuery).mockReturnValue([]);
		render(<DashboardStats />);

		await waitFor(() => {
			expect(screen.getByText("Using defaults")).toBeInTheDocument();
		});
	});

	it("shows custom config when model config exists", async () => {
		vi.mocked(useQuery).mockReturnValue([]);
		vi.mocked(useSettings).mockReturnValue({
			settings: {
				modelConfig: { ocr: "custom-model" },
			},
			isHydrated: true,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardStats />);

		await waitFor(() => {
			expect(screen.getByText("Custom config")).toBeInTheDocument();
		});
	});
});
