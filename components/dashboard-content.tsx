"use client";

import { useQuery } from "convex/react";
import {
	ArrowRight,
	CheckCircle2,
	Circle,
	Loader2,
	Settings,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardStats } from "@/components/dashboard-stats";
import { QuickActions } from "@/components/quick-actions";
import { RecentProjects } from "@/components/recent-projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { api } from "@/convex/_generated/api";
import { useSettings } from "@/lib/hooks/use-settings";

interface SetupStepProps {
	label: string;
	isComplete: boolean;
	href: string;
}

function SetupStep({ label, isComplete, href }: SetupStepProps) {
	return (
		<Link
			className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50"
			href={href}
		>
			<div className="flex items-center gap-3">
				{isComplete ? (
					<CheckCircle2 className="size-5 text-green-500" />
				) : (
					<Circle className="size-5 text-muted-foreground" />
				)}
				<span className={isComplete ? "text-muted-foreground" : ""}>
					{label}
				</span>
			</div>
			<ArrowRight className="size-4 text-muted-foreground" />
		</Link>
	);
}

function SetupWizard() {
	const { settings } = useSettings();
	const themePages = useQuery(api.themePages.list);
	const [isNotionConnected, setIsNotionConnected] = useState(false);
	const [isChecking, setIsChecking] = useState(true);

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
				setIsChecking(false);
			}
		}

		checkConnection();
	}, []);

	// Check if models are configured (beyond defaults)
	const hasModelConfig = Boolean(
		settings.modelConfig && Object.keys(settings.modelConfig).length > 0
	);

	// Check if any theme pages exist
	const hasThemePages = (themePages?.length ?? 0) > 0;

	// All setup steps complete
	const isComplete = isNotionConnected && hasThemePages;

	// Show loading while checking
	if (isChecking || themePages === undefined) {
		return (
			<Card>
				<CardContent className="flex items-center justify-center py-8">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	if (isComplete) {
		return null;
	}

	const completedCount = [
		isNotionConnected,
		hasThemePages,
		hasModelConfig,
	].filter(Boolean).length;

	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base">Complete Setup</CardTitle>
					<span className="text-muted-foreground text-sm">
						{completedCount}/3 completed
					</span>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-1">
					<SetupStep
						href="/settings"
						isComplete={isNotionConnected}
						label="Connect Notion API"
					/>
					<SetupStep
						href="/themes"
						isComplete={hasThemePages}
						label="Add Theme Page"
					/>
					<SetupStep
						href="/settings/models"
						isComplete={hasModelConfig}
						label="Configure LLM Models"
					/>
				</div>
				<div className="mt-4 flex justify-end">
					<Button asChild size="sm" variant="outline">
						<Link href="/settings">
							<Settings className="mr-2 size-4" />
							Open Settings
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export function DashboardContent() {
	const { isHydrated } = useSettings();

	// Show loading state until hydrated
	if (!isHydrated) {
		return (
			<div className="flex min-h-[400px] items-center justify-center">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="space-y-8">
			{/* Welcome Section */}
			<section>
				<h2 className="font-semibold text-2xl">Welcome to BetterNotes</h2>
				<p className="mt-1 text-muted-foreground">
					Your intelligent UPSC essay preparation assistant
				</p>
			</section>

			{/* Setup Wizard (shown if setup incomplete) */}
			<SetupWizard />

			{/* Stats Section */}
			<section>
				<h3 className="mb-4 font-medium text-lg">Overview</h3>
				<DashboardStats />
			</section>

			{/* Quick Actions */}
			<section>
				<QuickActions />
			</section>

			{/* Recent Projects */}
			<section>
				<RecentProjects limit={5} />
			</section>
		</div>
	);
}
