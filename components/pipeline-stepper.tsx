"use client";

import { Check, Circle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "active" | "completed" | "failed";

export interface PipelineStep {
	id: string;
	label: string;
	status: StepStatus;
	count?: number;
}

interface PipelineStepperProps {
	steps: PipelineStep[];
	onStepClick?: (stepId: string) => void;
}

function StepIcon({ status }: { status: StepStatus }) {
	if (status === "completed") {
		return (
			<div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
				<Check className="h-4 w-4" />
			</div>
		);
	}
	if (status === "active") {
		return (
			<div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
				<Loader2 className="h-4 w-4 animate-spin" />
			</div>
		);
	}
	if (status === "failed") {
		return (
			<div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400">
				<X className="h-4 w-4" />
			</div>
		);
	}
	return (
		<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
			<Circle className="h-3 w-3" />
		</div>
	);
}

function StepConnector({ completed }: { completed: boolean }) {
	return (
		<div
			className={cn(
				"hidden h-0.5 flex-1 sm:block",
				completed ? "bg-emerald-500/40" : "bg-muted"
			)}
		/>
	);
}

export function PipelineStepper({ steps, onStepClick }: PipelineStepperProps) {
	return (
		<div className="flex items-center gap-2">
			{steps.map((step, index) => (
				<div className="contents" key={step.id}>
					{index > 0 && (
						<StepConnector
							completed={
								step.status === "completed" || step.status === "active"
							}
						/>
					)}
					<button
						className={cn(
							"flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors hover:bg-muted/50",
							step.status === "active" && "bg-blue-500/5"
						)}
						onClick={() => onStepClick?.(step.id)}
						type="button"
					>
						<StepIcon status={step.status} />
						<span
							className={cn(
								"whitespace-nowrap text-xs",
								step.status === "active" && "font-semibold text-blue-400",
								step.status === "completed" && "text-emerald-400",
								step.status === "failed" && "text-red-400",
								step.status === "pending" && "text-muted-foreground"
							)}
						>
							{step.label}
						</span>
						{step.count !== undefined && step.count > 0 && (
							<span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
								{step.count}
							</span>
						)}
					</button>
				</div>
			))}
		</div>
	);
}
