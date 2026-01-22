import { type NextRequest, NextResponse } from "next/server";
import { projectsStorage } from "@/lib/storage";
import type { Project } from "@/types/project";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/[id]
 * Returns a single project by ID.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const project = projectsStorage.getById(id);

		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		return NextResponse.json({ project });
	} catch (error) {
		console.error("Failed to get project:", error);
		return NextResponse.json(
			{ error: "Failed to retrieve project" },
			{ status: 500 }
		);
	}
}

/**
 * PUT /api/projects/[id]
 * Updates a project.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const body = (await request.json()) as Partial<
			Pick<Project, "name" | "description">
		>;

		const existing = projectsStorage.getById(id);
		if (!existing) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const updates: Partial<Project> = {
			updatedAt: new Date().toISOString(),
		};

		if (body.name !== undefined) {
			const trimmedName = body.name.trim();
			if (trimmedName.length === 0) {
				return NextResponse.json(
					{ error: "Project name cannot be empty" },
					{ status: 400 }
				);
			}
			updates.name = trimmedName;
		}

		if (body.description !== undefined) {
			updates.description = body.description.trim() || undefined;
		}

		const project = projectsStorage.update(id, updates);

		return NextResponse.json({ project });
	} catch (error) {
		console.error("Failed to update project:", error);
		return NextResponse.json(
			{ error: "Failed to update project" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/projects/[id]
 * Deletes a project.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const existing = projectsStorage.getById(id);

		if (!existing) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		projectsStorage.remove(id);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to delete project:", error);
		return NextResponse.json(
			{ error: "Failed to delete project" },
			{ status: 500 }
		);
	}
}
