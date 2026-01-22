"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
	throw new Error("Missing NEXT_PUBLIC_CONVEX_URL environment variable");
}

const convex = new ConvexReactClient(convexUrl);

interface ConvexClientProviderProps {
	children: ReactNode;
}

export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
	return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
