import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Convex hooks
vi.mock("convex/react", () => ({
	useQuery: vi.fn(() => []),
}));

import { useQuery } from "convex/react";
// Import after mocks
import { RecentProjects } from "../recent-projects";

describe("RecentProjects", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders the component with title", () => {
		vi.mocked(useQuery).mockReturnValue([]);
		render(<RecentProjects />);
		expect(screen.getByText("Recent Projects")).toBeInTheDocument();
	});

	it("shows loading spinner when query is pending", () => {
		vi.mocked(useQuery).mockReturnValue(undefined);

		render(<RecentProjects />);
		// Loading spinner uses Loader2 icon with animate-spin class
		const spinner = document.querySelector(".animate-spin");
		expect(spinner).toBeInTheDocument();
	});

	it("shows empty state when no projects", () => {
		vi.mocked(useQuery).mockReturnValue([]);

		render(<RecentProjects />);
		expect(screen.getByText("No projects yet")).toBeInTheDocument();
		expect(
			screen.getByText("Create your first project to get started")
		).toBeInTheDocument();
		const createLink = screen.getByText("Create Project").closest("a");
		expect(createLink).toHaveAttribute("href", "/projects");
	});

	it("renders projects when available", () => {
		const mockProjects = [
			{
				id: "1",
				name: "Test Project",
				description: "A test project",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sources: [
					{
						id: "s1",
						type: "notion" as const,
						reference: "https://notion.so/page",
						name: "Test Source",
						addedAt: new Date().toISOString(),
						status: "completed" as const,
					},
					{
						id: "s2",
						type: "notion" as const,
						reference: "https://notion.so/page2",
						name: "Test Source 2",
						addedAt: new Date().toISOString(),
						status: "completed" as const,
					},
				],
			},
		];

		vi.mocked(useQuery).mockReturnValue(mockProjects);

		render(<RecentProjects />);
		expect(screen.getByText("Test Project")).toBeInTheDocument();
		expect(screen.getByText("A test project")).toBeInTheDocument();
		expect(screen.getByText("View All")).toBeInTheDocument();
	});

	it("shows source count badge", () => {
		const mockProjects = [
			{
				id: "1",
				name: "Project with sources",
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				sources: [
					{
						id: "s1",
						type: "notion" as const,
						reference: "https://notion.so/page",
						name: "Test Source",
						addedAt: new Date().toISOString(),
						status: "completed" as const,
					},
					{
						id: "s2",
						type: "notion" as const,
						reference: "https://notion.so/page2",
						name: "Test Source 2",
						addedAt: new Date().toISOString(),
						status: "completed" as const,
					},
					{
						id: "s3",
						type: "notion" as const,
						reference: "https://notion.so/page3",
						name: "Test Source 3",
						addedAt: new Date().toISOString(),
						status: "completed" as const,
					},
				],
			},
		];

		vi.mocked(useQuery).mockReturnValue(mockProjects);

		render(<RecentProjects />);
		// The badge should show the count "3"
		expect(screen.getByText("3")).toBeInTheDocument();
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

		vi.mocked(useQuery).mockReturnValue(mockProjects);

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

		vi.mocked(useQuery).mockReturnValue(mockProjects);

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

		vi.mocked(useQuery).mockReturnValue(mockProjects);

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

		vi.mocked(useQuery).mockReturnValue(mockProjects);

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

		vi.mocked(useQuery).mockReturnValue(mockProjects);

		render(<RecentProjects />);
		expect(screen.getByText("2 days ago")).toBeInTheDocument();
	});
});
