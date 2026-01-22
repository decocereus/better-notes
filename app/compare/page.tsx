import { ArrowLeftRight, BookOpen, Play } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ComparePage() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-2xl">Comparison Tool</h2>
					<p className="text-muted-foreground">
						Compare your content against topper essays
					</p>
				</div>
				<Button disabled>
					<Play className="size-4" />
					Run Comparison
				</Button>
			</div>

			{/* Setup Required */}
			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<ArrowLeftRight className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Setup Required</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Before running comparison, you need classified content and extracted
					topper patterns.
				</p>
				<div className="mt-4 flex gap-2">
					<Link href="/projects">
						<Button variant="outline">Add Content</Button>
					</Link>
					<Link href="/patterns">
						<Button variant="outline">View Patterns</Button>
					</Link>
				</div>
			</Card>

			{/* Theme Selection - Placeholder */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Select Theme</h3>
				<p className="mb-4 text-muted-foreground text-sm">
					Choose a theme to compare your content against topper content.
				</p>
				<div className="flex items-center justify-center rounded-md border border-border border-dashed p-8">
					<div className="text-center">
						<BookOpen className="mx-auto mb-2 size-6 text-muted-foreground" />
						<p className="text-muted-foreground text-sm">
							No themes available. Connect Notion first.
						</p>
					</div>
				</div>
			</Card>

			{/* Comparison Mode */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Comparison Mode</h3>
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="rounded-md border border-primary bg-primary/5 p-4">
						<p className="font-medium">Content Extraction</p>
						<p className="text-muted-foreground text-sm">
							Compare extracted content against topper insights
						</p>
					</div>
					<div className="rounded-md border border-border p-4 opacity-50">
						<p className="font-medium">Writer Mode</p>
						<p className="text-muted-foreground text-sm">
							Evaluate essay writing quality (Coming Soon)
						</p>
					</div>
				</div>
			</Card>

			{/* Results Preview - Placeholder */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Comparison Results</h3>
				<p className="text-muted-foreground text-sm">
					Run a comparison to see results here. Results will show what you have
					covered, gaps, and suggestions for improvement.
				</p>
			</Card>
		</div>
	);
}
