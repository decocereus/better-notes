"use client";

import { useQuery } from "convex/react";
import {
	AlertCircle,
	CheckCircle2,
	FolderOpen,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/convex/_generated/api";
import type { Asset, AssetStats } from "@/types/asset";
import { AssetCard } from "./asset-card";
import { AssetDetailDialog } from "./asset-detail-dialog";
import { AssignAssetDialog } from "./assign-asset-dialog";

interface AssetsData {
	assets: Asset[];
	stats: AssetStats;
}

export function AssetsContent() {
	const [data, setData] = useState<AssetsData | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Filters
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [assignmentFilter, setAssignmentFilter] = useState<string>("all");
	const [searchQuery, setSearchQuery] = useState("");

	// Dialogs
	const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
	const [assignAsset, setAssignAsset] = useState<Asset | null>(null);
	const [detailDialogOpen, setDetailDialogOpen] = useState(false);
	const [assignDialogOpen, setAssignDialogOpen] = useState(false);

	// Get projects for assignment dialog
	const projects = useQuery(api.projects.list);

	const fetchAssets = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const params = new URLSearchParams();

			if (statusFilter !== "all") {
				params.set("status", statusFilter);
			}
			if (assignmentFilter === "unassigned") {
				params.set("unassignedOnly", "true");
			}

			const response = await fetch(`/api/assets?${params.toString()}`);
			if (!response.ok) {
				throw new Error("Failed to fetch assets");
			}

			const assetsData = await response.json();
			setData(assetsData);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load assets");
		} finally {
			setIsLoading(false);
		}
	}, [statusFilter, assignmentFilter]);

	useEffect(() => {
		fetchAssets();
	}, [fetchAssets]);

	// Filter assets by search query
	const filteredAssets =
		data?.assets.filter((asset) =>
			asset.filename.toLowerCase().includes(searchQuery.toLowerCase())
		) || [];

	// Get project name for an asset
	const getProjectName = (projectId: string | undefined) => {
		if (!(projectId && projects)) {
			return undefined;
		}
		const project = projects.find((p) => p.id.toString() === projectId);
		return project?.name;
	};

	const handleViewAsset = (assetId: string) => {
		setSelectedAssetId(assetId);
		setDetailDialogOpen(true);
	};

	const handleAssignAsset = (asset: Asset) => {
		setAssignAsset(asset);
		setAssignDialogOpen(true);
	};

	const handleProcessAsset = async (assetId: string) => {
		try {
			const response = await fetch(`/api/assets/${assetId}/process`, {
				method: "POST",
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || "Failed to start processing");
			}

			// Refresh the list
			await fetchAssets();
		} catch (err) {
			console.error("Failed to process asset:", err);
		}
	};

	const handleDeleteAsset = async (assetId: string) => {
		// biome-ignore lint/suspicious/noAlert: Using native confirm for simplicity, can be replaced with custom dialog
		if (!confirm("Are you sure you want to delete this asset?")) {
			return;
		}

		try {
			const response = await fetch(`/api/assets/${assetId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete asset");
			}

			// Refresh the list
			await fetchAssets();
		} catch (err) {
			console.error("Failed to delete asset:", err);
		}
	};

	const handleAssignComplete = async (
		assetId: string,
		projectId: string | null
	) => {
		try {
			const response = await fetch(`/api/assets/${assetId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ projectId }),
			});

			if (!response.ok) {
				throw new Error("Failed to assign asset");
			}

			// Refresh the list
			await fetchAssets();
		} catch (err) {
			console.error("Failed to assign asset:", err);
			throw err;
		}
	};

	const stats = data?.stats;

	return (
		<div className="space-y-6">
			{/* Stats Cards */}
			{stats && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						icon={<FolderOpen className="size-5" />}
						label="Total Assets"
						value={stats.total}
					/>
					<StatCard
						icon={<AlertCircle className="size-5 text-yellow-500" />}
						label="Unassigned"
						value={stats.unassigned}
					/>
					<StatCard
						icon={<Loader2 className="size-5 animate-spin text-blue-500" />}
						label="Processing"
						value={
							stats.byStatus.ocr_processing +
							stats.byStatus.extraction_processing +
							stats.byStatus.ocr_queued +
							stats.byStatus.extraction_queued
						}
					/>
					<StatCard
						icon={<CheckCircle2 className="size-5 text-green-500" />}
						label="Completed"
						value={stats.byStatus.extraction_completed}
					/>
				</div>
			)}

			{/* Filters */}
			<div className="flex flex-wrap items-center gap-4">
				<Input
					className="w-64"
					onChange={(e) => setSearchQuery(e.target.value)}
					placeholder="Search by filename..."
					value={searchQuery}
				/>

				<Select onValueChange={setStatusFilter} value={statusFilter}>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Statuses</SelectItem>
						<SelectItem value="pending">Pending</SelectItem>
						<SelectItem value="ocr_processing">OCR Processing</SelectItem>
						<SelectItem value="extraction_processing">Extracting</SelectItem>
						<SelectItem value="extraction_completed">Completed</SelectItem>
						<SelectItem value="ocr_failed">OCR Failed</SelectItem>
						<SelectItem value="extraction_failed">Extraction Failed</SelectItem>
					</SelectContent>
				</Select>

				<Select onValueChange={setAssignmentFilter} value={assignmentFilter}>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Assignment" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All</SelectItem>
						<SelectItem value="unassigned">Unassigned Only</SelectItem>
						<SelectItem value="assigned">Assigned Only</SelectItem>
					</SelectContent>
				</Select>

				<Button disabled={isLoading} onClick={fetchAssets} variant="outline">
					<RefreshCw
						className={`mr-2 size-4 ${isLoading ? "animate-spin" : ""}`}
					/>
					Refresh
				</Button>
			</div>

			{/* Error State */}
			{error && (
				<div className="rounded-lg bg-destructive/10 p-4 text-center text-destructive">
					{error}
				</div>
			)}

			{/* Loading State */}
			{isLoading && !data && (
				<div className="flex items-center justify-center py-12">
					<Loader2 className="size-8 animate-spin text-muted-foreground" />
				</div>
			)}

			{/* Empty State */}
			{!isLoading && filteredAssets.length === 0 && (
				<div className="rounded-lg border border-dashed p-12 text-center">
					<FolderOpen className="mx-auto mb-4 size-12 text-muted-foreground" />
					<h3 className="font-medium text-lg">No assets found</h3>
					<p className="mt-1 text-muted-foreground text-sm">
						{searchQuery
							? "Try a different search term"
							: "Upload files to get started"}
					</p>
				</div>
			)}

			{/* Asset Grid */}
			{filteredAssets.length > 0 && (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filteredAssets.map((asset) => (
						<AssetCard
							asset={asset}
							key={asset.id}
							onAssign={() => handleAssignAsset(asset)}
							onDelete={() => handleDeleteAsset(asset.id.toString())}
							onProcess={() => handleProcessAsset(asset.id.toString())}
							onView={() => handleViewAsset(asset.id.toString())}
							projectName={getProjectName(asset.projectId?.toString())}
						/>
					))}
				</div>
			)}

			{/* Dialogs */}
			<AssetDetailDialog
				assetId={selectedAssetId}
				onOpenChange={setDetailDialogOpen}
				open={detailDialogOpen}
			/>

			<AssignAssetDialog
				asset={assignAsset}
				onAssign={handleAssignComplete}
				onOpenChange={setAssignDialogOpen}
				open={assignDialogOpen}
				projects={
					projects?.map((p) => ({ id: p.id.toString(), name: p.name })) || []
				}
			/>
		</div>
	);
}

interface StatCardProps {
	icon: React.ReactNode;
	label: string;
	value: number;
}

function StatCard({ icon, label, value }: StatCardProps) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="font-medium text-sm">{label}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent>
				<div className="font-bold text-2xl">{value}</div>
			</CardContent>
		</Card>
	);
}
