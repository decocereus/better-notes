import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the hooks
vi.mock("@/lib/hooks/use-projects", () => ({
	useProjects: vi.fn(() => ({
		projects: [],
		isHydrated: true,
		recentProjects: vi.fn(() => []),
	})),
}));

import { useProjects } from "@/lib/hooks/use-projects";
// Import after mocks
import { RecentProjects } from "../recent-projects";

describe("RecentProjects", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the component with title", () => {
		render(<RecentProjects />);
		expect(screen.getByText("Recent Projects")).toBeInTheDocument();
	});

	it("shows loading spinner when not hydrated", () => {
		vi.mocked(useProjects).mockReturnValue({
			projects: [],
			isHydrated: false,
			recentProjects: vi.fn(() => []),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		// Loading spinner uses Loader2 icon with animate-spin class
		const spinner = document.querySelector(".animate-spin");
		expect(spinner).toBeInTheDocument();
	});

	it("shows empty state when no projects", () => {
		vi.mocked(useProjects).mockReturnValue({
			projects: [],
			isHydrated: true,
			recentProjects: vi.fn(() => []),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		expect(screen.getByText("No projects yet")).toBeInTheDocument();
		expect(
			screen.getByText("Create your first project to get started")
		).toBeInTheDocument();
		const createLink = screen.getByText("Create Project").closest("a");
		expect(createLink).toHaveAttribute("href", "/projects");
	});

	it("renders projects when available", () => {
		const mockSource = {
			id: "s1",
			type: "notion" as const,
			reference: "https://notion.so/page",
			name: "Test Source",
			addedAt: new Date().toISOString(),
			status: "completed" as const,
		};
		const mockProjects = [
			{
				id: "1",
				name: "Test Project",
				description: "A test project",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sources: [mockSource, { ...mockSource, id: "s2" }],
			},
		];

		vi.mocked(useProjects).mockReturnValue({
			projects: mockProjects,
			isHydrated: true,
			recentProjects: vi.fn(() => mockProjects),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		expect(screen.getByText("Test Project")).toBeInTheDocument();
		expect(screen.getByText("A test project")).toBeInTheDocument();
		expect(screen.getByText("View All")).toBeInTheDocument();
	});

	it("shows source count badge", () => {
		const mockSource = {
			id: "s1",
			type: "notion" as const,
			reference: "https://notion.so/page",
			name: "Test Source",
			addedAt: new Date().toISOString(),
			status: "completed" as const,
		};
		const mockProjects = [
			{
				id: "1",
				name: "Project with sources",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sources: [
					mockSource,
					{ ...mockSource, id: "s2" },
					{ ...mockSource, id: "s3" },
				],
			},
		];

		vi.mocked(useProjects).mockReturnValue({
			projects: mockProjects,
			isHydrated: true,
			recentProjects: vi.fn(() => mockProjects),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		// The badge should show the count "3"
		expect(screen.getByText("3")).toBeInTheDocument();
	});

	it("respects the limit prop", () => {
		const recentProjectsMock = vi.fn(() => []);

		vi.mocked(useProjects).mockReturnValue({
			projects: [],
			isHydrated: true,
			recentProjects: recentProjectsMock,
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects limit={3} />);
		expect(recentProjectsMock).toHaveBeenCalledWith(3);
	});

	it("links to individual project pages", () => {
		const mockProjects = [
			{
				id: "project-123",
				name: "Linked Project",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sources: [],
			},
		];

		vi.mocked(useProjects).mockReturnValue({
			projects: mockProjects,
			isHydrated: true,
			recentProjects: vi.fn(() => mockProjects),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		const projectLink = screen.getByText("Linked Project").closest("a");
		expect(projectLink).toHaveAttribute("href", "/projects/project-123");
	});
});

describe("formatRelativeTime", () => {
	// Note: formatRelativeTime is not exported, but we can test its behavior
	// through the component by checking the rendered output

	it("shows 'Just now' for very recent timestamps", () => {
		const mockProjects = [
			{
				id: "1",
				name: "Recent",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sources: [],
			},
		];

		vi.mocked(useProjects).mockReturnValue({
			projects: mockProjects,
			isHydrated: true,
			recentProjects: vi.fn(() => mockProjects),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		expect(screen.getByText("Just now")).toBeInTheDocument();
	});

	it("shows minutes ago for timestamps within an hour", () => {
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
		const mockProjects = [
			{
				id: "1",
				name: "Minutes ago",
				createdAt: fiveMinutesAgo,
				updatedAt: fiveMinutesAgo,
				sources: [],
			},
		];

		vi.mocked(useProjects).mockReturnValue({
			projects: mockProjects,
			isHydrated: true,
			recentProjects: vi.fn(() => mockProjects),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		expect(screen.getByText("5 minutes ago")).toBeInTheDocument();
	});

	it("shows hours ago for timestamps within a day", () => {
		const threeHoursAgo = new Date(
			Date.now() - 3 * 60 * 60 * 1000
		).toISOString();
		const mockProjects = [
			{
				id: "1",
				name: "Hours ago",
				createdAt: threeHoursAgo,
				updatedAt: threeHoursAgo,
				sources: [],
			},
		];

		vi.mocked(useProjects).mockReturnValue({
			projects: mockProjects,
			isHydrated: true,
			recentProjects: vi.fn(() => mockProjects),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		expect(screen.getByText("3 hours ago")).toBeInTheDocument();
	});

	it("shows days ago for older timestamps", () => {
		const twoDaysAgo = new Date(
			Date.now() - 2 * 24 * 60 * 60 * 1000
		).toISOString();
		const mockProjects = [
			{
				id: "1",
				name: "Days ago",
				createdAt: twoDaysAgo,
				updatedAt: twoDaysAgo,
				sources: [],
			},
		];

		vi.mocked(useProjects).mockReturnValue({
			projects: mockProjects,
			isHydrated: true,
			recentProjects: vi.fn(() => mockProjects),
			createProject: vi.fn(),
			getProject: vi.fn(),
			updateProject: vi.fn(),
			deleteProject: vi.fn(),
			addSource: vi.fn(),
			updateSource: vi.fn(),
			removeSource: vi.fn(),
			refresh: vi.fn(),
		});

		render(<RecentProjects />);
		expect(screen.getByText("2 days ago")).toBeInTheDocument();
	});
});
