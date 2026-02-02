import { ThemeCompareContent } from "@/components/theme-compare-content";

interface ThemeComparePageProps {
	params: Promise<{ id: string }>;
	searchParams?: {
		projectId?: string;
	};
}

export default async function ThemeComparePage({
	params,
	searchParams,
}: ThemeComparePageProps) {
	const { id } = await params;

	return (
		<ThemeCompareContent
			initialProjectId={searchParams?.projectId}
			themeId={id}
		/>
	);
}
