import { NextResponse } from "next/server";

import { type LLMTestResult, testLLMConnection } from "@/lib/llm";

/**
 * Request body for POST /api/llm/test
 */
interface TestRequest {
	/** Model ID to test */
	modelId: string;
}

/**
 * POST /api/llm/test
 *
 * Tests the LLM connection with a specific model.
 * Sends a simple prompt and measures response time.
 *
 * Request body: { modelId: string }
 * Response: LLMTestResult
 */
export async function POST(
	request: Request
): Promise<NextResponse<LLMTestResult | { error: string }>> {
	try {
		const body = (await request.json()) as TestRequest;
		const { modelId } = body;

		if (!modelId) {
			return NextResponse.json(
				{ error: "modelId is required" },
				{ status: 400 }
			);
		}

		// Check if API key is configured
		if (!process.env.OPENROUTER_API_KEY) {
			return NextResponse.json(
				{
					success: false,
					responseTime: 0,
					modelId,
					error: "OPENROUTER_API_KEY environment variable is not configured",
				},
				{ status: 500 }
			);
		}

		// Run the test
		const result = await testLLMConnection(modelId);

		return NextResponse.json(result);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Test failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
