import { ChevronRight, Database, Settings2, Sliders } from "lucide-react";
import Link from "next/link";

import { NotionConnector } from "@/components/notion-connector";
import { Card } from "@/components/ui/card";

const SETTINGS_SECTIONS = [
	{
		href: "/settings",
		label: "Notion Connection",
		description: "Connect and configure your Notion workspace",
		icon: Database,
		current: true,
	},
	{
		href: "/settings/models",
		label: "Model Configuration",
		description: "Select which LLM models to use for each task",
		icon: Settings2,
		current: false,
	},
	{
		href: "/settings/parameters",
		label: "Extraction Parameters",
		description: "Configure content extraction parameters",
		icon: Sliders,
		current: false,
	},
] as const;

export default function SettingsPage() {
	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h2 className="font-semibold text-2xl">Settings</h2>
				<p className="text-muted-foreground">
					Configure your BetterNotes application
				</p>
			</div>

			{/* Settings Navigation */}
			<Card className="divide-y divide-border">
				{SETTINGS_SECTIONS.map((section) => (
					<Link
						className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
						href={section.href}
						key={section.href}
					>
						<div className="rounded-md bg-muted p-2">
							<section.icon className="size-5 text-muted-foreground" />
						</div>
						<div className="flex-1">
							<p className="font-medium">{section.label}</p>
							<p className="text-muted-foreground text-sm">
								{section.description}
							</p>
						</div>
						<ChevronRight className="size-5 text-muted-foreground" />
					</Link>
				))}
			</Card>

			{/* Notion Connection Section - Client Component */}
			<NotionConnector />
		</div>
	);
}
