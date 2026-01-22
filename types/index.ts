/**
 * Barrel export for all types.
 * Import types from '@/types' for clean imports.
 */

// Content types
export type {
	ComparisonResult,
	ContentClassification,
	OverusedExample,
	PatternType,
	ThemeNotes,
	TopperPattern,
} from "./content";
// Extraction types
export type {
	ContentQuality,
	ContentSourceType as ExtractedContentSourceType,
	ContentType,
	EssayBoundary,
	EssayExtractionResult,
	ExampleCategory,
	ExtractedContent,
	ExtractionParameters,
	ThemeMapping,
} from "./extraction";
export { DEFAULT_EXTRACTION_PARAMETERS } from "./extraction";
// Processing types
export type {
	OcrJobResults,
	OcrPageResult,
	ProcessingError,
	ProcessingJob,
	ProcessingJobResult,
	ProcessingJobStatus,
	ProcessingJobSummary,
	ProcessingJobType,
	StartClassificationJobInput,
	StartExtractionJobInput,
	StartOcrJobInput,
	UploadedFile,
} from "./processing";
// Project types
export type {
	AddSourceInput,
	ContentSource,
	ContentSourceStatus,
	ContentSourceType,
	CreateProjectInput,
	Project,
} from "./project";
// Settings types
export type {
	AppSettings,
	AvailableModel,
	ModelCapability,
	ModelConfig,
	NotionConnectionStatus,
	TaskType,
} from "./settings";
export { DEFAULT_SETTINGS } from "./settings";
// Theme types
export type {
	EssayQuestion,
	MainTheme,
	MiniTheme,
	ThemeData,
} from "./theme";
