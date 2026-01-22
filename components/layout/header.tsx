"use client";

import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
	"/": "Dashboard",
	"/projects": "Projects",
	"/themes": "Themes",
	"/patterns": "Patterns",
	"/upload": "Upload",
	"/settings": "Settings",
	"/compare": "Compare",
	"/notes": "Notes",
};

function getPageTitle(pathname: string): string {
	// Check for exact match first
	if (PAGE_TITLES[pathname]) {
		return PAGE_TITLES[pathname];
	}

	// Check for dynamic routes
	if (pathname.startsWith("/projects/")) {
		return "Project Details";
	}
	if (pathname.startsWith("/themes/")) {
		return "Theme Details";
	}
	if (pathname.startsWith("/notes/")) {
		return "Theme Notes";
	}
	if (pathname.startsWith("/settings/parameters")) {
		return "Parameters";
	}
	if (pathname.startsWith("/settings/models")) {
		return "Model Configuration";
	}

	return "BetterNotes";
}

export function Header() {
	const pathname = usePathname();
	const title = getPageTitle(pathname);

	return (
		<header className="flex h-16 shrink-0 items-center border-border border-b bg-background px-6 md:px-8">
			{/* Spacer for mobile menu button */}
			<div className="w-10 md:hidden" />

			<h1 className="font-semibold text-xl">{title}</h1>
		</header>
	);
}
