"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";

interface EditProjectDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: {
		id: string;
		name: string;
		description?: string;
		themePageId?: string;
	};
}

export function EditProjectDialog({
	open,
	onOpenChange,
	project,
}: EditProjectDialogProps) {
	const [name, setName] = useState(project.name);
	const [description, setDescription] = useState(project.description ?? "");
	const [themePageId, setThemePageId] = useState(project.themePageId ?? "");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");

	const updateProject = useMutation(api.projects.update);
	const themePages = useQuery(api.themePages.list);

	async function handleSubmit() {
		if (!name.trim()) {
			setError("Project name is required");
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			await updateProject({
				id: project.id as never,
				name: name.trim(),
				description: description.trim() || undefined,
				themePageId: themePageId ? (themePageId as never) : undefined,
			});
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to update project");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Edit Project</DialogTitle>
				</DialogHeader>
				<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="edit-name">Name</Label>
						<Input
							id="edit-name"
							onChange={(e) => setName(e.target.value)}
							placeholder="Project name"
							value={name}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="edit-description">Description</Label>
						<Textarea
							id="edit-description"
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Optional description"
							rows={3}
							value={description}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="edit-theme">Theme Page</Label>
						<Select onValueChange={setThemePageId} value={themePageId}>
							<SelectTrigger id="edit-theme">
								<SelectValue placeholder="Select theme page" />
							</SelectTrigger>
							<SelectContent>
								{(themePages ?? []).map((tp) => (
									<SelectItem key={tp._id} value={tp._id}>
										{tp.title}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					{error && <p className="text-red-400 text-sm">{error}</p>}
				</div>
				<DialogFooter>
					<Button
						disabled={isLoading}
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button disabled={isLoading} onClick={handleSubmit} type="button">
						{isLoading ? "Saving..." : "Save Changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
