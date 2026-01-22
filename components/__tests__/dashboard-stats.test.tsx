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

vi.mock("@/lib/hooks/use-projects", () => ({
	useProjects: vi.fn(() => ({
		projects: [],
		isHydrated: true,
	})),
}));

import { useProjects } from "@/lib/hooks/use-projects";
import { useSettings } from "@/lib/hooks/use-settings";
// Import after mocks
import { DashboardStats } from "../dashboard-stats";

describe("DashboardStats", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders stats cards with default values when no data", () => {
		render(<DashboardStats />);

		expect(screen.getByText("Main Themes")).toBeInTheDocument();
		expect(screen.getByText("Questions")).toBeInTheDocument();
		expect(screen.getByText("Projects")).toBeInTheDocument();
		expect(screen.getByText("Mini Themes")).toBeInTheDocument();
	});

	it("shows project count from hook", () => {
		vi.mocked(useProjects).mockReturnValue({
			projects: [
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
			],
			isHydrated: true,
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			recentProjects: vi.fn(),
			refresh: vi.fn(),
		});

		render(<DashboardStats />);
		expect(screen.getByText("2")).toBeInTheDocument();
	});

	it("renders connection status section", () => {
		render(<DashboardStats />);

		expect(screen.getByText("Connection Status")).toBeInTheDocument();
		expect(screen.getByText("Notion API")).toBeInTheDocument();
		expect(screen.getByText("Theme Page")).toBeInTheDocument();
		expect(screen.getByText("LLM Models")).toBeInTheDocument();
	});

	it("shows not configured when Notion is not connected", () => {
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

		render(<DashboardStats />);
		const notConfiguredElements = screen.getAllByText("Not configured");
		expect(notConfiguredElements.length).toBeGreaterThanOrEqual(2);
	});

	it("shows using defaults for LLM when no custom config", () => {
		render(<DashboardStats />);
		expect(screen.getByText("Using defaults")).toBeInTheDocument();
	});

	it("shows custom config when model config exists", () => {
		vi.mocked(useSettings).mockReturnValue({
			settings: {
				modelConfig: { ocr: "custom-model" },
			},
			isHydrated: true,
			isNotionConnected: false,
			hasThemePage: false,
			updateSetting: vi.fn(),
			updateSettings: vi.fn(),
			clearSetting: vi.fn(),
			resetSettings: vi.fn(),
		});

		render(<DashboardStats />);
		expect(screen.getByText("Custom config")).toBeInTheDocument();
	});
});
