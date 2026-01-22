import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ThemeDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function ThemeDetailPage({
	params,
}: ThemeDetailPageProps) {
	const { id } = await params;

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
					<h2 className="font-semibold text-2xl">Theme Details</h2>
					<p className="text-muted-foreground text-sm">Theme ID: {id}</p>
				</div>
			</div>

			{/* Theme Content - Placeholder */}
			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<BookOpen className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Theme not found</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					This theme does not exist. Please connect Notion and select a theme
					page first.
				</p>
				<Link href="/themes">
					<Button className="mt-4" variant="outline">
						Back to Themes
					</Button>
				</Link>
			</Card>

			{/* Mini Themes Section - Placeholder */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Mini Themes</h3>
				<p className="text-muted-foreground text-sm">
					Mini themes and questions will appear here once the theme is loaded.
				</p>
			</Card>

			{/* Related Content Section - Placeholder */}
			<Card className="p-6">
				<h3 className="mb-4 font-medium text-lg">Related Content</h3>
				<p className="text-muted-foreground text-sm">
					Classified content from your projects will appear here.
				</p>
			</Card>
		</div>
	);
}
