import { FileText, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotesPage() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-2xl">Generated Notes</h2>
					<p className="text-muted-foreground">
						Revision-ready notes organized by theme
					</p>
				</div>
				<div className="flex gap-2">
					<Button disabled variant="outline">
						<Upload className="size-4" />
						Sync All to Notion
					</Button>
					<Button disabled>
						<Plus className="size-4" />
						Generate Notes
					</Button>
				</div>
			</div>

			{/* Empty State */}
			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<FileText className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">No notes generated yet</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Notes are generated after comparing your content with topper essays.
					Each theme will have two sections: Your Notes and Topper Insights.
				</p>
				<Link href="/compare">
					<Button className="mt-4">Go to Comparison</Button>
				</Link>
			</Card>

			{/* Note Format Preview */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Note Format</h3>
				<p className="mb-4 text-muted-foreground text-sm">
					Generated notes follow a dual-section structure:
				</p>
				<div className="space-y-4">
					<div className="rounded-md bg-muted/50 p-4">
						<p className="font-medium text-sm">Your Notes</p>
						<p className="text-muted-foreground text-xs">
							Concise, revision-ready content from your classified notes.
							Organized and distilled to key points.
						</p>
					</div>
					<div className="rounded-md bg-muted/50 p-4">
						<p className="font-medium text-sm">Topper Insights</p>
						<p className="text-muted-foreground text-xs">
							High-value additions from topper essays. Unique examples, strong
							arguments, and techniques you&apos;re missing.
						</p>
					</div>
				</div>
			</Card>

			{/* Themes List - Placeholder */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Notes by Theme</h3>
				<p className="text-muted-foreground text-sm">
					Connect Notion and set up themes to see the list of available themes
					for note generation.
				</p>
			</Card>
		</div>
	);
}
