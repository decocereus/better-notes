/**
 * PDF-to-Image Converter Service for Railway
 *
 * Converts PDF files to JPEG images using Poppler (pdftoppm).
 * Downloads from R2, converts locally, uploads pages back to R2.
 *
 * Endpoints:
 * - POST /convert: Convert PDF to images
 * - GET /convert/:assetId/status: Check conversion status
 * - GET /health: Health check
 */

import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";

// Top-level regex constants
const STATUS_PATH_REGEX = /^\/convert\/([^/]+)\/status$/;

// Configuration from environment
const PORT = Number(process.env.PORT) || 3000;
const CONVERTER_TOKEN = process.env.CONVERTER_TOKEN || "";
const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";

// Initialize S3 client for R2
const s3Client = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

// Request body type
interface ConvertRequest {
	assetId: string;
	sourceKey: string;
	dpi?: number;
	quality?: number;
	format?: "jpg" | "png";
}

// Conversion status type
interface ConversionStatus {
	status: "pending" | "processing" | "completed" | "failed";
	pagesProcessed: number;
	totalPages: number;
	startedAt?: string;
	completedAt?: string;
	error?: string;
}

// Response type
interface ConvertResponse {
	success: boolean;
	totalPages: number;
	errors: string[];
}

interface ConvertStartResponse {
	status: "started";
	message: string;
}

/**
 * Parse JSON body from request.
 */
function parseBody<T>(req: IncomingMessage): Promise<T> {
	return new Promise((resolve, reject) => {
		let body = "";
		req.on("data", (chunk) => {
			body += chunk.toString();
		});
		req.on("end", () => {
			try {
				resolve(JSON.parse(body) as T);
			} catch {
				reject(new Error("Invalid JSON body"));
			}
		});
		req.on("error", reject);
	});
}

/**
 * Send JSON response.
 */
function sendJson<T extends object>(
	res: ServerResponse,
	statusCode: number,
	data: T
): void {
	res.writeHead(statusCode, { "Content-Type": "application/json" });
	res.end(JSON.stringify(data));
}

/**
 * Validate authorization token.
 */
function validateAuth(req: IncomingMessage): boolean {
	if (!CONVERTER_TOKEN) {
		return true; // No token configured, allow all
	}
	const authHeader = req.headers.authorization;
	return authHeader === `Bearer ${CONVERTER_TOKEN}`;
}

/**
 * Download file from R2 to local path.
 */
async function downloadFromR2(key: string, localPath: string): Promise<void> {
	const command = new GetObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key,
	});

	const response = await s3Client.send(command);
	if (!response.Body) {
		throw new Error("Empty response from R2");
	}

	const chunks: Buffer[] = [];
	for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
		chunks.push(Buffer.from(chunk));
	}
	await writeFile(localPath, Buffer.concat(chunks));
}

/**
 * Upload file to R2 from local path.
 */
async function uploadToR2(localPath: string, key: string): Promise<void> {
	const content = await readFile(localPath);
	const command = new PutObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key,
		Body: content,
		ContentType: key.endsWith(".json") ? "application/json" : "image/jpeg",
	});
	await s3Client.send(command);
}

/**
 * Update conversion status in R2.
 */
async function updateStatus(
	assetId: string,
	status: ConversionStatus
): Promise<void> {
	const key = `assets/${assetId}/conversion-status.json`;
	const command = new PutObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: key,
		Body: JSON.stringify(status),
		ContentType: "application/json",
	});
	await s3Client.send(command);
}

/**
 * Get conversion status from R2.
 */
async function getStatus(assetId: string): Promise<ConversionStatus | null> {
	try {
		const key = `assets/${assetId}/conversion-status.json`;
		const command = new GetObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
		});
		const response = await s3Client.send(command);
		if (!response.Body) {
			return null;
		}
		const body = await response.Body.transformToString();
		return JSON.parse(body) as ConversionStatus;
	} catch {
		return null;
	}
}

/**
 * Convert PDF to images using pdftoppm.
 */
function convertPdf(
	pdfPath: string,
	outputDir: string,
	dpi: number,
	quality: number
): Promise<number> {
	return new Promise((resolve, reject) => {
		const args = [
			"-jpeg",
			"-r",
			String(dpi),
			"-jpegopt",
			`quality=${quality}`,
			pdfPath,
			join(outputDir, "page"),
		];

		console.log(`[Converter] Running: pdftoppm ${args.join(" ")}`);

		const proc = spawn("pdftoppm", args);

		let stderr = "";
		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		proc.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`pdftoppm failed: ${stderr}`));
				return;
			}

			// Count generated files
			readdir(outputDir)
				.then((files) => {
					const pageFiles = files.filter((f) => f.endsWith(".jpg"));
					resolve(pageFiles.length);
				})
				.catch(reject);
		});

		proc.on("error", (err) => {
			reject(new Error(`Failed to start pdftoppm: ${err.message}`));
		});
	});
}

/**
 * Upload page images to R2 and track progress.
 */
async function uploadPages(
	outputDir: string,
	assetId: string,
	status: ConversionStatus
): Promise<string[]> {
	const errors: string[] = [];
	const pageFiles = (await readdir(outputDir))
		.filter((f) => f.endsWith(".jpg"))
		.sort();

	for (let i = 0; i < pageFiles.length; i++) {
		const file = pageFiles[i];
		const pageNum = i + 1;
		const paddedNum = String(pageNum).padStart(4, "0");
		const r2Key = `assets/${assetId}/pages/page-${paddedNum}.jpg`;

		try {
			await uploadToR2(join(outputDir, file), r2Key);
			status.pagesProcessed = pageNum;

			// Update status every 10 pages
			if (pageNum % 10 === 0 || pageNum === status.totalPages) {
				await updateStatus(assetId, status);
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Upload failed";
			errors.push(`Page ${pageNum}: ${msg}`);
		}
	}

	return errors;
}

/**
 * Store asset metadata in R2.
 */
async function storeMetadata(
	assetId: string,
	totalPages: number,
	sourceKey: string
): Promise<void> {
	const metadata = {
		totalPages,
		originalFilename: sourceKey.split("/").pop() || "unknown.pdf",
		convertedAt: new Date().toISOString(),
	};
	const metadataKey = `assets/${assetId}/metadata.json`;
	const metadataCommand = new PutObjectCommand({
		Bucket: R2_BUCKET_NAME,
		Key: metadataKey,
		Body: JSON.stringify(metadata),
		ContentType: "application/json",
	});
	await s3Client.send(metadataCommand);
}

/**
 * Run the PDF conversion pipeline.
 */
async function runConversionPipeline(
	assetId: string,
	sourceKey: string,
	dpi: number,
	quality: number,
	tempDir: string
): Promise<ConvertResponse> {
	const pdfPath = join(tempDir, "input.pdf");
	const outputDir = join(tempDir, "pages");
	await mkdir(outputDir, { recursive: true });

	// Initialize status
	const status: ConversionStatus = {
		status: "processing",
		pagesProcessed: 0,
		totalPages: 0,
		startedAt: new Date().toISOString(),
	};
	await updateStatus(assetId, status);

	// Download PDF from R2
	console.log(`[Converter] Downloading PDF from ${sourceKey}`);
	await downloadFromR2(sourceKey, pdfPath);

	// Convert to images
	console.log(`[Converter] Converting PDF (dpi=${dpi}, quality=${quality})`);
	const totalPages = await convertPdf(pdfPath, outputDir, dpi, quality);
	status.totalPages = totalPages;
	await updateStatus(assetId, status);
	console.log(`[Converter] Converted ${totalPages} pages`);

	// Upload pages and collect errors
	const errors = await uploadPages(outputDir, assetId, status);

	// Final status update
	status.status = errors.length > 0 ? "failed" : "completed";
	status.completedAt = new Date().toISOString();
	if (errors.length > 0) {
		status.error = errors.join("; ");
	}
	await updateStatus(assetId, status);

	// Store metadata
	await storeMetadata(assetId, totalPages, sourceKey);

	console.log(`[Converter] Conversion complete for asset ${assetId}`);

	return {
		success: errors.length === 0,
		totalPages,
		errors,
	};
}

/**
 * Start conversion in the background and return immediately.
 */
async function startConversionInBackground(
	assetId: string,
	sourceKey: string,
	dpi: number,
	quality: number
): Promise<void> {
	const tempDir = join(tmpdir(), `convert-${assetId}-${Date.now()}`);
	await mkdir(tempDir, { recursive: true });

	try {
		await runConversionPipeline(assetId, sourceKey, dpi, quality, tempDir);
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : "Unknown error";
		console.error(`[Converter] Conversion failed: ${errorMsg}`);

		const status: ConversionStatus = {
			status: "failed",
			pagesProcessed: 0,
			totalPages: 0,
			error: errorMsg,
			completedAt: new Date().toISOString(),
		};
		await updateStatus(assetId, status);
	} finally {
		try {
			await rm(tempDir, { recursive: true, force: true });
		} catch {
			console.warn(`[Converter] Failed to cleanup temp dir: ${tempDir}`);
		}
	}
}

/**
 * Handle POST /convert request.
 */
async function handleConvert(
	req: IncomingMessage,
	res: ServerResponse
): Promise<void> {
	// Parse request
	const body = await parseBody<ConvertRequest>(req);
	const { assetId, sourceKey, dpi = 150, quality = 85 } = body;

	if (!(assetId && sourceKey)) {
		sendJson(res, 400, { error: "assetId and sourceKey are required" });
		return;
	}

	console.log(`[Converter] Starting conversion for asset ${assetId}`);
	sendJson<ConvertStartResponse>(res, 202, {
		status: "started",
		message: "Conversion started",
	});

	startConversionInBackground(assetId, sourceKey, dpi, quality).catch(() => {
		// Fire and forget - errors handled inside
	});
}

/**
 * Handle GET /convert/:assetId/status request.
 */
async function handleStatus(
	assetId: string,
	res: ServerResponse
): Promise<void> {
	const status = await getStatus(assetId);
	if (!status) {
		sendJson(res, 404, { error: "Status not found" });
		return;
	}
	sendJson(res, 200, status);
}

/**
 * Main request handler.
 */
async function handleRequest(
	req: IncomingMessage,
	res: ServerResponse
): Promise<void> {
	const url = new URL(req.url || "/", `http://localhost:${PORT}`);
	const path = url.pathname;

	// CORS headers
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
	res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	// Health check
	if (path === "/health" && req.method === "GET") {
		sendJson(res, 200, { status: "healthy" });
		return;
	}

	// Auth check for other endpoints
	if (!validateAuth(req)) {
		sendJson(res, 401, { error: "Unauthorized" });
		return;
	}

	try {
		// POST /convert
		if (path === "/convert" && req.method === "POST") {
			await handleConvert(req, res);
			return;
		}

		// GET /convert/:assetId/status
		const statusMatch = path.match(STATUS_PATH_REGEX);
		if (statusMatch && req.method === "GET") {
			await handleStatus(statusMatch[1], res);
			return;
		}

		// 404
		sendJson(res, 404, { error: "Not found" });
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : "Internal error";
		console.error(`[Converter] Error: ${errorMsg}`);
		sendJson(res, 500, { error: errorMsg });
	}
}

// Create and start server
const server = createServer((req, res) => {
	handleRequest(req, res).catch((err) => {
		console.error("[Converter] Unhandled error:", err);
		sendJson(res, 500, { error: "Internal server error" });
	});
});

server.listen(PORT, () => {
	console.log(`[Converter] PDF converter service listening on port ${PORT}`);
	console.log(`[Converter] R2 bucket: ${R2_BUCKET_NAME}`);
	console.log(`[Converter] Auth: ${CONVERTER_TOKEN ? "enabled" : "disabled"}`);
});
