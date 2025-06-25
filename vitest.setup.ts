// Vitest setup file to handle unhandled errors and suppress expected stream errors

// Store original console methods
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
// const originalConsoleLog = console.log;

// Maximum length for serialized error data to prevent console overflow
const MAX_SERIALIZED_ERROR_LENGTH = 500;

// Filter out expected stream errors that occur during cleanup
function shouldSuppressError(error: Error | string): boolean {
  const errorMessage = typeof error === "string" ? error : error.message;
  const errorStack = typeof error === "string" ? "" : error.stack || "";

  // Suppress common stream cleanup errors
  const suppressPatterns = [
    /Premature close/i,
    /ERR_STREAM_PREMATURE_CLOSE/i,
    /write after end/i,
    /ERR_STREAM_WRITE_AFTER_END/i,
    /Cannot pipe\. Not readable/i,
    /ERR_STREAM_CANNOT_PIPE/i,
    /stream\.pipeline.*error/i,
  ];

  return suppressPatterns.some(
    (pattern) => pattern.test(errorMessage) || pattern.test(errorStack)
  );
}

// Check if error contains garbled binary data and trim if too long
function processSerializedError(error: Error | string): string | null {
  const errorMessage = typeof error === "string" ? error : error.message;
  const errorStack = typeof error === "string" ? "" : error.stack || "";

  // Look for serialized error patterns that contain bufferedData
  const serializedPatterns = [
    /Serialized Error.*\{.*bufferedData.*\}/i,
    /ERR_STREAM_PREMATURE_CLOSE.*bufferedData/i,
  ];

  const hasSerializedData = serializedPatterns.some(
    (pattern) => pattern.test(errorMessage) || pattern.test(errorStack)
  );

  if (hasSerializedData) {
    // If the error message is too long, trim it
    if (errorMessage.length > MAX_SERIALIZED_ERROR_LENGTH) {
      return `[TRIMMED] Serialized Error (${
        errorMessage.length
      } chars): ${errorMessage.substring(0, MAX_SERIALIZED_ERROR_LENGTH)}...`;
    }
    return null; // Don't suppress, just return null to indicate it was processed
  }

  return null; // Not a serialized error
}

// Override console.error to handle long serialized errors
console.error = (...args: unknown[]) => {
  const firstArg = args[0];

  // Check for long serialized errors
  if (firstArg instanceof Error || typeof firstArg === "string") {
    const processedError = processSerializedError(firstArg);
    if (processedError) {
      originalConsoleError(processedError);
      return;
    }
  }

  // Check if this is an expected stream error to suppress
  if (firstArg instanceof Error && shouldSuppressError(firstArg)) {
    // Suppress the error but log a brief message in debug mode
    if (process.env.DEBUG) {
      originalConsoleError(
        "[SUPPRESSED] Stream cleanup error:",
        firstArg.message
      );
    }
    return;
  }

  // Check if any argument contains suppressed error patterns
  const hasSuppressedError = args.some((arg) => {
    if (typeof arg === "string") {
      return shouldSuppressError(arg);
    }
    if (arg instanceof Error) {
      return shouldSuppressError(arg);
    }
    return false;
  });

  if (hasSuppressedError) {
    if (process.env.DEBUG) {
      originalConsoleError(
        "[SUPPRESSED] Stream cleanup error in console.error"
      );
    }
    return;
  }

  originalConsoleError(...args);
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  // Check if this is an expected stream error
  if (reason instanceof Error && shouldSuppressError(reason)) {
    if (process.env.DEBUG) {
      originalConsoleWarn(
        "[SUPPRESSED] Unhandled stream rejection:",
        reason.message
      );
    }
    return;
  }

  // Check for long serialized errors
  if (reason instanceof Error || typeof reason === "string") {
    const processedError = processSerializedError(reason);
    if (processedError) {
      originalConsoleError(
        "Unhandled Rejection at:",
        promise,
        "reason:",
        processedError
      );
      return;
    }
  }

  // For other unhandled rejections, log them normally
  originalConsoleError("Unhandled Rejection at:", promise, "reason:", reason);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  // Check if this is an expected stream error
  if (shouldSuppressError(error)) {
    if (process.env.DEBUG) {
      originalConsoleWarn(
        "[SUPPRESSED] Uncaught stream exception:",
        error.message
      );
    }
    return;
  }

  // Check for long serialized errors
  const processedError = processSerializedError(error);
  if (processedError) {
    originalConsoleError("Uncaught Exception:", processedError);
    return;
  }

  // For other uncaught exceptions, log them normally
  originalConsoleError("Uncaught Exception:", error);
});

// Export for potential use in tests
export { shouldSuppressError, processSerializedError };
