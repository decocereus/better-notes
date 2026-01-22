"use client";

import { RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ModelSelector } from "@/components/model-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useSettings } from "@/lib/hooks/use-settings";
import {
	DEFAULT_MODEL_CONFIG,
	getModelsForTask,
	TASK_DEFINITIONS,
	type TaskType,
} from "@/lib/llm";

interface TestResult {
	success: boolean;
	responseTime?: number;
	error?: string;
}

/**
 * Models configuration content component.
 * Handles model selection per task with persistence to localStorage.
 */
export function ModelsConfigContent() {
	const { settings, updateSetting, isHydrated } = useSettings();

	// Local state for model configuration
	const [modelConfig, setModelConfig] = useState<Record<string, string>>({});
	const [testResults, setTestResults] = useState<Record<string, TestResult>>(
		{}
	);
	const [testingTask, setTestingTask] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveMessage, setSaveMessage] = useState<string | null>(null);
	const [hasChanges, setHasChanges] = useState(false);

	// Initialize from settings after hydration
	useEffect(() => {
		if (isHydrated) {
			const initialConfig = { ...DEFAULT_MODEL_CONFIG };
			// Merge with saved settings
			if (settings.modelConfig) {
				for (const [task, modelId] of Object.entries(settings.modelConfig)) {
					if (modelId) {
						initialConfig[task as TaskType] = modelId;
					}
				}
			}
			setModelConfig(initialConfig);
		}
	}, [isHydrated, settings.modelConfig]);

	/**
	 * Handles model selection change for a task.
	 */
	const handleModelChange = useCallback((task: string, modelId: string) => {
		setModelConfig((prev) => ({ ...prev, [task]: modelId }));
		setHasChanges(true);
		// Clear test result when model changes
		setTestResults((prev) => {
			const next = { ...prev };
			delete next[task];
			return next;
		});
	}, []);

	/**
	 * Saves the current configuration to localStorage.
	 */
	const handleSave = useCallback(async () => {
		setIsSaving(true);
		setSaveMessage(null);

		try {
			// Validate configuration via API
			const response = await fetch("/api/models", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ config: modelConfig }),
			});

			const data = await response.json();

			if (!data.valid) {
				const errorMsg = data.errors
					? Object.values(data.errors).join(", ")
					: "Invalid configuration";
				setSaveMessage(`Error: ${errorMsg}`);
				return;
			}

			// Save to localStorage via settings hook
			updateSetting("modelConfig", modelConfig);
			setHasChanges(false);
			setSaveMessage("Configuration saved!");

			// Clear message after 3 seconds
			setTimeout(() => setSaveMessage(null), 3000);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to save configuration";
			setSaveMessage(`Error: ${message}`);
		} finally {
			setIsSaving(false);
		}
	}, [modelConfig, updateSetting]);

	/**
	 * Resets configuration to defaults.
	 */
	const handleReset = useCallback(() => {
		setModelConfig({ ...DEFAULT_MODEL_CONFIG });
		setTestResults({});
		setHasChanges(true);
	}, []);

	/**
	 * Tests a specific model configuration.
	 */
	const handleTest = useCallback(
		async (task: string) => {
			const modelId = modelConfig[task];
			if (!modelId) {
				return;
			}

			setTestingTask(task);
			setTestResults((prev) => {
				const next = { ...prev };
				delete next[task];
				return next;
			});

			try {
				const response = await fetch("/api/llm/test", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ modelId }),
				});

				const data = await response.json();
				setTestResults((prev) => ({
					...prev,
					[task]: {
						success: data.success,
						responseTime: data.responseTime,
						error: data.error,
					},
				}));
			} catch (error) {
				const message = error instanceof Error ? error.message : "Test failed";
				setTestResults((prev) => ({
					...prev,
					[task]: { success: false, error: message },
				}));
			} finally {
				setTestingTask(null);
			}
		},
		[modelConfig]
	);

	// Show loading while hydrating
	if (!isHydrated) {
		return (
			<div className="flex justify-center py-12">
				<LoadingSpinner size="lg" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Info Card */}
			<Card className="bg-muted/50 p-4">
				<p className="text-sm">
					<strong>Note:</strong> The OpenRouter API key is configured via
					environment variable (OPENROUTER_API_KEY). You can select which models
					to use for each task below.
				</p>
			</Card>

			{/* Save Message */}
			{saveMessage && (
				<div
					className={`rounded-md p-3 text-sm ${
						saveMessage.startsWith("Error")
							? "bg-destructive/10 text-destructive"
							: "bg-green-500/10 text-green-600"
					}`}
				>
					{saveMessage}
				</div>
			)}

			{/* Model Selection */}
			<Card className="divide-y divide-border">
				{TASK_DEFINITIONS.map((task) => {
					const availableModels = getModelsForTask(task.id);
					const selectedModelId =
						modelConfig[task.id] || DEFAULT_MODEL_CONFIG[task.id];

					return (
						<ModelSelector
							isTestRunning={testingTask === task.id}
							key={task.id}
							models={availableModels}
							onModelChange={(modelId) => handleModelChange(task.id, modelId)}
							onTest={() => handleTest(task.id)}
							selectedModelId={selectedModelId}
							task={task}
							testResult={testResults[task.id]}
						/>
					);
				})}
			</Card>

			{/* Action Buttons */}
			<div className="flex items-center justify-between">
				<Button disabled={isSaving} onClick={handleReset} variant="outline">
					<RotateCcw className="size-4" />
					Reset to Defaults
				</Button>

				<Button disabled={isSaving || !hasChanges} onClick={handleSave}>
					{isSaving ? (
						<LoadingSpinner className="mr-2" size="sm" />
					) : (
						<Save className="size-4" />
					)}
					{isSaving ? "Saving..." : "Save Changes"}
				</Button>
			</div>
		</div>
	);
}
