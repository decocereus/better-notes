import { ProjectDetailContent } from "@/components/project-detail-content";

interface ProjectDetailPageProps {
	params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({
	params,
}: ProjectDetailPageProps) {
	const { id } = await params;

	return <ProjectDetailContent projectId={id} />;
}
