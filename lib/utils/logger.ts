/**
 * Simple logging utility for server-side debugging.
 * Logs are prefixed with timestamps and module names for easy filtering.
 *
 * Enable verbose logging by setting DEBUG=true environment variable.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

/**
 * Check if debug mode is enabled.
 * Set DEBUG=true or DEBUG=1 in environment to enable.
 */
function isDebugEnabled(): boolean {
	const debug = process.env.DEBUG;
	return debug === "true" || debug === "1";
}

/**
 * Get the minimum log level from environment.
 * Set LOG_LEVEL=debug|info|warn|error to control verbosity.
 */
function getMinLogLevel(): LogLevel {
	const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
	return LOG_LEVELS[level] !== undefined ? level : "info";
}

/**
 * Format a timestamp for log output.
 */
function formatTimestamp(): string {
	return new Date().toISOString();
}

/**
 * Format a log message with prefix.
 */
function formatMessage(
	level: LogLevel,
	module: string,
	message: string
): string {
	const timestamp = formatTimestamp();
	const levelUpper = level.toUpperCase().padEnd(5);
	return `[${timestamp}] [${levelUpper}] [${module}] ${message}`;
}

/**
 * Log a message if the level meets the minimum threshold.
 */
function log(
	level: LogLevel,
	module: string,
	message: string,
	data?: unknown
): void {
	const minLevel = getMinLogLevel();

	// Always allow debug if DEBUG is set, otherwise use min level
	if (level === "debug" && !isDebugEnabled()) {
		return;
	}

	if (LOG_LEVELS[level] < LOG_LEVELS[minLevel] && level !== "debug") {
		return;
	}

	const formattedMessage = formatMessage(level, module, message);

	switch (level) {
		case "debug":
		case "info":
			if (data !== undefined) {
				console.log(formattedMessage, data);
			} else {
				console.log(formattedMessage);
			}
			break;
		case "warn":
			if (data !== undefined) {
				console.warn(formattedMessage, data);
			} else {
				console.warn(formattedMessage);
			}
			break;
		case "error":
			if (data !== undefined) {
				console.error(formattedMessage, data);
			} else {
				console.error(formattedMessage);
			}
			break;
		default: {
			// Exhaustive check - should never reach here
			const _exhaustive: never = level;
			console.log(formattedMessage, data);
		}
	}
}

/**
 * Creates a logger instance for a specific module.
 *
 * @example
 * const log = createLogger("theme-parser");
 * log.debug("Processing block", { blockId: "123", type: "toggle" });
 * log.info("Found 5 main themes");
 * log.error("Failed to parse", error);
 */
export function createLogger(module: string) {
	return {
		debug: (message: string, data?: unknown) =>
			log("debug", module, message, data),
		info: (message: string, data?: unknown) =>
			log("info", module, message, data),
		warn: (message: string, data?: unknown) =>
			log("warn", module, message, data),
		error: (message: string, data?: unknown) =>
			log("error", module, message, data),
	};
}

/**
 * Utility to log and return a value (useful for debugging in pipelines).
 */
export function tap<T>(module: string, message: string, value: T): T {
	log("debug", module, message, value);
	return value;
}
