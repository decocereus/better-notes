"use client";

/**
 * Comparison Results Component
 * Displays gap analysis results with coverage charts, gaps, and suggestions.
 */

import {
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Lightbulb,
	Target,
	TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type {
	ComparisonSuggestion,
	ContentGap,
	CoverageStat,
	GapSeverity,
	ThemeComparisonResult,
} from "@/types/comparison";

interface ComparisonResultsProps {
	result: ThemeComparisonResult;
	onViewContent?: (contentId: string) => void;
}

/**
 * Progress bar component for coverage visualization.
 */
function getProgressColorClass(percentage: number): string {
	if (percentage >= 70) {
		return "bg-green-500";
	}
	if (percentage >= 40) {
		return "bg-yellow-500";
	}
	return "bg-red-500";
}

function ProgressBar({
	value,
	max = 100,
	className = "",
}: {
	value: number;
	max?: number;
	className?: string;
}) {
	const percentage = Math.min((value / max) * 100, 100);
	const colorClass = getProgressColorClass(percentage);

	return (
		<div className={`h-2 w-full rounded-full bg-muted ${className}`}>
			<div
				className={`h-full rounded-full transition-all ${colorClass}`}
				style={{ width: `${percentage}%` }}
			/>
		</div>
	);
}

function getScoreColorClass(score: number): string {
	if (score >= 70) {
		return "text-green-600";
	}
	if (score >= 40) {
		return "text-yellow-600";
	}
	return "text-red-600";
}

/**
 * Score display component.
 */
function ScoreDisplay({ score, label }: { score: number; label: string }) {
	const colorClass = getScoreColorClass(score);

	return (
		<div className="text-center">
			<p className={`font-bold text-3xl ${colorClass}`}>{score}</p>
			<p className="text-muted-foreground text-sm">{label}</p>
		</div>
	);
}

/**
 * Severity badge component.
 */
function SeverityBadge({ severity }: { severity: GapSeverity }) {
	const variants: Record<GapSeverity, "destructive" | "default" | "secondary"> =
		{
			high: "destructive",
			medium: "default",
			low: "secondary",
		};

	const labels: Record<GapSeverity, string> = {
		high: "High Priority",
		medium: "Medium",
		low: "Low",
	};

	return <Badge variant={variants[severity]}>{labels[severity]}</Badge>;
}

/**
 * Coverage chart showing user vs topper content by type.
 */
function CoverageChart({ coverage }: { coverage: CoverageStat[] }) {
	// Format content type labels
	const formatLabel = (type: string) =>
		type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Target className="size-5" />
					Coverage by Content Type
				</CardTitle>
				<CardDescription>
					Compare your content coverage against toppers
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{coverage.map((stat) => (
						<div className="space-y-1" key={stat.contentType}>
							<div className="flex items-center justify-between text-sm">
								<span className="font-medium">
									{formatLabel(stat.contentType)}
								</span>
								<span className="text-muted-foreground">
									{stat.userCount} / {stat.topperCount}
									<span className="ml-2 text-xs">
										({stat.coveragePercent}%)
									</span>
								</span>
							</div>
							<ProgressBar value={stat.coveragePercent} />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Gap item component with expandable details.
 */
function GapItem({
	gap,
	onViewContent,
}: {
	gap: ContentGap;
	onViewContent?: (contentId: string) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	const formatType = (type: string) =>
		type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

	return (
		<div className="rounded-lg border p-4">
			<button
				className="flex w-full cursor-pointer items-start justify-between text-left"
				onClick={() => setIsExpanded(!isExpanded)}
				type="button"
			>
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<SeverityBadge severity={gap.severity} />
						<span className="font-medium">{formatType(gap.contentType)}</span>
						{gap.exampleCategory && (
							<span className="text-muted-foreground text-sm">
								({formatType(gap.exampleCategory)})
							</span>
						)}
					</div>
					<p className="mt-1 text-muted-foreground text-sm">
						{gap.description}
					</p>
				</div>
				<div className="ml-2 flex items-center gap-2">
					<span className="text-muted-foreground text-sm">
						{gap.count} items
					</span>
					{isExpanded ? (
						<ChevronDown className="size-4" />
					) : (
						<ChevronRight className="size-4" />
					)}
				</div>
			</button>

			{isExpanded && (
				<div className="mt-4 border-t pt-4">
					<p className="mb-2 text-sm">
						<span className="font-medium">Why this matters:</span>{" "}
						{gap.reasoning}
					</p>
					{gap.topperContentIds.length > 0 && onViewContent && (
						<div className="mt-2">
							<p className="mb-1 font-medium text-sm">Reference examples:</p>
							<div className="flex flex-wrap gap-2">
								{gap.topperContentIds.slice(0, 3).map((id) => (
									<button
										className="text-primary text-sm hover:underline"
										key={id}
										onClick={(e) => {
											e.stopPropagation();
											onViewContent(id);
										}}
										type="button"
									>
										View example <ArrowRight className="ml-1 inline size-3" />
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Gaps list component.
 */
function GapsList({
	gaps,
	onViewContent,
}: {
	gaps: ContentGap[];
	onViewContent?: (contentId: string) => void;
}) {
	const highGaps = gaps.filter((g) => g.severity === "high");
	const mediumGaps = gaps.filter((g) => g.severity === "medium");
	const lowGaps = gaps.filter((g) => g.severity === "low");

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<AlertTriangle className="size-5" />
					Identified Gaps
				</CardTitle>
				<CardDescription>
					{gaps.length} gap{gaps.length !== 1 ? "s" : ""} found (
					{highGaps.length} high, {mediumGaps.length} medium, {lowGaps.length}{" "}
					low)
				</CardDescription>
			</CardHeader>
			<CardContent>
				{gaps.length === 0 ? (
					<div className="flex items-center gap-2 text-green-600">
						<CheckCircle2 className="size-5" />
						<span>No significant gaps found! Great work!</span>
					</div>
				) : (
					<div className="space-y-3">
						{gaps.map((gap) => (
							<GapItem gap={gap} key={gap.id} onViewContent={onViewContent} />
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/**
 * Suggestion item component with expandable action items.
 */
function SuggestionItem({
	suggestion,
	onViewContent,
}: {
	suggestion: ComparisonSuggestion;
	onViewContent?: (contentId: string) => void;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	const typeIcons: Record<string, React.ReactNode> = {
		add: <span className="text-green-600">+</span>,
		improve: <TrendingUp className="size-4 text-blue-600" />,
		diversify: <span className="text-purple-600">*</span>,
	};

	const formatType = (type: string) =>
		type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

	return (
		<div className="rounded-lg border p-4">
			<button
				className="flex w-full cursor-pointer items-start justify-between text-left"
				onClick={() => setIsExpanded(!isExpanded)}
				type="button"
			>
				<div className="flex-1">
					<div className="flex items-center gap-2">
						{typeIcons[suggestion.type]}
						<SeverityBadge severity={suggestion.priority} />
						<span className="font-medium">
							{formatType(suggestion.contentType)}
						</span>
					</div>
					<p className="mt-1 text-sm">{suggestion.description}</p>
				</div>
				<div className="ml-2">
					{isExpanded ? (
						<ChevronDown className="size-4" />
					) : (
						<ChevronRight className="size-4" />
					)}
				</div>
			</button>

			{isExpanded && (
				<div className="mt-4 border-t pt-4">
					{suggestion.actionItems.length > 0 && (
						<div className="mb-3">
							<p className="mb-2 font-medium text-sm">Action Items:</p>
							<ul className="list-inside list-disc space-y-1 text-sm">
								{suggestion.actionItems.map((item, i) => (
									<li key={`${suggestion.id}-action-${i}`}>{item}</li>
								))}
							</ul>
						</div>
					)}
					{suggestion.referenceContentIds.length > 0 && onViewContent && (
						<div>
							<p className="mb-1 font-medium text-sm">Reference content:</p>
							<div className="flex flex-wrap gap-2">
								{suggestion.referenceContentIds.slice(0, 3).map((id) => (
									<button
										className="text-primary text-sm hover:underline"
										key={id}
										onClick={(e) => {
											e.stopPropagation();
											onViewContent(id);
										}}
										type="button"
									>
										View example <ArrowRight className="ml-1 inline size-3" />
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Suggestions list component.
 */
function SuggestionsList({
	suggestions,
	onViewContent,
}: {
	suggestions: ComparisonSuggestion[];
	onViewContent?: (contentId: string) => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Lightbulb className="size-5" />
					Improvement Suggestions
				</CardTitle>
				<CardDescription>
					{suggestions.length} suggestion{suggestions.length !== 1 ? "s" : ""}{" "}
					for improvement
				</CardDescription>
			</CardHeader>
			<CardContent>
				{suggestions.length === 0 ? (
					<p className="text-muted-foreground">
						No suggestions at this time. Keep up the good work!
					</p>
				) : (
					<div className="space-y-3">
						{suggestions.map((suggestion) => (
							<SuggestionItem
								key={suggestion.id}
								onViewContent={onViewContent}
								suggestion={suggestion}
							/>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

/**
 * Score overview component showing overall readiness.
 */
function ScoreOverview({ result }: { result: ThemeComparisonResult }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Readiness Score</CardTitle>
				<CardDescription>
					{result.miniThemeName} ({result.mainThemeName})
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-6 sm:grid-cols-4">
					<ScoreDisplay label="Overall" score={result.overallScore} />
					<ScoreDisplay
						label="Coverage"
						score={result.scoreBreakdown.coverageScore}
					/>
					<ScoreDisplay
						label="Quality"
						score={result.scoreBreakdown.qualityScore}
					/>
					<ScoreDisplay
						label="Diversity"
						score={result.scoreBreakdown.diversityScore}
					/>
				</div>

				<div className="mt-6 grid gap-4 border-t pt-6 sm:grid-cols-2">
					<div>
						<p className="font-medium text-sm">Your Content</p>
						<p className="text-2xl">{result.summary.userContentCount} items</p>
					</div>
					<div>
						<p className="font-medium text-sm">Topper Reference</p>
						<p className="text-2xl">
							{result.summary.topperContentCount} items
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

/**
 * Main Comparison Results component.
 */
export function ComparisonResults({
	result,
	onViewContent,
}: ComparisonResultsProps) {
	return (
		<div className="space-y-6">
			{/* Score Overview */}
			<ScoreOverview result={result} />

			{/* Coverage Chart */}
			<CoverageChart coverage={result.coverage} />

			{/* Gaps List */}
			<GapsList gaps={result.gaps} onViewContent={onViewContent} />

			{/* Suggestions */}
			<SuggestionsList
				onViewContent={onViewContent}
				suggestions={result.suggestions}
			/>
		</div>
	);
}

/**
 * Compact version for displaying in lists/cards.
 */
export function ComparisonResultsSummary({
	result,
	onClick,
}: {
	result: ThemeComparisonResult;
	onClick?: () => void;
}) {
	const highGaps = result.gaps.filter((g) => g.severity === "high").length;

	return (
		<Card
			className={onClick ? "cursor-pointer hover:bg-muted/50" : ""}
			onClick={onClick}
		>
			<CardContent className="pt-6">
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium">{result.miniThemeName}</p>
						<p className="text-muted-foreground text-sm">
							{result.mainThemeName}
						</p>
					</div>
					<div className="text-right">
						<ScoreDisplay label="Score" score={result.overallScore} />
					</div>
				</div>

				<div className="mt-4 flex items-center gap-4 text-sm">
					<span className="text-muted-foreground">
						{result.gaps.length} gap{result.gaps.length !== 1 ? "s" : ""}
					</span>
					{highGaps > 0 && (
						<span className="text-red-600">{highGaps} high priority</span>
					)}
					<span className="text-muted-foreground">
						{result.suggestions.length} suggestion
						{result.suggestions.length !== 1 ? "s" : ""}
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
