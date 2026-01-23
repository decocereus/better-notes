"use client";

import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { AddThemePageDialog } from "@/components/add-theme-page-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

interface CreateProjectDialogProps {
	trigger: React.ReactNode;
	onProjectCreated?: (projectId: string) => void;
}

/**
 * Dialog for creating a new project.
 * Requires theme page selection, with option to add new theme page inline.
 */
export function CreateProjectDialog({
	trigger,
	onProjectCreated,
}: CreateProjectDialogProps) {
	const createProject = useMutation(api.projects.create);
	const themePages = useQuery(api.themePages.list);

	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [themePageId, setThemePageId] = useState<Id<"themePages"> | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showAddThemePage, setShowAddThemePage] = useState(false);

	const resetForm = useCallback(() => {
		setName("");
		setDescription("");
		setThemePageId(null);
		setError(null);
	}, []);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const trimmedName = name.trim();
		if (!trimmedName) {
			setError("Project name is required");
			return;
		}

		if (!themePageId) {
			setError("Please select a theme page");
			return;
		}

		setIsLoading(true);

		try {
			const projectId = (await createProject({
				name: trimmedName,
				description: description.trim() || undefined,
				themePageId,
			})) as string;

			resetForm();
			setOpen(false);

			onProjectCreated?.(projectId);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create project");
		} finally {
			setIsLoading(false);
		}
	};

	const handleOpenChange = (newOpen: boolean) => {
		if (!isLoading) {
			setOpen(newOpen);
			if (!newOpen) {
				resetForm();
			}
		}
	};

	const handleThemePageChange = (value: string) => {
		if (value === "add-new") {
			setShowAddThemePage(true);
		} else {
			setThemePageId(value as Id<"themePages">);
		}
	};

	const handleThemePageAdded = (newThemePageId: Id<"themePages">) => {
		setThemePageId(newThemePageId);
	};

	const hasThemePages = themePages && themePages.length > 0;
	const isFormValid = name.trim() && themePageId;

	return (
		<>
			<Dialog onOpenChange={handleOpenChange} open={open}>
				<DialogTrigger asChild>{trigger}</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Project</DialogTitle>
						<DialogDescription>
							Create a project to organize your essay preparation content.
						</DialogDescription>
					</DialogHeader>

					<form className="grid gap-4" onSubmit={handleSubmit}>
						<div className="grid gap-2">
							<Label htmlFor="name">Name *</Label>
							<Input
								disabled={isLoading}
								id="name"
								onChange={(e) => setName(e.target.value)}
								placeholder="My Essay Project"
								value={name}
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="description">Description (optional)</Label>
							<Textarea
								disabled={isLoading}
								id="description"
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Brief description of this project..."
								rows={3}
								value={description}
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="theme-page">Theme Page *</Label>
							<Select
								disabled={isLoading}
								onValueChange={handleThemePageChange}
								value={themePageId ?? ""}
							>
								<SelectTrigger id="theme-page">
									<SelectValue placeholder="Select a theme page..." />
								</SelectTrigger>
								<SelectContent>
									{hasThemePages ? (
										<>
											{themePages.map((page) => (
												<SelectItem key={page.id} value={page.id}>
													{page.title} ({page.stats.questions} questions)
												</SelectItem>
											))}
											<SelectSeparator />
											<SelectItem value="add-new">
												<span className="flex items-center gap-2">
													<Plus className="size-4" />
													Add new theme page...
												</span>
											</SelectItem>
										</>
									) : (
										<SelectItem value="add-new">
											<span className="flex items-center gap-2">
												<Plus className="size-4" />
												Add your first theme page...
											</span>
										</SelectItem>
									)}
								</SelectContent>
							</Select>
							{!hasThemePages && (
								<p className="text-muted-foreground text-sm">
									You need at least one theme page to create a project.
								</p>
							)}
						</div>

						{error && <p className="text-destructive text-sm">{error}</p>}

						<DialogFooter>
							<Button
								disabled={isLoading}
								onClick={() => handleOpenChange(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button disabled={isLoading || !isFormValid} type="submit">
								{isLoading && <Loader2 className="size-4 animate-spin" />}
								Create Project
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* Controlled AddThemePageDialog */}
			<AddThemePageDialog
				onOpenChange={setShowAddThemePage}
				onThemePageAdded={handleThemePageAdded}
				open={showAddThemePage}
			/>
		</>
	);
}
