import type { ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";

interface AppShellProps {
	children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
	return (
		<div className="flex h-screen overflow-hidden bg-background">
			<Sidebar />
			<div className="flex flex-1 flex-col overflow-hidden">
				<Header />
				<main className="flex-1 overflow-y-auto p-6 md:p-8">{children}</main>
			</div>
		</div>
	);
}
