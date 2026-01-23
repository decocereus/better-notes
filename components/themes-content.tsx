"use client";

import { useQuery } from "convex/react";
import { BookOpen, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AddThemePageDialog } from "@/components/add-theme-page-dialog";
import { ThemePageCard } from "@/components/theme-page-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";

interface ThemePage {
	_id: string;
	id: string;
	notionPageId: string;
	title: string;
	themes: unknown[];
	stats: {
		mainThemes: number;
		miniThemes: number;
		questions: number;
		yearRange?: { min: number; max: number };
	};
	lastSyncedAt: string;
	createdAt: string;
}

/**
 * Main content component for the Themes page.
 * Lists all saved theme pages from Convex.
 */
export function ThemesContent() {
	const themePages = useQuery(api.themePages.list) as ThemePage[] | undefined;
	const [isCheckingConnection, setIsCheckingConnection] = useState(true);
	const [isConnected, setIsConnected] = useState(false);

	// Check actual connection status via API (handles env variable)
	useEffect(() => {
		async function checkConnection() {
			try {
				const response = await fetch("/api/notion/connect", { method: "GET" });
				const data = (await response.json()) as { valid: boolean };
				setIsConnected(data.valid);
			} catch {
				setIsConnected(false);
			} finally {
				setIsCheckingConnection(false);
			}
		}

		checkConnection();
	}, []);

	// Show loading during connection check
	if (isCheckingConnection || themePages === undefined) {
		return (
			<div className="flex items-center justify-center py-12">
				<Loader2 className="size-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Show setup prompt if Notion not connected
	if (!isConnected) {
		return <NotConnectedState />;
	}

	// Show empty state if no theme pages
	if (themePages.length === 0) {
		return <EmptyState />;
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-2xl">Theme Pages</h2>
					<p className="text-muted-foreground">
						Manage your saved Notion theme pages
					</p>
				</div>
				<AddThemePageDialog
					trigger={
						<Button>
							<Plus className="mr-2 size-4" />
							Add Theme Page
						</Button>
					}
				/>
			</div>

			{/* Theme Pages List */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{themePages.map((themePage) => (
					<ThemePageCard
						id={themePage._id}
						key={themePage._id}
						lastSyncedAt={themePage.lastSyncedAt}
						stats={themePage.stats}
						title={themePage.title}
					/>
				))}
			</div>
		</div>
	);
}

/**
 * State shown when Notion is not connected.
 */
function NotConnectedState() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="font-semibold text-2xl">Theme Pages</h2>
				<p className="text-muted-foreground">
					Manage your saved Notion theme pages
				</p>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<BookOpen className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">Connect Notion First</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Connect your Notion account to manage theme pages. Set NOTION_API_KEY
					in your .env.local file.
				</p>
				<Link href="/settings">
					<Button className="mt-4">Go to Settings</Button>
				</Link>
			</Card>
		</div>
	);
}

/**
 * State shown when no theme pages exist.
 */
function EmptyState() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="font-semibold text-2xl">Theme Pages</h2>
					<p className="text-muted-foreground">
						Manage your saved Notion theme pages
					</p>
				</div>
				<AddThemePageDialog
					trigger={
						<Button>
							<Plus className="mr-2 size-4" />
							Add Theme Page
						</Button>
					}
				/>
			</div>

			<Card className="flex flex-col items-center justify-center p-12 text-center">
				<div className="mb-4 rounded-full bg-muted p-4">
					<BookOpen className="size-8 text-muted-foreground" />
				</div>
				<h3 className="font-medium text-lg">No Theme Pages Yet</h3>
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					Add a theme page from your Notion workspace to get started. Theme
					pages contain the hierarchy of topics for classifying your content.
				</p>
				<AddThemePageDialog
					trigger={
						<Button className="mt-4" variant="outline">
							<Plus className="size-4" />
							Add Your First Theme Page
						</Button>
					}
				/>
			</Card>
		</div>
	);
}
