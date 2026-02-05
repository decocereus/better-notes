export function downloadAsFile(
	content: string,
	filename: string,
	mimeType: string
): void {
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function downloadAsMarkdown(content: string, filename: string): void {
	downloadAsFile(content, `${filename}.md`, "text/markdown");
}

export function downloadAsJson(data: unknown, filename: string): void {
	const json = JSON.stringify(data, null, 2);
	downloadAsFile(json, `${filename}.json`, "application/json");
}

export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
