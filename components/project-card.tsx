"use client";

import { FileText, FolderOpen, MoreVertical, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/types/project";

interface ProjectCardProps {
	project: Project;
	onDelete?: (id: string) => void;
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
	const router = useRouter();

	const handleClick = () => {
		router.push(`/projects/${project.id}`);
	};

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDelete?.(project.id);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	};

	const sourceCount = project.sources.length;

	return (
		<Card
			className="group relative cursor-pointer transition-colors hover:bg-muted/50"
			onClick={handleClick}
		>
			<CardHeader>
				<div className="flex items-start justify-between">
					<div className="flex items-center gap-3">
						<div className="rounded-md bg-primary/10 p-2">
							<FolderOpen className="size-5 text-primary" />
						</div>
						<div>
							<CardTitle className="text-base">{project.name}</CardTitle>
							{project.description && (
								<CardDescription className="mt-0.5 line-clamp-1">
									{project.description}
								</CardDescription>
							)}
						</div>
					</div>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								className="opacity-0 group-hover:opacity-100"
								onClick={(e) => e.stopPropagation()}
								size="icon"
								variant="ghost"
							>
								<MoreVertical className="size-4" />
								<span className="sr-only">More options</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={handleClick}>
								<FolderOpen className="size-4" />
								Open
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onClick={handleDelete}
							>
								<Trash2 className="size-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="mt-3 flex items-center gap-3 text-muted-foreground text-xs">
					<Badge className="gap-1" variant="secondary">
						<FileText className="size-3" />
						{sourceCount} {sourceCount === 1 ? "source" : "sources"}
					</Badge>
					<span>Updated {formatDate(project.updatedAt)}</span>
				</div>
			</CardHeader>
		</Card>
	);
}
