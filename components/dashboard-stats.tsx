"use client";

import { useQuery } from "convex/react";
import {
	BookOpen,
	CheckCircle2,
	FileQuestion,
	FolderKanban,
	Loader2,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { useSettings } from "@/lib/hooks/use-settings";
import type { Project } from "@/types/project";

interface StatCardProps {
	label: string;
	value: number | string;
	icon: React.ReactNode;
	isLoading?: boolean;
}

function StatCard({ label, value, icon, isLoading }: StatCardProps) {
	return (
		<Card className="p-4">
			<div className="flex items-start justify-between">
				<div>
					<p className="text-muted-foreground text-sm">{label}</p>
					<p className="mt-1 font-semibold text-2xl">
						{isLoading ? (
							<Loader2 className="size-6 animate-spin text-muted-foreground" />
						) : (
							value
						)}
					</p>
				</div>
				<div className="text-muted-foreground">{icon}</div>
			</div>
		</Card>
	);
}

interface ConnectionStatusProps {
	label: string;
	isConnected: boolean;
	detail?: string;
}

function ConnectionStatus({
	label,
	isConnected,
	detail,
}: ConnectionStatusProps) {
	return (
		<div className="flex items-center justify-between py-2">
			<div className="flex items-center gap-2">
				{isConnected ? (
					<CheckCircle2 className="size-4 text-green-500" />
				) : (
					<XCircle className="size-4 text-muted-foreground" />
				)}
				<span className="text-sm">{label}</span>
			</div>
			<span className="text-muted-foreground text-sm">
				{isConnected ? detail || "Connected" : "Not configured"}
			</span>
		</div>
	);
}

export function DashboardStats() {
	const { settings, isHydrated } = useSettings();
	const projects = useQuery(api.projects.list) as Project[] | undefined;
	const themePages = useQuery(api.themePages.list);
	const [isNotionConnected, setIsNotionConnected] = useState(false);
	const [isCheckingNotion, setIsCheckingNotion] = useState(true);

	// Check Notion connection via API
	useEffect(() => {
		async function checkConnection() {
			try {
				const response = await fetch("/api/notion/connect", { method: "GET" });
				const data = (await response.json()) as { valid: boolean };
				setIsNotionConnected(data.valid);
			} catch {
				setIsNotionConnected(false);
			} finally {
				setIsCheckingNotion(false);
			}
		}

		checkConnection();
	}, []);

	// Show loading state until hydrated
	const isLoading = !isHydrated || projects === undefined || isCheckingNotion;

	// Check if LLM is configured (has custom model config)
	const hasModelConfig =
		settings.modelConfig && Object.keys(settings.modelConfig).length > 0;

	// Aggregate theme stats from all theme pages
	const aggregatedStats = themePages?.reduce(
		(acc, tp) => ({
			mainThemes: acc.mainThemes + (tp.stats?.mainThemes ?? 0),
			miniThemes: acc.miniThemes + (tp.stats?.miniThemes ?? 0),
			questions: acc.questions + (tp.stats?.questions ?? 0),
		}),
		{ mainThemes: 0, miniThemes: 0, questions: 0 }
	) ?? { mainThemes: 0, miniThemes: 0, questions: 0 };

	const hasThemePages = (themePages?.length ?? 0) > 0;

	return (
		<div className="space-y-6">
			{/* Stats Grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={<BookOpen className="size-5" />}
					isLoading={isLoading}
					label="Main Themes"
					value={hasThemePages ? aggregatedStats.mainThemes : "-"}
				/>
				<StatCard
					icon={<FileQuestion className="size-5" />}
					isLoading={isLoading}
					label="Questions"
					value={hasThemePages ? aggregatedStats.questions : "-"}
				/>
				<StatCard
					icon={<FolderKanban className="size-5" />}
					isLoading={isLoading}
					label="Projects"
					value={projects?.length ?? 0}
				/>
				<StatCard
					icon={<BookOpen className="size-5" />}
					isLoading={isLoading}
					label="Mini Themes"
					value={hasThemePages ? aggregatedStats.miniThemes : "-"}
				/>
			</div>

			{/* Connection Status */}
			<Card className="p-4">
				<h4 className="mb-2 font-medium text-sm">Connection Status</h4>
				<div className="divide-y">
					<ConnectionStatus
						isConnected={isNotionConnected}
						label="Notion API"
					/>
					<ConnectionStatus
						detail={`${themePages?.length ?? 0} theme pages`}
						isConnected={hasThemePages}
						label="Theme Pages"
					/>
					<ConnectionStatus
						detail={hasModelConfig ? "Custom config" : "Using defaults"}
						isConnected={true}
						label="LLM Models"
					/>
				</div>
			</Card>
		</div>
	);
}
