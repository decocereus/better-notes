import { describe, expect, it } from "vitest";
import {
	AVAILABLE_MODELS,
	DEFAULT_MODEL_CONFIG,
	getModelById,
	getModelForTask,
	getModelsForTask,
	getModelsWithCapability,
	isValidModel,
	TASK_DEFINITIONS,
} from "../provider";

describe("AVAILABLE_MODELS", () => {
	it("contains at least 1 model", () => {
		expect(AVAILABLE_MODELS.length).toBeGreaterThanOrEqual(1);
	});

	it("each model has required fields", () => {
		for (const model of AVAILABLE_MODELS) {
			expect(model.id).toBeDefined();
			expect(typeof model.id).toBe("string");
			expect(model.id.length).toBeGreaterThan(0);

			expect(model.name).toBeDefined();
			expect(typeof model.name).toBe("string");
			expect(model.name.length).toBeGreaterThan(0);

			expect(model.capabilities).toBeDefined();
			expect(Array.isArray(model.capabilities)).toBe(true);
			expect(model.capabilities.length).toBeGreaterThan(0);

			expect(model.description).toBeDefined();
			expect(typeof model.description).toBe("string");
		}
	});

	it("includes Kimi models", () => {
		const kimiModels = AVAILABLE_MODELS.filter((m) =>
			m.id.includes("moonshotai/kimi")
		);
		expect(kimiModels.length).toBeGreaterThan(0);
	});

	it("has at least one model with vision capability", () => {
		const visionModels = AVAILABLE_MODELS.filter((m) =>
			m.capabilities.includes("vision")
		);
		expect(visionModels.length).toBeGreaterThan(0);
	});

	it("has at least one model with text capability", () => {
		const textModels = AVAILABLE_MODELS.filter((m) =>
			m.capabilities.includes("text")
		);
		expect(textModels.length).toBeGreaterThan(0);
	});
});

describe("TASK_DEFINITIONS", () => {
	it("contains exactly 5 tasks", () => {
		expect(TASK_DEFINITIONS).toHaveLength(5);
	});

	it("includes OCR task", () => {
		const ocrTask = TASK_DEFINITIONS.find((t) => t.id === "ocr");
		expect(ocrTask).toBeDefined();
		expect(ocrTask?.requiresVision).toBe(true);
	});

	it("includes pattern extraction task", () => {
		const task = TASK_DEFINITIONS.find((t) => t.id === "pattern_extraction");
		expect(task).toBeDefined();
		expect(task?.requiresVision).toBe(false);
	});

	it("includes classification task", () => {
		const task = TASK_DEFINITIONS.find((t) => t.id === "classification");
		expect(task).toBeDefined();
		expect(task?.requiresVision).toBe(false);
	});

	it("includes comparison task", () => {
		const task = TASK_DEFINITIONS.find((t) => t.id === "comparison");
		expect(task).toBeDefined();
		expect(task?.requiresVision).toBe(false);
	});

	it("includes generation task", () => {
		const task = TASK_DEFINITIONS.find((t) => t.id === "generation");
		expect(task).toBeDefined();
		expect(task?.requiresVision).toBe(false);
	});

	it("each task has required fields", () => {
		for (const task of TASK_DEFINITIONS) {
			expect(task.id).toBeDefined();
			expect(task.name).toBeDefined();
			expect(task.description).toBeDefined();
			expect(typeof task.requiresVision).toBe("boolean");
		}
	});
});

describe("DEFAULT_MODEL_CONFIG", () => {
	it("has default for every task", () => {
		for (const task of TASK_DEFINITIONS) {
			expect(DEFAULT_MODEL_CONFIG[task.id]).toBeDefined();
		}
	});

	it("uses vision-capable model for OCR", () => {
		const ocrModel = DEFAULT_MODEL_CONFIG.ocr;
		const model = AVAILABLE_MODELS.find((m) => m.id === ocrModel);
		expect(model?.capabilities).toContain("vision");
	});

	it("all default models are valid", () => {
		for (const modelId of Object.values(DEFAULT_MODEL_CONFIG)) {
			expect(isValidModel(modelId)).toBe(true);
		}
	});
});

describe("isValidModel", () => {
	it("returns true for valid model IDs", () => {
		for (const model of AVAILABLE_MODELS) {
			expect(isValidModel(model.id)).toBe(true);
		}
	});

	it("returns false for invalid model ID", () => {
		expect(isValidModel("invalid/model")).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isValidModel("")).toBe(false);
	});

	it("returns false for partial match", () => {
		expect(isValidModel("moonshotai")).toBe(false);
	});
});

describe("getModelById", () => {
	it("returns model for valid ID", () => {
		const model = getModelById("moonshotai/kimi-k2.5");
		expect(model).toBeDefined();
		expect(model?.name).toBe("Kimi K2.5");
	});

	it("returns undefined for invalid ID", () => {
		const model = getModelById("invalid/model");
		expect(model).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		const model = getModelById("");
		expect(model).toBeUndefined();
	});
});

describe("getModelsWithCapability", () => {
	it("returns only vision-capable models for vision capability", () => {
		const models = getModelsWithCapability("vision");
		expect(models.length).toBeGreaterThan(0);
		for (const model of models) {
			expect(model.capabilities).toContain("vision");
		}
	});

	it("returns all models for text capability (all have text)", () => {
		const models = getModelsWithCapability("text");
		expect(models.length).toBe(AVAILABLE_MODELS.length);
	});
});

describe("getModelsForTask", () => {
	it("returns only vision models for OCR task", () => {
		const models = getModelsForTask("ocr");
		expect(models.length).toBeGreaterThan(0);
		for (const model of models) {
			expect(model.capabilities).toContain("vision");
		}
	});

	it("returns all models for text-only tasks", () => {
		const models = getModelsForTask("classification");
		expect(models.length).toBe(AVAILABLE_MODELS.length);
	});

	it("returns all models for pattern extraction", () => {
		const models = getModelsForTask("pattern_extraction");
		expect(models.length).toBe(AVAILABLE_MODELS.length);
	});

	it("returns all models for comparison", () => {
		const models = getModelsForTask("comparison");
		expect(models.length).toBe(AVAILABLE_MODELS.length);
	});

	it("returns all models for generation", () => {
		const models = getModelsForTask("generation");
		expect(models.length).toBe(AVAILABLE_MODELS.length);
	});
});

describe("getModelForTask", () => {
	it("returns default model when no config provided", () => {
		const modelId = getModelForTask("ocr");
		expect(modelId).toBe(DEFAULT_MODEL_CONFIG.ocr);
	});

	it("returns default model when config is empty", () => {
		const modelId = getModelForTask("ocr", {});
		expect(modelId).toBe(DEFAULT_MODEL_CONFIG.ocr);
	});

	it("returns configured model when provided", () => {
		const config = { ocr: "openai/gpt-4o" };
		const modelId = getModelForTask("ocr", config);
		expect(modelId).toBe("openai/gpt-4o");
	});

	it("returns default for tasks not in config", () => {
		const config = { ocr: "openai/gpt-4o" };
		const modelId = getModelForTask("classification", config);
		expect(modelId).toBe(DEFAULT_MODEL_CONFIG.classification);
	});
});
