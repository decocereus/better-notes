import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
	className?: string;
	size?: "sm" | "md" | "lg";
	text?: string;
}

const SIZE_MAP = {
	sm: "size-4",
	md: "size-6",
	lg: "size-8",
} as const;

export function LoadingSpinner({
	className,
	size = "md",
	text,
}: LoadingSpinnerProps) {
	return (
		<div className={cn("flex items-center justify-center gap-2", className)}>
			<Loader2 className={cn("animate-spin text-primary", SIZE_MAP[size])} />
			{text && <span className="text-muted-foreground text-sm">{text}</span>}
		</div>
	);
}
