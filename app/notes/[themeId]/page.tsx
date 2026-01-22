import { ArrowLeft, FileText, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ThemeNotesPageProps {
	params: Promise<{ themeId: string }>;
}

export default async function ThemeNotesPage({ params }: ThemeNotesPageProps) {
	const { themeId } = await params;

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center gap-4">
				<Link href="/notes">
					<Button size="icon" variant="ghost">
						<ArrowLeft className="size-5" />
					</Button>
				</Link>
				<div className="flex-1">
					<h2 className="font-semibold text-2xl">Theme Notes</h2>
					<p className="text-muted-foreground text-sm">Theme ID: {themeId}</p>
				</div>
				<Button variant="outline">
					<Upload className="size-4" />
					Sync to Notion
				</Button>
			</div>

			{/* Notes Not Generated */}
			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<FileText className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Notes not generated yet</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Generate notes for this theme after classifying content and running
					comparison analysis.
				</p>
				<Link href={`/compare?theme=${themeId}`}>
					<Button className="mt-4">Go to Comparison</Button>
				</Link>
			</Card>

			{/* User Notes Section - Placeholder */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Your Notes</h3>
				<p className="text-muted-foreground text-sm">
					Your classified and organized notes will appear here.
				</p>
			</Card>

			{/* Topper Insights Section - Placeholder */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Topper Insights</h3>
				<p className="text-muted-foreground text-sm">
					Enriching content from topper essays will appear here.
				</p>
			</Card>
		</div>
	);
}
