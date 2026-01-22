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
import type { MainTheme } from "@/types/theme";

interface ThemeStats {
	mainThemes: number;
	miniThemes: number;
	questions: number;
}

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
	const { settings, isHydrated, isNotionConnected, hasThemePage } =
		useSettings();
	const projects = useQuery(api.projects.list) as Project[] | undefined;
	const [themeStats, setThemeStats] = useState<ThemeStats | null>(null);
	const [isLoadingThemes, setIsLoadingThemes] = useState(false);

	// Fetch theme stats if theme page is configured
	useEffect(() => {
		const fetchThemeStats = async () => {
			if (!(settings.themePageId && settings.notionApiKey)) {
				setThemeStats(null);
				return;
			}

			setIsLoadingThemes(true);
			try {
				const response = await fetch("/api/themes", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						pageId: settings.themePageId,
						apiKey: settings.notionApiKey,
					}),
				});

				if (response.ok) {
					const data = (await response.json()) as { themes: MainTheme[] };
					const themes = data.themes;

					// Calculate stats
					const mainThemes = themes.length;
					const miniThemes = themes.reduce(
						(acc, t) => acc + t.miniThemes.length,
						0
					);
					const questions = themes.reduce(
						(acc, t) =>
							acc +
							t.miniThemes.reduce((acc2, mt) => acc2 + mt.questions.length, 0),
						0
					);

					setThemeStats({ mainThemes, miniThemes, questions });
				} else {
					setThemeStats(null);
				}
			} catch {
				setThemeStats(null);
			} finally {
				setIsLoadingThemes(false);
			}
		};

		if (isHydrated && hasThemePage) {
			fetchThemeStats();
		}
	}, [isHydrated, hasThemePage, settings.themePageId, settings.notionApiKey]);

	// Show loading state until hydrated
	const isLoading = !isHydrated || projects === undefined;

	// Check if LLM is configured (has custom model config)
	const hasModelConfig =
		settings.modelConfig && Object.keys(settings.modelConfig).length > 0;

	return (
		<div className="space-y-6">
			{/* Stats Grid */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<StatCard
					icon={<BookOpen className="size-5" />}
					isLoading={isLoading || isLoadingThemes}
					label="Main Themes"
					value={themeStats?.mainThemes ?? "-"}
				/>
				<StatCard
					icon={<FileQuestion className="size-5" />}
					isLoading={isLoading || isLoadingThemes}
					label="Questions"
					value={themeStats?.questions ?? "-"}
				/>
				<StatCard
					icon={<FolderKanban className="size-5" />}
					isLoading={isLoading}
					label="Projects"
					value={projects?.length ?? 0}
				/>
				<StatCard
					icon={<BookOpen className="size-5" />}
					isLoading={isLoading || isLoadingThemes}
					label="Mini Themes"
					value={themeStats?.miniThemes ?? "-"}
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
						detail={settings.themePageTitle}
						isConnected={hasThemePage}
						label="Theme Page"
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
