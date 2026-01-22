import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../button";

describe("Button", () => {
	it("renders with default props", () => {
		render(<Button>Click me</Button>);
		const button = screen.getByRole("button", { name: "Click me" });
		expect(button).toBeInTheDocument();
		expect(button).toHaveAttribute("data-variant", "default");
		expect(button).toHaveAttribute("data-size", "default");
	});

	it("renders with custom variant", () => {
		render(<Button variant="outline">Outline Button</Button>);
		const button = screen.getByRole("button", { name: "Outline Button" });
		expect(button).toHaveAttribute("data-variant", "outline");
	});

	it("renders with custom size", () => {
		render(<Button size="lg">Large Button</Button>);
		const button = screen.getByRole("button", { name: "Large Button" });
		expect(button).toHaveAttribute("data-size", "lg");
	});

	it("handles click events", async () => {
		const handleClick = vi.fn();
		const user = userEvent.setup();

		render(<Button onClick={handleClick}>Clickable</Button>);
		const button = screen.getByRole("button", { name: "Clickable" });

		await user.click(button);
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("can be disabled", () => {
		render(<Button disabled>Disabled</Button>);
		const button = screen.getByRole("button", { name: "Disabled" });
		expect(button).toBeDisabled();
	});

	it("applies custom className", () => {
		render(<Button className="custom-class">Custom</Button>);
		const button = screen.getByRole("button", { name: "Custom" });
		expect(button).toHaveClass("custom-class");
	});
});
