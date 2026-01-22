"use client";

import { useEffect } from "react";
import { ErrorMessage } from "@/components/ui/error-message";

interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
	useEffect(() => {
		// Log the error to an error reporting service
		console.error("Application error:", error);
	}, [error]);

	return (
		<div className="flex min-h-[400px] items-center justify-center p-6">
			<ErrorMessage
				message={
					error.message ||
					"An unexpected error occurred. Please try again or contact support if the problem persists."
				}
				retry={reset}
				title="Something went wrong"
			/>
		</div>
	);
}
