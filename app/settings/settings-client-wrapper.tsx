"use client";

import { useEffect, useState } from "react";

import { NotionConnector } from "@/components/notion-connector";
import { NotionDestinationConfig } from "@/components/notion-destination-config";

/**
 * Client wrapper for settings page that manages Notion connection state.
 * Renders both NotionConnector and NotionDestinationConfig with shared state.
 */
export function SettingsClientWrapper() {
	const [isConnected, setIsConnected] = useState(false);
	const [isChecking, setIsChecking] = useState(true);

	// Check Notion connection via API
	useEffect(() => {
		async function checkConnection() {
			try {
				const response = await fetch("/api/notion/connect", { method: "GET" });
				const data = (await response.json()) as { valid: boolean };
				setIsConnected(data.valid);
			} catch {
				setIsConnected(false);
			} finally {
				setIsChecking(false);
			}
		}

		checkConnection();
	}, []);

	return (
		<div className="space-y-6">
			{/* Notion Connection Section */}
			<NotionConnector />

			{/* Notion Output Destination Section */}
			{!isChecking && <NotionDestinationConfig isConnected={isConnected} />}
		</div>
	);
}
