import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ModelsConfigContent } from "@/components/models-config-content";
import { Button } from "@/components/ui/button";

/**
 * Model configuration page.
 * Allows users to select which LLM models to use for each task.
 */
export default function ModelsPage() {
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
					<h2 className="font-semibold text-2xl">Model Configuration</h2>
					<p className="text-muted-foreground">
						Select which LLM models to use for each task
					</p>
				</div>
			</div>

			{/* Content (Client Component) */}
			<ModelsConfigContent />
		</div>
	);
}
