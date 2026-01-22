import { ThemeCompareContent } from "@/components/theme-compare-content";

interface ThemeComparePageProps {
	params: Promise<{ id: string }>;
}

export default async function ThemeComparePage({
	params,
}: ThemeComparePageProps) {
	const { id } = await params;

	return <ThemeCompareContent themeId={id} />;
}
