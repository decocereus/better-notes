"use client";

import {
	BookOpen,
	FileText,
	FolderKanban,
	type LucideIcon,
	Settings,
	Upload,
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";

interface QuickAction {
	href: string;
	label: string;
	description: string;
	icon: LucideIcon;
}

const QUICK_ACTIONS: QuickAction[] = [
	{
		href: "/projects",
		label: "New Project",
		description: "Start a new project session",
		icon: FolderKanban,
	},
	{
		href: "/upload",
		label: "Upload Files",
		description: "Upload PDFs or images",
		icon: Upload,
	},
	{
		href: "/themes",
		label: "View Themes",
		description: "Browse essay themes",
		icon: BookOpen,
	},
	{
		href: "/patterns",
		label: "Patterns",
		description: "View topper patterns",
		icon: FileText,
	},
	{
		href: "/settings",
		label: "Settings",
		description: "Configure connections",
		icon: Settings,
	},
];

interface QuickActionCardProps {
	action: QuickAction;
}

function QuickActionCard({ action }: QuickActionCardProps) {
	const Icon = action.icon;

	return (
		<Link href={action.href}>
			<Card className="p-4 transition-colors hover:bg-muted/50">
				<Icon className="mb-2 size-6 text-primary" />
				<p className="font-medium text-sm">{action.label}</p>
				<p className="text-muted-foreground text-xs">{action.description}</p>
			</Card>
		</Link>
	);
}

export function QuickActions() {
	return (
		<div>
			<h3 className="mb-4 font-medium">Quick Actions</h3>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				{QUICK_ACTIONS.map((action) => (
					<QuickActionCard action={action} key={action.href} />
				))}
			</div>
		</div>
	);
}
