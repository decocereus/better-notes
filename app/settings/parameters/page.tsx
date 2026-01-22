import { ArrowLeft, FileText, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ParametersPage() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/settings">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="font-semibold text-2xl">Extraction Parameters</h2>
					<p className="text-muted-foreground">
						Configure how content is extracted and analyzed
					</p>
				</div>
				<Button>
					<Save className="size-4" />
					Save Changes
				</Button>
			</div>

			{/* Strategy Document */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Strategy Document</h3>
				<p className="text-muted-foreground text-sm">
					Link a Notion page containing your strategy document. Parameters will
					be extracted automatically.
				</p>

				<div className="mt-4 flex flex-col items-center justify-center rounded-md border-2 border-border border-dashed p-8 text-center">
					<div className="mb-4 rounded-full bg-muted p-4">
						<FileText className="size-8 text-muted-foreground" />
					</div>
					<p className="font-medium">No strategy document linked</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Connect Notion first to link a strategy document
					</p>
					<Link href="/settings">
						<Button className="mt-4" variant="outline">
							Configure Notion
						</Button>
					</Link>
				</div>
			</Card>

			{/* Default Parameters */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Default Parameters</h3>
				<p className="mb-4 text-muted-foreground text-sm">
					These parameters are used when no strategy document is configured.
				</p>

				<div className="space-y-4">
					<div className="rounded-md bg-muted/50 p-4">
						<p className="font-medium text-sm">Relevance to Theme</p>
						<p className="text-muted-foreground text-xs">
							How closely content relates to the theme
						</p>
					</div>
					<div className="rounded-md bg-muted/50 p-4">
						<p className="font-medium text-sm">Uniqueness of Examples</p>
						<p className="text-muted-foreground text-xs">
							Preference for unique, non-overused examples
						</p>
					</div>
					<div className="rounded-md bg-muted/50 p-4">
						<p className="font-medium text-sm">Factual Accuracy</p>
						<p className="text-muted-foreground text-xs">
							Verification of facts and figures
						</p>
					</div>
					<div className="rounded-md bg-muted/50 p-4">
						<p className="font-medium text-sm">Cross-Theme Applicability</p>
						<p className="text-muted-foreground text-xs">
							Content that can be used across multiple themes
						</p>
					</div>
				</div>
			</Card>
		</div>
	);
}
