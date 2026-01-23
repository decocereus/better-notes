import { AssetsContent } from "@/components/assets-content";

export const metadata = {
	title: "Assets | BetterNotes",
	description: "Manage your uploaded files and processing pipeline",
};

export default function AssetsPage() {
	return (
		<div className="container py-8">
			<div className="mb-8">
				<h1 className="font-bold text-3xl">Asset Library</h1>
				<p className="mt-2 text-muted-foreground">
					View and manage all uploaded files across your projects
				</p>
			</div>

			<AssetsContent />
		</div>
	);
}
