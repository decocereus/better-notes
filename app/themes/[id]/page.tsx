import { ThemeDetailContent } from "@/components/theme-detail-content";

interface ThemeDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function ThemeDetailPage({
	params,
}: ThemeDetailPageProps) {
	const { id } = await params;

	return <ThemeDetailContent themeId={id} />;
}
