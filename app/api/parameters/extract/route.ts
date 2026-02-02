/**
 * API route for extracting strategy parameters from a Notion page.
 */

import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { getModel } from "@/lib/ai";
import {
	createStrategyParametersPrompt,
	PARAMETERS_SYSTEM_PROMPT,
} from "@/lib/llm/prompts/parameters";
import { getModelForTask } from "@/lib/llm/provider";
import { ExtractionParametersSchema } from "@/lib/llm/schemas/extraction";
import { getNotionApiKey, hasEnvApiKey } from "@/lib/notion/config";
import { fetchUserContent } from "@/lib/notion/content-fetcher";
import { createLogger } from "@/lib/utils/logger";
import {
	DEFAULT_EXTRACTION_PARAMETERS,
	type ExtractionParameters,
} from "@/types/extraction";

const log = createLogger("api/parameters/extract");

interface ParametersExtractBody {
	pageId: string;
	modelConfig?: Record<string, string>;
}

function mapNotionError(
	error: Error
): { status: number; message: string } | null {
	const message = error.message;
	if (message.includes("401")) {
		return { status: 401, message: "Invalid Notion API key" };
	}
	if (message.includes("404")) {
		return { status: 404, message: "Page not found or not accessible" };
	}
	if (message.includes("403")) {
		return { status: 403, message: "Access denied to this page" };
	}
	return null;
}

async function fetchStrategyContent(pageId: string) {
	const apiKey = getNotionApiKey();
	const userContent = await fetchUserContent(pageId, apiKey);
	if (userContent.wordCount < 20) {
		throw new Error("Strategy document is too short to extract parameters");
	}
	return userContent;
}

async function extractParametersFromContent(
	content: string,
	modelConfig?: Record<string, string>
): Promise<ExtractionParameters> {
	const modelId = getModelForTask("pattern_extraction", modelConfig);
	const model = getModel("EXTRACTION", modelId);
	const prompt = createStrategyParametersPrompt(
		content,
		DEFAULT_EXTRACTION_PARAMETERS
	);

	const { output } = await generateText({
		model,
		output: Output.object({ schema: ExtractionParametersSchema }),
		system: PARAMETERS_SYSTEM_PROMPT,
		prompt,
	});

	if (!output) {
		throw new Error("Failed to extract parameters");
	}

	return {
		...DEFAULT_EXTRACTION_PARAMETERS,
		...output,
	};
}

function buildErrorResponse(error: unknown) {
	if (error instanceof Error) {
		if (
			error.message === "Strategy document is too short to extract parameters"
		) {
			return NextResponse.json({ error: error.message }, { status: 400 });
		}
		const mapped = mapNotionError(error);
		if (mapped) {
			return NextResponse.json(
				{ error: mapped.message },
				{ status: mapped.status }
			);
		}
		return NextResponse.json({ error: error.message }, { status: 500 });
	}

	return NextResponse.json(
		{ error: "Failed to extract parameters" },
		{ status: 500 }
	);
}

export async function POST(request: Request) {
	if (!hasEnvApiKey()) {
		return NextResponse.json(
			{
				error:
					"NOTION_API_KEY environment variable not configured. Add it to your .env.local file.",
			},
			{ status: 400 }
		);
	}

	try {
		const body = (await request.json()) as ParametersExtractBody;
		const { pageId, modelConfig } = body;

		if (!pageId) {
			return NextResponse.json(
				{ error: "Page ID is required" },
				{ status: 400 }
			);
		}

		log.info(`Extracting parameters from strategy page ${pageId}`);

		const userContent = await fetchStrategyContent(pageId);
		const parameters = await extractParametersFromContent(
			userContent.text,
			modelConfig
		);

		return NextResponse.json({
			parameters,
			page: {
				id: userContent.pageId,
				title: userContent.title,
				url: userContent.url,
				wordCount: userContent.wordCount,
			},
		});
	} catch (error) {
		log.error("Failed to extract strategy parameters:", error);
		return buildErrorResponse(error);
	}
}
