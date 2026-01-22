"use client";

import { TestTube } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { AvailableModel, TaskDefinition } from "@/lib/llm";

interface ModelSelectorProps {
	/** Task definition */
	task: TaskDefinition;
	/** Available models for this task */
	models: AvailableModel[];
	/** Currently selected model ID */
	selectedModelId: string;
	/** Callback when model selection changes */
	onModelChange: (modelId: string) => void;
	/** Callback when test button is clicked */
	onTest?: () => void;
	/** Whether a test is currently running */
	isTestRunning?: boolean;
	/** Test result status */
	testResult?: {
		success: boolean;
		responseTime?: number;
		error?: string;
	};
}

/**
 * Model selector component for a single task.
 * Displays task info, model dropdown, and test button.
 */
export function ModelSelector({
	task,
	models,
	selectedModelId,
	onModelChange,
	onTest,
	isTestRunning = false,
	testResult,
}: ModelSelectorProps) {
	const selectedModel = models.find((m) => m.id === selectedModelId);

	return (
		<div className="flex items-start gap-4 p-4">
			{/* Task Info */}
			<div className="flex-1 space-y-1">
				<p className="font-medium">{task.name}</p>
				<p className="text-muted-foreground text-sm">{task.description}</p>
				<div className="flex items-center gap-2">
					{task.requiresVision && (
						<Badge className="text-xs" variant="secondary">
							Requires Vision
						</Badge>
					)}
					{testResult && (
						<TestResultBadge
							error={testResult.error}
							responseTime={testResult.responseTime}
							success={testResult.success}
						/>
					)}
				</div>
			</div>

			{/* Model Selection */}
			<div className="flex items-center gap-2">
				<Select onValueChange={onModelChange} value={selectedModelId}>
					<SelectTrigger className="w-64">
						<SelectValue placeholder="Select a model">
							{selectedModel?.name || "Select a model"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{models.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								<span className="flex flex-col">
									<span>{model.name}</span>
									<span className="text-muted-foreground text-xs">
										{model.description}
									</span>
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* Test Button */}
				{onTest && (
					<Button
						disabled={isTestRunning}
						onClick={onTest}
						size="sm"
						variant="outline"
					>
						<TestTube className="size-4" />
						{isTestRunning ? "Testing..." : "Test"}
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * Badge showing test result status.
 */
function TestResultBadge({
	success,
	responseTime,
	error,
}: {
	success: boolean;
	responseTime?: number;
	error?: string;
}) {
	if (success) {
		return (
			<Badge className="bg-green-500/10 text-green-600" variant="default">
				{responseTime ? `✓ ${responseTime}ms` : "✓ Connected"}
			</Badge>
		);
	}

	return (
		<Badge className="bg-red-500/10 text-red-600" variant="destructive">
			{error ? `✗ ${error.slice(0, 30)}...` : "✗ Failed"}
		</Badge>
	);
}
