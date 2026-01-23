"use client";

/**
 * Global Compare Content Component
 * Displays comparison overview across all themes.
 * Note: Now requires project context for theme data.
 */

import { BookOpen, FolderKanban } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Global comparison view component.
 * Requires project selection to access theme data.
 */
export function GlobalCompareContent() {
	// Note: This component now requires project context
	// Theme pages are per-project, not global
	// Users should access comparison from within a project

	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-2xl">Global Comparison</h2>
				<p className="text-muted-foreground">
					Compare your content across all themes
				</p>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<FolderKanban className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Select a Project</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Theme pages are now associated with projects. Please select a project
					to compare content against its theme hierarchy.
				</p>
				<Link href="/projects">
					<Button className="mt-4">Go to Projects</Button>
				</Link>
			</Card>

			<Card className="p-6">
				<h3 className="flex items-center gap-2 font-medium text-lg">
					<BookOpen className="size-5" />
					How It Works
				</h3>
				<ol className="mt-4 ml-4 list-decimal space-y-2 text-muted-foreground text-sm">
					<li>Create or select a project</li>
					<li>The project has an associated theme page</li>
					<li>Process topper essays and run classification</li>
					<li>Access comparison from the project detail page</li>
				</ol>
			</Card>
		</div>
	);
}
