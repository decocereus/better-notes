"use client";

/**
 * Theme Compare Content Component
 * Displays comparison analysis between user content and topper content for a theme.
 * Note: Now requires project context for theme data.
 */

import { ArrowLeft, BookOpen, FolderKanban } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ThemeCompareContentProps {
	themeId: string;
}

/**
 * Client component for theme comparison.
 * Requires project context to access theme data.
 */
export function ThemeCompareContent({ themeId }: ThemeCompareContentProps) {
	// Note: This component now requires project context
	// Theme pages are per-project, not global
	// Users should access comparison from within a project

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/themes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="font-semibold text-2xl">Compare Content</h2>
					<p className="text-muted-foreground text-sm">Theme ID: {themeId}</p>
				</div>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<FolderKanban className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Select a Project</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Theme pages are now associated with projects. Please access theme
					comparison from within a project context.
				</p>
				<Link href="/projects">
					<Button className="mt-4">Go to Projects</Button>
				</Link>
			</Card>

			<Card className="p-6">
				<h3 className="flex items-center gap-2 font-medium text-lg">
					<BookOpen className="size-5" />
					How to Compare Themes
				</h3>
				<ol className="mt-4 ml-4 list-decimal space-y-2 text-muted-foreground text-sm">
					<li>Go to Projects and select a project</li>
					<li>The project has an associated theme page</li>
					<li>Process essays and run classification</li>
					<li>Access comparison from the project detail page</li>
				</ol>
			</Card>
		</div>
	);
}
