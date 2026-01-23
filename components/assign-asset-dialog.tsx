"use client";

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
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { Asset } from "@/types/asset";

interface Project {
	id: string;
	name: string;
}

interface AssignAssetDialogProps {
	asset: Asset | null;
	projects: Project[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAssign: (assetId: string, projectId: string | null) => Promise<void>;
}

export function AssignAssetDialog({
	asset,
	projects,
	open,
	onOpenChange,
	onAssign,
}: AssignAssetDialogProps) {
	const [selectedProject, setSelectedProject] = useState<string>(
		asset?.projectId?.toString() || "unassigned"
	);
	const [isLoading, setIsLoading] = useState(false);

	const handleAssign = async () => {
		if (!asset) {
			return;
		}

		setIsLoading(true);
		try {
			const projectId =
				selectedProject === "unassigned" ? null : selectedProject;
			await onAssign(asset.id.toString(), projectId);
			onOpenChange(false);
		} catch (err) {
			console.error("Failed to assign asset:", err);
		} finally {
			setIsLoading(false);
		}
	};

	// Reset selection when asset changes
	if (
		asset &&
		selectedProject !== (asset.projectId?.toString() || "unassigned")
	) {
		setSelectedProject(asset.projectId?.toString() || "unassigned");
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Assign to Project</DialogTitle>
					<DialogDescription>
						Choose a project to assign &quot;{asset?.filename}&quot; to, or
						leave unassigned.
					</DialogDescription>
				</DialogHeader>

				<div className="py-4">
					<Select onValueChange={setSelectedProject} value={selectedProject}>
						<SelectTrigger>
							<SelectValue placeholder="Select a project" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="unassigned">Unassigned</SelectItem>
							{projects.map((project) => (
								<SelectItem key={project.id} value={project.id}>
									{project.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<DialogFooter>
					<Button
						disabled={isLoading}
						onClick={() => onOpenChange(false)}
						variant="outline"
					>
						Cancel
					</Button>
					<Button disabled={isLoading} onClick={handleAssign}>
						{isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
						{asset?.projectId ? "Reassign" : "Assign"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
