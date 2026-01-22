import { type NextRequest, NextResponse } from "next/server";
import { projectsStorage } from "@/lib/storage";
import type { CreateProjectInput, Project } from "@/types/project";

/**
 * GET /api/projects
 * Returns all projects sorted by most recently updated.
 */
export function GET() {
	try {
		const projects = projectsStorage.getAll();
		// Sort by updatedAt descending
		const sorted = [...projects].sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		);

		return NextResponse.json({ projects: sorted });
	} catch (error) {
		console.error("Failed to get projects:", error);
		return NextResponse.json(
			{ error: "Failed to retrieve projects" },
			{ status: 500 }
		);
	}
}

/**
 * POST /api/projects
 * Creates a new project.
 */
export async function POST(request: NextRequest) {
	try {
		const body = (await request.json()) as CreateProjectInput;

		if (!body.name || typeof body.name !== "string") {
			return NextResponse.json(
				{ error: "Project name is required" },
				{ status: 400 }
			);
		}

		const trimmedName = body.name.trim();
		if (trimmedName.length === 0) {
			return NextResponse.json(
				{ error: "Project name cannot be empty" },
				{ status: 400 }
			);
		}

		const now = new Date().toISOString();
		const project: Project = {
			id: crypto.randomUUID(),
			name: trimmedName,
			description: body.description?.trim(),
			createdAt: now,
			updatedAt: now,
			sources: [],
		};

		projectsStorage.add(project);

		return NextResponse.json({ project }, { status: 201 });
	} catch (error) {
		console.error("Failed to create project:", error);
		return NextResponse.json(
			{ error: "Failed to create project" },
			{ status: 500 }
		);
	}
}
