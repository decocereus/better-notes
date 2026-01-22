"use client";

import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";

interface CreateProjectDialogProps {
	trigger: React.ReactNode;
	onProjectCreated?: (projectId: string) => void;
}

export function CreateProjectDialog({
	trigger,
	onProjectCreated,
}: CreateProjectDialogProps) {
	const createProject = useMutation(api.projects.create);

	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const trimmedName = name.trim();
		if (!trimmedName) {
			setError("Project name is required");
			return;
		}

		setIsLoading(true);

		try {
			const projectId = (await createProject({
				name: trimmedName,
				description: description.trim() || undefined,
			})) as string;

			// Reset form
			setName("");
			setDescription("");
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
				// Reset form on close
				setName("");
				setDescription("");
				setError(null);
			}
		}
	};

	return (
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
						<Label htmlFor="name">Name</Label>
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
						<Button disabled={isLoading || !name.trim()} type="submit">
							{isLoading && <Loader2 className="size-4 animate-spin" />}
							Create Project
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
