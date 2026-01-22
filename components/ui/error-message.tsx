import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface ErrorMessageProps {
	className?: string;
	title?: string;
	message: string;
	retry?: () => void;
}

export function ErrorMessage({
	className,
	title = "Something went wrong",
	message,
	retry,
}: ErrorMessageProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center",
				className
			)}
		>
			<div className="mb-3 rounded-full bg-destructive/10 p-3">
				<AlertCircle className="size-6 text-destructive" />
			</div>
			<h3 className="font-medium text-destructive">{title}</h3>
			<p className="mt-1 max-w-md text-muted-foreground text-sm">{message}</p>
			{retry && (
				<Button className="mt-4" onClick={retry} variant="outline">
					Try Again
				</Button>
			)}
		</div>
	);
}
