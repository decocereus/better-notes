"use client";

import { useCallback } from "react";
import { useLocalStorage } from "./use-local-storage";

/**
 * Application settings stored in localStorage.
 */
export interface AppSettings {
	/** Notion API key for authentication */
	notionApiKey?: string;
	/** Selected theme page ID in Notion */
	themePageId?: string;
	/** Title of the selected theme page */
	themePageTitle?: string;
	/** Selected strategy page ID in Notion */
	strategyPageId?: string;
	/** Selected output page ID in Notion */
	outputPageId?: string;
	/** Model configuration per task */
	modelConfig?: Record<string, string>;
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

	/**
	 * Checks if Notion is connected (has API key).
	 */
	const isNotionConnected = Boolean(settings.notionApiKey);

	/**
	 * Checks if a theme page is configured.
	 */
	const hasThemePage = Boolean(settings.themePageId);

	return {
		settings,
		isHydrated,
		updateSetting,
		updateSettings,
		clearSetting,
		resetSettings,
		isNotionConnected,
		hasThemePage,
	};
}
