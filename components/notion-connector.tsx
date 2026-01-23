"use client";

import {
	CheckCircle,
	ExternalLink,
	Loader2,
	Settings,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";

type ConnectionStatus = "checking" | "connected" | "not_configured" | "failed";

interface ConnectionState {
	status: ConnectionStatus;
	user?: string;
	error?: string;
}

/**
 * Notion connection component for the settings page.
 * Only checks for NOTION_API_KEY environment variable - no manual input.
 */
export function NotionConnector() {
	const [connection, setConnection] = useState<ConnectionState>({
		status: "checking",
	});

	// Check for env-based connection on mount
	useEffect(() => {
		async function checkConnection() {
			try {
				const response = await fetch("/api/notion/connect", {
					method: "GET",
				});
				const data = (await response.json()) as {
					valid: boolean;
					user?: string;
					error?: string;
				};

				if (data.valid) {
					setConnection({
						status: "connected",
						user: data.user,
					});
				} else if (
					data.error?.includes("not configured") ||
					data.error?.includes("not set")
				) {
					setConnection({
						status: "not_configured",
						error: data.error,
					});
				} else {
					setConnection({
						status: "failed",
						error: data.error,
					});
				}
			} catch (error) {
				setConnection({
					status: "failed",
					error: error instanceof Error ? error.message : "Connection failed",
				});
			}
		}

		checkConnection();
	}, []);

	// Show loading state during initial check
	if (connection.status === "checking") {
		return (
			<Card className="p-6">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					<span className="text-sm">Checking Notion connection...</span>
				</div>
			</Card>
		);
	}

	// Connected via environment variable
	if (connection.status === "connected") {
		return (
			<Card className="p-6">
				<h3 className="font-medium text-lg">Notion Connection</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Connected via environment variable.
				</p>

				<div className="mt-6">
					<div className="flex items-start gap-3 rounded-md bg-green-500/10 p-3">
						<CheckCircle className="mt-0.5 size-4 text-green-600" />
						<div>
							<p className="font-medium text-green-800 text-sm dark:text-green-200">
								Connected
							</p>
							{connection.user && (
								<p className="text-green-700 text-xs dark:text-green-300">
									Authenticated as: {connection.user}
								</p>
							)}
							<p className="mt-1 text-green-700 text-xs dark:text-green-300">
								<Settings className="mr-1 inline size-3" />
								Configured via NOTION_API_KEY in .env.local
							</p>
						</div>
					</div>
				</div>
			</Card>
		);
	}

	// Not configured
	if (connection.status === "not_configured") {
		return (
			<Card className="p-6">
				<h3 className="font-medium text-lg">Notion Connection</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Connect your Notion account to import themes and sync notes.
				</p>

				<div className="mt-6 space-y-4">
					<div className="flex items-start gap-3 rounded-md bg-amber-500/10 p-3">
						<Settings className="mt-0.5 size-4 text-amber-600" />
						<div>
							<p className="font-medium text-amber-800 text-sm dark:text-amber-200">
								Not Configured
							</p>
							<p className="text-amber-700 text-xs dark:text-amber-300">
								Add NOTION_API_KEY to your .env.local file
							</p>
						</div>
					</div>

					<div className="rounded-md border p-4">
						<p className="font-medium text-sm">Setup Instructions:</p>
						<ol className="mt-2 ml-4 list-decimal text-muted-foreground text-sm">
							<li className="mt-1">
								Create an integration at{" "}
								<a
									className="inline-flex items-center gap-1 text-primary hover:underline"
									href="https://www.notion.so/my-integrations"
									rel="noopener noreferrer"
									target="_blank"
								>
									notion.so/my-integrations
									<ExternalLink className="size-3" />
								</a>
							</li>
							<li className="mt-1">Copy the Internal Integration Secret</li>
							<li className="mt-1">
								Add to your <code className="text-xs">.env.local</code>:
								<pre className="mt-1 rounded bg-muted p-2 text-xs">
									NOTION_API_KEY=ntn_...
								</pre>
							</li>
							<li className="mt-1">Restart the development server</li>
						</ol>
					</div>
				</div>
			</Card>
		);
	}

	// Failed
	return (
		<Card className="p-6">
			<h3 className="font-medium text-lg">Notion Connection</h3>
			<p className="mt-1 text-muted-foreground text-sm">
				There was an issue connecting to Notion.
			</p>

			<div className="mt-6">
				<div className="flex items-start gap-3 rounded-md bg-red-500/10 p-3">
					<XCircle className="mt-0.5 size-4 text-red-600" />
					<div>
						<p className="font-medium text-red-800 text-sm dark:text-red-200">
							Connection Failed
						</p>
						{connection.error && (
							<p className="text-red-700 text-xs dark:text-red-300">
								{connection.error}
							</p>
						)}
						<p className="mt-2 text-red-700 text-xs dark:text-red-300">
							Check that your NOTION_API_KEY is valid and the integration has
							access to your pages.
						</p>
					</div>
				</div>
			</div>
		</Card>
	);
}
