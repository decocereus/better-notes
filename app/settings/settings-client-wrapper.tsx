"use client";

import { NotionConnector } from "@/components/notion-connector";
import { NotionDestinationConfig } from "@/components/notion-destination-config";
import { useSettings } from "@/lib/hooks/use-settings";

/**
 * Client wrapper for settings page that manages Notion connection state.
 * Renders both NotionConnector and NotionDestinationConfig with shared state.
 */
export function SettingsClientWrapper() {
	const { isNotionConnected, isHydrated } = useSettings();

	return (
		<div className="space-y-6">
			{/* Notion Connection Section */}
			<NotionConnector />

			{/* Notion Output Destination Section */}
			{isHydrated && (
				<NotionDestinationConfig isConnected={isNotionConnected} />
			)}
		</div>
	);
}
