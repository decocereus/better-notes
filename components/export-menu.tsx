"use client";

import { Clipboard, Download, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	copyToClipboard,
	downloadAsJson,
	downloadAsMarkdown,
} from "@/lib/utils/export";

interface ExportMenuProps {
	markdown: string;
	jsonData: unknown;
	filename: string;
}

export function ExportMenu({ markdown, jsonData, filename }: ExportMenuProps) {
	async function handleCopy() {
		const success = await copyToClipboard(markdown);
		if (success) {
			toast.success("Copied to clipboard");
		} else {
			toast.error("Failed to copy");
		}
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button size="sm" variant="outline">
					<Download className="mr-2 h-4 w-4" />
					Export
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={handleCopy}>
					<Clipboard className="mr-2 h-4 w-4" />
					Copy as Markdown
				</DropdownMenuItem>
				<DropdownMenuItem
					onClick={() => downloadAsMarkdown(markdown, filename)}
				>
					<FileText className="mr-2 h-4 w-4" />
					Download Markdown
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => downloadAsJson(jsonData, filename)}>
					<FileJson className="mr-2 h-4 w-4" />
					Download JSON
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
