"use client";

import { useCallback } from "react";
import type { ExtractionParameters } from "@/types/extraction";
import { useLocalStorage } from "./use-local-storage";

/**
 * Application settings stored in localStorage.
 * Note: Notion API key is now from environment variable only.
 * Theme pages are stored in Convex, not localStorage.
 */
export interface AppSettings {
	/** Selected strategy page ID in Notion */
	strategyPageId?: string;
	/** Selected output page ID in Notion */
	outputPageId?: string;
	/** Model configuration per task */
	modelConfig?: Record<string, string>;
	/** Extraction parameters for content extraction from essays */
	extractionParameters?: ExtractionParameters;
}

const SETTINGS_KEY = "betternotes:settings";

const DEFAULT_SETTINGS: AppSettings = {};

/**
 * Hook for managing application settings with localStorage persistence.
 *
 * @returns Settings object and methods to update it
 */
export function useSettings() {
	const [settings, setSettings, isHydrated] = useLocalStorage<AppSettings>(
		SETTINGS_KEY,
		DEFAULT_SETTINGS
	);

	/**
	 * Updates a single setting.
	 */
	const updateSetting = useCallback(
		<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
			setSettings((prev) => ({ ...prev, [key]: value }));
		},
		[setSettings]
	);

	/**
	 * Updates multiple settings at once.
	 */
	const updateSettings = useCallback(
		(updates: Partial<AppSettings>) => {
			setSettings((prev) => ({ ...prev, ...updates }));
		},
		[setSettings]
	);

	/**
	 * Clears a specific setting.
	 */
	const clearSetting = useCallback(
		(key: keyof AppSettings) => {
			setSettings((prev) => {
				const next = { ...prev };
				delete next[key];
				return next;
			});
		},
		[setSettings]
	);

	/**
	 * Resets all settings to defaults.
	 */
	const resetSettings = useCallback(() => {
		setSettings(DEFAULT_SETTINGS);
	}, [setSettings]);

	return {
		settings,
		isHydrated,
		updateSetting,
		updateSettings,
		clearSetting,
		resetSettings,
	};
}
