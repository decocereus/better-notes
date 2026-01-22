import { FileText, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function PatternsPage() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-2xl">Topper Patterns</h2>
					<p className="text-muted-foreground">
						Extracted patterns from topper essays
					</p>
				</div>
				<div className="flex gap-2">
					<Button disabled variant="outline">
						<RefreshCw className="size-4" />
						Refresh
					</Button>
					<Button>
						<Plus className="size-4" />
						Extract New
					</Button>
				</div>
			</div>

			{/* Empty State */}
			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<FileText className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">No patterns extracted yet</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Upload topper essays and extract patterns to see them here. Patterns
					include intro techniques, body structures, and conclusion styles.
				</p>
				<Link href="/upload">
					<Button className="mt-4">
						<Plus className="size-4" />
						Upload Essays
					</Button>
				</Link>
			</Card>

			{/* Pattern Categories - Placeholder */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Card className="p-4">
					<h4 className="font-medium">Intro Techniques</h4>
					<p className="text-muted-foreground text-sm">0 patterns</p>
				</Card>
				<Card className="p-4">
					<h4 className="font-medium">Body Structures</h4>
					<p className="text-muted-foreground text-sm">0 patterns</p>
				</Card>
				<Card className="p-4">
					<h4 className="font-medium">Example Types</h4>
					<p className="text-muted-foreground text-sm">0 patterns</p>
				</Card>
				<Card className="p-4">
					<h4 className="font-medium">Conclusion Styles</h4>
					<p className="text-muted-foreground text-sm">0 patterns</p>
				</Card>
				<Card className="p-4">
					<h4 className="font-medium">Transitions</h4>
					<p className="text-muted-foreground text-sm">0 patterns</p>
				</Card>
				<Card className="p-4">
					<h4 className="font-medium">Argument Styles</h4>
					<p className="text-muted-foreground text-sm">0 patterns</p>
				</Card>
			</div>

			{/* Overused Examples Alert */}
			<Card className="border-amber-500/20 bg-amber-500/5 p-4">
				<h4 className="font-medium text-amber-700 dark:text-amber-400">
					Overused Examples to Avoid
				</h4>
				<p className="mt-1 text-muted-foreground text-sm">
					Common overused examples: Gandhi, Buddha, Ashoka, Mandela. These will
					be flagged when detected in your content.
				</p>
			</Card>
		</div>
	);
}
