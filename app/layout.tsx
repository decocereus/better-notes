import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
	title: "BetterNotes - UPSC Essay Preparation",
	description:
		"Intelligent essay preparation assistant for UPSC aspirants. Extract patterns from topper essays, classify notes, and generate revision-ready content.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html className={inter.variable} lang="en">
			<body className="font-sans antialiased">
				<AppShell>{children}</AppShell>
			</body>
		</html>
	);
}
