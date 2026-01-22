"use client";

import { CheckCircle, ExternalLink, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLocalStorage } from "@/lib/hooks/use-local-storage";

type ConnectionStatus = "idle" | "testing" | "connected" | "failed";

interface ConnectionState {
	status: ConnectionStatus;
	user?: string;
	error?: string;
}

const STORAGE_KEY = "betternotes:notion-api-key";

/**
 * Notion connection component for the settings page.
 * Handles API key input, connection testing, and status display.
 */
export function NotionConnector() {
	const [storedApiKey, setStoredApiKey, isHydrated] = useLocalStorage(
		STORAGE_KEY,
		""
	);
	const [apiKey, setApiKey] = useState("");
	const [connection, setConnection] = useState<ConnectionState>({
		status: "idle",
	});

	// Define testConnection before the effect that uses it
	const testConnection = useCallback(
		async (keyToTest: string) => {
			if (!keyToTest.trim()) {
				setConnection({ status: "idle" });
				return;
			}

			setConnection({ status: "testing" });

			try {
				const response = await fetch("/api/notion/connect", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ apiKey: keyToTest }),
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
					// Save the working API key
					setStoredApiKey(keyToTest);
				} else {
					setConnection({
						status: "failed",
						error: data.error ?? "Connection failed",
					});
				}
			} catch (error) {
				setConnection({
					status: "failed",
					error: error instanceof Error ? error.message : "Connection failed",
				});
			}
		},
		[setStoredApiKey]
	);

	// Sync local state with stored value after hydration
	useEffect(() => {
		if (isHydrated && storedApiKey) {
			setApiKey(storedApiKey);
			// Auto-test if we have a stored key
			testConnection(storedApiKey);
		}
	}, [isHydrated, storedApiKey, testConnection]);

	const handleTestConnection = useCallback(() => {
		testConnection(apiKey);
	}, [apiKey, testConnection]);

	const handleDisconnect = useCallback(() => {
		setApiKey("");
		setStoredApiKey("");
		setConnection({ status: "idle" });
	}, [setStoredApiKey]);

	const handleKeyChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			setApiKey(e.target.value);
			// Reset status when key changes
			if (connection.status !== "idle") {
				setConnection({ status: "idle" });
			}
		},
		[connection.status]
	);

	// Show loading state during hydration
	if (!isHydrated) {
		return (
			<Card className="p-6">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					<span className="text-sm">Loading settings...</span>
				</div>
			</Card>
		);
	}

	return (
		<Card className="p-6">
			<h3 className="font-medium text-lg">Notion Connection</h3>
			<p className="mt-1 text-muted-foreground text-sm">
				Connect your Notion account to import themes and sync notes.
			</p>

			<div className="mt-6 space-y-4">
				{/* API Key Input */}
				<div className="space-y-2">
					<label className="font-medium text-sm" htmlFor="notion-api-key">
						Notion API Key
					</label>
					<div className="flex gap-2">
						<Input
							className="flex-1"
							disabled={connection.status === "testing"}
							id="notion-api-key"
							onChange={handleKeyChange}
							placeholder="ntn_..."
							type="password"
							value={apiKey}
						/>
						{connection.status === "connected" ? (
							<Button onClick={handleDisconnect} variant="outline">
								Disconnect
							</Button>
						) : (
							<Button
								disabled={!apiKey.trim() || connection.status === "testing"}
								onClick={handleTestConnection}
							>
								{connection.status === "testing" ? (
									<>
										<Loader2 className="size-4 animate-spin" />
										Testing...
									</>
								) : (
									"Test Connection"
								)}
							</Button>
						)}
					</div>
					<p className="text-muted-foreground text-xs">
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
					</p>
				</div>

				{/* Connection Status */}
				<ConnectionStatusDisplay connection={connection} />
			</div>
		</Card>
	);
}

function ConnectionStatusDisplay({
	connection,
}: {
	connection: ConnectionState;
}) {
	if (connection.status === "connected") {
		return (
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
				</div>
			</div>
		);
	}

	if (connection.status === "failed") {
		return (
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
				</div>
			</div>
		);
	}

	if (connection.status === "testing") {
		return (
			<div className="flex items-center gap-3 rounded-md bg-muted/50 p-3">
				<Loader2 className="size-4 animate-spin text-muted-foreground" />
				<p className="text-muted-foreground text-sm">Testing connection...</p>
			</div>
		);
	}

	return (
		<div className="rounded-md bg-muted/50 p-3">
			<p className="font-medium text-sm">Status: Not connected</p>
			<p className="text-muted-foreground text-xs">
				Enter your API key and click Test Connection
			</p>
		</div>
	);
}
