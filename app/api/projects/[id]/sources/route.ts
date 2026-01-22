import { type NextRequest, NextResponse } from "next/server";
import { projectsStorage } from "@/lib/storage";
import type { AddSourceInput, ContentSource } from "@/types/project";

interface RouteParams {
	params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/[id]/sources
 * Adds a content source to a project.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const body = (await request.json()) as AddSourceInput;

		const project = projectsStorage.getById(id);
		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		// Validate input
		if (!(body.type && body.reference && body.name)) {
			return NextResponse.json(
				{ error: "type, reference, and name are required" },
				{ status: 400 }
			);
		}

		const validTypes = ["notion", "pdf", "image", "text"];
		if (!validTypes.includes(body.type)) {
			return NextResponse.json(
				{
					error: `Invalid source type. Must be one of: ${validTypes.join(", ")}`,
				},
				{ status: 400 }
			);
		}

		const source: ContentSource = {
			id: crypto.randomUUID(),
			type: body.type,
			reference: body.reference,
			name: body.name.trim(),
			addedAt: new Date().toISOString(),
			status: "pending",
		};

		projectsStorage.update(id, {
			sources: [...project.sources, source],
			updatedAt: new Date().toISOString(),
		});

		return NextResponse.json({ source }, { status: 201 });
	} catch (error) {
		console.error("Failed to add source:", error);
		return NextResponse.json(
			{ error: "Failed to add content source" },
			{ status: 500 }
		);
	}
}

/**
 * DELETE /api/projects/[id]/sources
 * Removes a content source from a project.
 * Expects { sourceId: string } in body.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
	try {
		const { id } = await params;
		const body = (await request.json()) as { sourceId: string };

		if (!body.sourceId) {
			return NextResponse.json(
				{ error: "sourceId is required" },
				{ status: 400 }
			);
		}

		const project = projectsStorage.getById(id);
		if (!project) {
			return NextResponse.json({ error: "Project not found" }, { status: 404 });
		}

		const sourceExists = project.sources.some((s) => s.id === body.sourceId);
		if (!sourceExists) {
			return NextResponse.json({ error: "Source not found" }, { status: 404 });
		}

		const filteredSources = project.sources.filter(
			(s) => s.id !== body.sourceId
		);

		projectsStorage.update(id, {
			sources: filteredSources,
			updatedAt: new Date().toISOString(),
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to remove source:", error);
		return NextResponse.json(
			{ error: "Failed to remove content source" },
			{ status: 500 }
		);
	}
}
