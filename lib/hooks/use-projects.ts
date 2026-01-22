"use client";

import { useCallback, useEffect, useState } from "react";
import { projectsStorage } from "@/lib/storage";
import type {
	AddSourceInput,
	ContentSource,
	CreateProjectInput,
	Project,
} from "@/types/project";

/**
 * Hook for managing projects with localStorage persistence.
 * Handles SSR/hydration safely.
 */
export function useProjects() {
	const [projects, setProjects] = useState<Project[]>([]);
	const [isHydrated, setIsHydrated] = useState(false);

	// Hydrate from localStorage after mount
	useEffect(() => {
		setProjects(projectsStorage.getAll());
		setIsHydrated(true);
	}, []);

	/**
	 * Refreshes the projects list from storage.
	 */
	const refresh = useCallback(() => {
		setProjects(projectsStorage.getAll());
	}, []);

	/**
	 * Creates a new project.
	 */
	const createProject = useCallback(
		(input: CreateProjectInput): Project => {
			const now = new Date().toISOString();
			const project: Project = {
				id: crypto.randomUUID(),
				name: input.name,
				description: input.description,
				createdAt: now,
				updatedAt: now,
				sources: [],
			};

			projectsStorage.add(project);
			refresh();
			return project;
		},
		[refresh]
	);

	/**
	 * Gets a project by ID.
	 */
	const getProject = useCallback((id: string): Project | undefined => {
		return projectsStorage.getById(id);
	}, []);

	/**
	 * Updates a project.
	 */
	const updateProject = useCallback(
		(
			id: string,
			updates: Partial<Omit<Project, "id">>
		): Project | undefined => {
			const updated = projectsStorage.update(id, {
				...updates,
				updatedAt: new Date().toISOString(),
			});
			refresh();
			return updated;
		},
		[refresh]
	);

	/**
	 * Deletes a project.
	 */
	const deleteProject = useCallback(
		(id: string): boolean => {
			const result = projectsStorage.remove(id);
			refresh();
			return result;
		},
		[refresh]
	);

	/**
	 * Adds a content source to a project.
	 */
	const addSource = useCallback(
		(projectId: string, input: AddSourceInput): ContentSource | undefined => {
			const project = projectsStorage.getById(projectId);
			if (!project) {
				return undefined;
			}

			const source: ContentSource = {
				id: crypto.randomUUID(),
				type: input.type,
				reference: input.reference,
				name: input.name,
				addedAt: new Date().toISOString(),
				status: "pending",
			};

			projectsStorage.update(projectId, {
				sources: [...project.sources, source],
				updatedAt: new Date().toISOString(),
			});

			refresh();
			return source;
		},
		[refresh]
	);

	/**
	 * Updates a content source within a project.
	 */
	const updateSource = useCallback(
		(
			projectId: string,
			sourceId: string,
			updates: Partial<ContentSource>
		): ContentSource | undefined => {
			const project = projectsStorage.getById(projectId);
			if (!project) {
				return undefined;
			}

			let updatedSource: ContentSource | undefined;
			const updatedSources = project.sources.map((source) => {
				if (source.id === sourceId) {
					updatedSource = { ...source, ...updates };
					return updatedSource;
				}
				return source;
			});

			if (updatedSource) {
				projectsStorage.update(projectId, {
					sources: updatedSources,
					updatedAt: new Date().toISOString(),
				});
				refresh();
			}

			return updatedSource;
		},
		[refresh]
	);

	/**
	 * Removes a content source from a project.
	 */
	const removeSource = useCallback(
		(projectId: string, sourceId: string): boolean => {
			const project = projectsStorage.getById(projectId);
			if (!project) {
				return false;
			}

			const filteredSources = project.sources.filter((s) => s.id !== sourceId);
			if (filteredSources.length === project.sources.length) {
				return false;
			}

			projectsStorage.update(projectId, {
				sources: filteredSources,
				updatedAt: new Date().toISOString(),
			});

			refresh();
			return true;
		},
		[refresh]
	);

	/**
	 * Gets projects sorted by most recently updated.
	 */
	const recentProjects = useCallback(
		(limit = 5): Project[] => {
			return [...projects]
				.sort(
					(a, b) =>
						new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
				)
				.slice(0, limit);
		},
		[projects]
	);

	return {
		projects,
		isHydrated,
		createProject,
		getProject,
		updateProject,
		deleteProject,
		addSource,
		updateSource,
		removeSource,
		recentProjects,
		refresh,
	};
}
