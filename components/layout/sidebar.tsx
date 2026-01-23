"use client";

import {
	BookOpen,
	FileText,
	FolderKanban,
	FolderOpen,
	Home,
	Menu,
	Settings,
	Upload,
	X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

const NAV_ITEMS = [
	{ href: "/", label: "Dashboard", icon: Home },
	{ href: "/projects", label: "Projects", icon: FolderKanban },
	{ href: "/assets", label: "Assets", icon: FolderOpen },
	{ href: "/themes", label: "Themes", icon: BookOpen },
	{ href: "/patterns", label: "Patterns", icon: FileText },
	{ href: "/upload", label: "Upload", icon: Upload },
	{ href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar() {
	const pathname = usePathname();
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			{/* Mobile toggle button */}
			<Button
				className="fixed top-4 left-4 z-50 md:hidden"
				onClick={() => setIsOpen(!isOpen)}
				size="icon"
				variant="outline"
			>
				{isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
			</Button>

			{/* Mobile overlay */}
			{isOpen && (
				<button
					className="fixed inset-0 z-40 bg-black/50 md:hidden"
					onClick={() => setIsOpen(false)}
					onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
					tabIndex={-1}
					type="button"
				/>
			)}

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-border border-r bg-background transition-transform duration-200 ease-in-out md:static md:translate-x-0",
					isOpen ? "translate-x-0" : "-translate-x-full"
				)}
			>
				{/* Logo */}
				<div className="flex h-16 items-center gap-2 border-border border-b px-6">
					<BookOpen className="size-6 text-primary" />
					<span className="font-semibold text-lg">BetterNotes</span>
				</div>

				{/* Navigation */}
				<nav className="flex-1 space-y-1 p-4">
					{NAV_ITEMS.map((item) => {
						const isActive =
							pathname === item.href ||
							(item.href !== "/" && pathname.startsWith(item.href));

						return (
							<Link
								className={cn(
									"flex items-center gap-3 rounded-md px-3 py-2 font-medium text-sm transition-colors",
									isActive
										? "bg-primary/10 text-primary"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								)}
								href={item.href}
								key={item.href}
								onClick={() => setIsOpen(false)}
							>
								<item.icon className="size-5" />
								{item.label}
							</Link>
						);
					})}
				</nav>

				{/* Footer */}
				<div className="border-border border-t p-4">
					<p className="text-muted-foreground text-xs">
						UPSC Essay Preparation
					</p>
				</div>
			</aside>
		</>
	);
}
