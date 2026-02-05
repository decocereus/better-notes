import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PipelineStep } from "../pipeline-stepper";
import { PipelineStepper } from "../pipeline-stepper";

const mockSteps: PipelineStep[] = [
	{
		id: "sources",
		label: "Sources",
		status: "completed",
		count: 3,
	},
	{
		id: "extraction",
		label: "Extraction",
		status: "active",
	},
	{
		id: "classification",
		label: "Classification",
		status: "pending",
	},
];

describe("PipelineStepper", () => {
	it("renders all steps", () => {
		render(<PipelineStepper steps={mockSteps} />);
		expect(screen.getByText("Sources")).toBeInTheDocument();
		expect(screen.getByText("Extraction")).toBeInTheDocument();
		expect(screen.getByText("Classification")).toBeInTheDocument();
	});

	it("shows count badge for steps with count", () => {
		render(<PipelineStepper steps={mockSteps} />);
		expect(screen.getByText("3")).toBeInTheDocument();
	});

	it("does not show count badge for steps without count", () => {
		const stepsWithoutCount: PipelineStep[] = [
			{ id: "a", label: "Step A", status: "pending" },
			{ id: "b", label: "Step B", status: "active" },
		];
		render(<PipelineStepper steps={stepsWithoutCount} />);
		const buttons = screen.getAllByRole("button");
		for (const button of buttons) {
			const spans = button.querySelectorAll("span");
			// Each button should have at most the label span, no count span
			expect(spans.length).toBeLessThanOrEqual(1);
		}
	});

	it("calls onStepClick when step is clicked", () => {
		const onClick = vi.fn();
		render(<PipelineStepper onStepClick={onClick} steps={mockSteps} />);
		fireEvent.click(screen.getByText("Sources"));
		expect(onClick).toHaveBeenCalledWith("sources");
	});

	it("calls onStepClick with correct step id for each step", () => {
		const onClick = vi.fn();
		render(<PipelineStepper onStepClick={onClick} steps={mockSteps} />);

		fireEvent.click(screen.getByText("Extraction"));
		expect(onClick).toHaveBeenCalledWith("extraction");

		fireEvent.click(screen.getByText("Classification"));
		expect(onClick).toHaveBeenCalledWith("classification");
	});

	it("does not throw when clicked without onStepClick", () => {
		render(<PipelineStepper steps={mockSteps} />);
		expect(() => {
			fireEvent.click(screen.getByText("Sources"));
		}).not.toThrow();
	});

	it("renders correct number of buttons", () => {
		render(<PipelineStepper steps={mockSteps} />);
		const buttons = screen.getAllByRole("button");
		expect(buttons).toHaveLength(3);
	});

	it("renders failed step status", () => {
		const stepsWithFailed: PipelineStep[] = [
			{ id: "failed-step", label: "Failed Step", status: "failed" },
		];
		render(<PipelineStepper steps={stepsWithFailed} />);
		expect(screen.getByText("Failed Step")).toBeInTheDocument();
	});
});
