import crypto from "node:crypto";
import {
  createWriteStream,
  createReadStream,
  ReadStream,
  WriteStream,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { mkdir, stat, unlink, rm, access } from "node:fs/promises";
import path from "node:path";

import ffmpegStatic from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";
import { FFmpeggy } from "#/FFmpeggy";
import type { FFmpeggyFinalSizes, FFmpeggyProgressEvent } from "#/types";

import { waitFiles } from "./waitFiles";
import { TEST_TIMEOUTS, isCI, isWindows } from "./testTimeouts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Legacy exports for backward compatibility
export const TEST_TIMEOUT_MS = TEST_TIMEOUTS.TEST_OPERATION;
export const PROBE_TIMEOUT_MS = TEST_TIMEOUTS.PROBE_OPERATION;
export const HOOK_TIMEOUT_MS = TEST_TIMEOUTS.HOOK_OPERATION;

// Re-export TEST_TIMEOUTS for convenience

// FFmpeg binary validation
const ffmpegBin = ffmpegStatic as unknown as string;
if (!ffmpegBin) {
  throw new Error("ffmpeg not found");
}

// Configure FFmpeggy with binaries
export function configureFFmpeggy(): void {
  FFmpeggy.DefaultConfig = {
    ...FFmpeggy.DefaultConfig,
    overwriteExisting: true,
    ffprobeBin: (ffprobeBin as unknown as string) || "",
    ffmpegBin: ffmpegBin || "",
  };
}

// Sample file paths
export const SAMPLE_DIR = path.resolve(__dirname, "../samples");
export const SAMPLE_FILES = {
  video_basic_mkv: path.join(
    SAMPLE_DIR,
    "sample_mkv_640x360_h264_640x360_free.mkv",
  ), // Basic MKV video
  video_basic_mp4: path.join(
    SAMPLE_DIR,
    "big_buck_bunny_h264_aac_320x180_2aud_2vid_ccby.mp4",
  ), // Basic MP4 video (multi-stream)
  video_multi_stream: path.join(
    SAMPLE_DIR,
    "big_buck_bunny_h264_aac_320x180_2aud_2vid_ccby.mp4",
  ), // Multi-stream video (2 video, 2 audio)
  video_alt_mkv: path.join(
    SAMPLE_DIR,
    "sample_ocean_h264_aac_960x400_free.mkv",
  ), // Alternate MKV video
  audio_basic_mp3: path.join(SAMPLE_DIR, "sample_mp3_free.mp3"), // Basic MP3 audio
  audio_basic_ogg: path.join(SAMPLE_DIR, "sample_vorbis_free.ogg"), // Basic OGG audio
  subtitle_vtt: path.join(
    SAMPLE_DIR,
    "big_buck_bunny_subtitles_en_subs_ccby.vtt",
  ), // VTT subtitle
  audio_raw_pcm_s16le: path.join(
    SAMPLE_DIR,
    "sample_pcm_s16le_no_duration.raw",
  ), // Raw PCM audio, no duration
} as const;

// Utility functions
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Enhanced file waiting function with retries and better error handling
export async function waitForFileExists(
  filePath: string,
  maxRetries = isCI ? 30 : 10,
  retryDelay = isCI ? 1000 : 500,
): Promise<void> {
  const fs = await import("node:fs/promises");

  for (let index = 0; index < maxRetries; index++) {
    try {
      // Use stat instead of access to get more information
      const stats = await fs.stat(filePath);

      // Check if file has actual content (not just created)
      if (stats.size > 0) {
        return; // File exists and has content
      }

      // File exists but is empty, wait a bit more
      if (index < maxRetries - 1) {
        await wait(retryDelay);
      }
    } catch {
      // File doesn't exist yet, wait and retry
      if (index < maxRetries - 1) {
        await wait(retryDelay);
      } else {
        throw new Error(
          `File ${filePath} does not exist after ${maxRetries} retries`,
        );
      }
    }
  }

  // If we get here, the file exists but is empty after all retries
  throw new Error(
    `File ${filePath} exists but is empty after ${maxRetries} retries`,
  );
}

// Enhanced file size checking with retries
export async function waitForFileSize(
  filePath: string,
  minSize = 1,
  maxRetries = isCI ? 30 : 10,
  retryDelay = isCI ? 1000 : 500,
): Promise<number> {
  for (let index = 0; index < maxRetries; index++) {
    try {
      const stats = await stat(filePath);
      if (stats.size >= minSize) {
        return stats.size;
      }
      if (index === maxRetries - 1) {
        throw new Error(
          `File ${filePath} size (${stats.size}) is less than minimum expected size (${minSize})`,
        );
      }
    } catch (error) {
      if (index === maxRetries - 1) {
        throw error;
      }
    }
    await wait(retryDelay);
  }
  throw new Error(
    `Failed to check file size for ${filePath} after ${maxRetries} retries`,
  );
}

// Enhanced stream cleanup function
interface DestroyableStream {
  destroy(): void;
  once(event: string, listener: () => void): void;
  removeListener(event: string, listener: () => void): void;
  on(event: "error", listener: (error: Error) => void): void;
  on(event: "close" | "finish" | "end", listener: () => void): void;
  off(event: "error", listener: (error: Error) => void): void;
  off(event: "close" | "finish" | "end", listener: () => void): void;
  end(): void;
  writable?: boolean;
  readable?: boolean;
  setMaxListeners?(n: number): void;
}

function isDestroyableStream(stream: unknown): stream is DestroyableStream {
  return (
    stream !== null &&
    stream !== undefined &&
    typeof (stream as DestroyableStream).destroy === "function"
  );
}

// Function to increase max listeners for streams to prevent warnings during testing
function increaseMaxListeners(stream: DestroyableStream): void {
  if (stream.setMaxListeners) {
    // Increase max listeners to prevent warnings during testing
    // This is safe for test environments where we know we'll clean up properly
    stream.setMaxListeners(50);
  }
}

export async function cleanupStreams(
  ...streams: (
    | NodeJS.ReadableStream
    | NodeJS.WritableStream
    | null
    | undefined
  )[]
): Promise<void> {
  const cleanupPromises = streams.map((stream) => {
    return new Promise<void>((resolve) => {
      if (isDestroyableStream(stream)) {
        const onClose = () => cleanup();
        const onFinish = () => cleanup();
        const onEnd = () => cleanup();

        const cleanup = () => {
          if (cleanupCalled) return;
          cleanupCalled = true;

          try {
            // Remove all event listeners we added
            stream.off("error", onError);
            stream.off("close", onClose);
            stream.off("finish", onFinish);
            stream.off("end", onEnd);
          } catch {
            // Ignore errors when removing listeners
          }

          resolve();
        };

        // Create cleanup function that will be called in all cases
        let cleanupCalled = false;

        // Define all event handlers first
        const onError = (error: Error) => {
          // Suppress expected stream cleanup errors
          const errorMessage = error.message || "";
          const isExpectedError =
            /premature close|write after end|cannot pipe|stream.*error/i.test(
              errorMessage,
            );

          if (process.env.DEBUG && !isExpectedError) {
            console.warn("[Stream cleanup] Unexpected error:", error.message);
          }
          cleanup();
        };

        // Add error handler first
        stream.on("error", onError);
        stream.on("close", onClose);
        stream.on("finish", onFinish);
        stream.on("end", onEnd);

        // Graceful shutdown for writable streams
        if (stream.writable !== false) {
          try {
            stream.end();
          } catch {
            // Ignore end errors
          }
        }

        // Destroy the stream after a short delay to allow graceful shutdown
        // Use longer delays on Windows due to file handle release timing
        const destroyDelay = isCI ? 50 : isWindows ? 200 : 100;
        const finalCleanupDelay = isCI ? 25 : isWindows ? 100 : 50;

        setTimeout(() => {
          try {
            stream.destroy();
          } catch {
            // Ignore destroy errors
          }

          // Ensure cleanup is called even if destroy doesn't trigger events
          setTimeout(cleanup, finalCleanupDelay);
        }, destroyDelay);
      } else {
        resolve();
      }
    });
  });

  await Promise.all(cleanupPromises);
}

// Test file management
export class TestFileManager {
  private tempFiles: string[] = [];
  private tempDir: string;
  private streams: Array<ReadStream | WriteStream> = [];

  constructor(
    testType: "unit" | "async" | "multiple" | "events" | "validation",
  ) {
    this.tempDir = path.resolve(SAMPLE_DIR, ".temp", testType);
  }

  async setup(): Promise<void> {
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch {
      // Ignore if directory already exists
    }
  }

  async cleanup(): Promise<void> {
    // Longer wait in CI environments to ensure all processes are done
    await wait(TEST_TIMEOUTS.CLEANUP.WAIT_TIME);

    if (this.tempFiles.length > 0) {
      try {
        // Wait for files to be available for deletion
        await waitFiles(this.tempFiles);
      } catch (error) {
        // If waitFiles fails, log but continue with cleanup
        console.warn(
          "waitFiles failed, proceeding with direct deletion:",
          error,
        );
      }

      // Retry file deletion with exponential backoff for CI environments
      for (
        let attempt = 0;
        attempt < TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES;
        attempt++
      ) {
        try {
          // Delete files individually to handle partial failures
          const deletionResults = await Promise.allSettled(
            this.tempFiles.map(async (file) => {
              try {
                // Check if file exists before attempting deletion
                try {
                  await access(file);
                } catch {
                  // File doesn't exist, consider this a successful "deletion"
                  return { file, success: true, alreadyDeleted: true };
                }

                await unlink(file);
                return { file, success: true, alreadyDeleted: false };
              } catch (error) {
                // Handle ENOENT errors gracefully (file already deleted)
                if (
                  error &&
                  typeof error === "object" &&
                  "code" in error &&
                  error.code === "ENOENT"
                ) {
                  return { file, success: true, alreadyDeleted: true };
                }

                // Handle EBUSY errors on Windows - these are common and often resolve with retries
                if (
                  error &&
                  typeof error === "object" &&
                  "code" in error &&
                  error.code === "EBUSY"
                ) {
                  return { file, success: false, error, isBusy: true };
                }

                return { file, success: false, error };
              }
            }),
          );

          // Check if all deletions succeeded
          const failedDeletions = deletionResults
            .map((result, index) => ({ result, file: this.tempFiles[index] }))
            .filter(
              ({ result }) =>
                result.status === "rejected" ||
                (result.status === "fulfilled" && !result.value.success),
            );

          if (failedDeletions.length === 0) {
            break; // All files deleted successfully
          }

          // Check if we only have EBUSY errors (which are often transient on Windows)
          const onlyBusyErrors = failedDeletions.every(({ result }) => {
            if (result.status === "rejected") return false;
            return result.value.isBusy === true;
          });

          if (attempt === TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES - 1) {
            // Last attempt failed, log detailed failure information
            console.warn(
              `Failed to delete ${failedDeletions.length} temp files after ${TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES} attempts:`,
            );
            for (const { file, result } of failedDeletions) {
              const error =
                result.status === "rejected"
                  ? result.reason
                  : result.value.error;
              console.warn(`  - ${file}: ${error}`);
            }
          } else {
            // Wait before retry with exponential backoff
            // Use longer delays for EBUSY errors on Windows
            const baseDelay = onlyBusyErrors
              ? Math.max(TEST_TIMEOUTS.CLEANUP.RETRY_DELAY_BASE * 1.5, 1000)
              : TEST_TIMEOUTS.CLEANUP.RETRY_DELAY_BASE;

            // Use exponential backoff but cap the maximum delay to prevent timeouts
            const maxDelay = 8000; // Cap at 8 seconds
            const delay = Math.min(
              Math.pow(1.5, attempt) * baseDelay,
              maxDelay,
            );
            console.warn(
              `Retrying file deletion in ${Math.round(delay)}ms (attempt ${
                attempt + 1
              }/${TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES})`,
            );
            await wait(delay);
          }
        } catch (error) {
          if (attempt === TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES - 1) {
            console.warn(
              `Failed to delete temp files after ${TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES} attempts:`,
              error,
            );
          } else {
            const delay = Math.min(
              Math.pow(1.5, attempt) * TEST_TIMEOUTS.CLEANUP.RETRY_DELAY_BASE,
              8000,
            );
            console.warn(
              `Retrying file deletion in ${Math.round(delay)}ms (attempt ${
                attempt + 1
              }/${TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES})`,
            );
            await wait(delay);
          }
        }
      }
    }

    // Clean up streams if any
    if (this.streams.length > 0) {
      try {
        await this.cleanupStreams();
      } catch (error) {
        console.warn("Failed to cleanup streams:", error);
      }
    }

    // Remove temp directory with retry logic for CI
    for (
      let attempt = 0;
      attempt < TEST_TIMEOUTS.CLEANUP.DIR_DELETION_RETRIES;
      attempt++
    ) {
      try {
        await rm(this.tempDir, {
          recursive: true,
          force: true,
        });
        break; // Success, exit retry loop
      } catch (error) {
        // Handle EBUSY errors on Windows more gracefully
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "EBUSY"
        ) {
          console.warn(
            `Directory busy, retrying removal in ${
              TEST_TIMEOUTS.CLEANUP.RETRY_DELAY_BASE
            }ms (attempt ${attempt + 1}/${
              TEST_TIMEOUTS.CLEANUP.DIR_DELETION_RETRIES
            })`,
          );
          await wait(TEST_TIMEOUTS.CLEANUP.RETRY_DELAY_BASE);
          continue;
        }

        if (attempt === TEST_TIMEOUTS.CLEANUP.DIR_DELETION_RETRIES - 1) {
          // Last attempt failed, log but don't throw
          console.warn(
            `Failed to remove temp directory after ${TEST_TIMEOUTS.CLEANUP.DIR_DELETION_RETRIES} attempts:`,
            error,
          );
        } else {
          // Wait before retry
          await wait(TEST_TIMEOUTS.CLEANUP.RETRY_DELAY_BASE);
        }
      }
    }
  }

  createTempFile(extension: string): string {
    // Ensure the extension starts with a dot
    if (extension[0] !== ".") {
      extension = "." + extension;
    }

    // Generate a random file name using current timestamp and random bytes
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString("hex");
    const temporaryFilename = path.join(
      this.tempDir,
      `temp-${timestamp}-${randomBytes}${extension}`,
    );

    this.tempFiles.push(temporaryFilename);
    return temporaryFilename;
  }

  getTempFiles(): string[] {
    return [...this.tempFiles];
  }

  createInputStream(filePath: string): ReadStream {
    const stream = createReadStream(filePath);
    if (isDestroyableStream(stream)) {
      increaseMaxListeners(stream);
    }
    this.streams.push(stream);
    return stream;
  }

  createOutputStream(filePath: string): WriteStream {
    const stream = createWriteStream(filePath);
    if (isDestroyableStream(stream)) {
      increaseMaxListeners(stream);
    }
    this.streams.push(stream);
    return stream;
  }

  async cleanupStreams(): Promise<void> {
    if (this.streams.length === 0) return;

    try {
      await cleanupStreams(...this.streams);
      this.streams = [];

      // Add a small delay after stream cleanup to allow file handles to be released
      // This is especially important on Windows where file handles can remain open briefly
      await wait(100);
    } catch (error) {
      console.warn("Failed to cleanup streams:", error);
      this.streams = [];
    }
  }

  async cleanupAll(): Promise<void> {
    await this.cleanupStreams();
    await this.cleanup();
  }
}

// FFmpeggy test helpers
export const FFmpeggyTestHelpers = {
  createBasicFFmpeggy(): FFmpeggy {
    return new FFmpeggy();
  },

  createFFmpeggyWithOptions(
    options: ConstructorParameters<typeof FFmpeggy>[0],
  ): FFmpeggy {
    return new FFmpeggy(options);
  },

  createStreamingFFmpeggy(
    inputStream: ReadStream,
    outputStream: WriteStream,
    inputOptions: string[] = [],
    outputOptions: string[] = [],
  ): FFmpeggy {
    return new FFmpeggy({
      autorun: true,
      input: inputStream,
      inputOptions,
      output: outputStream,
      outputOptions,
    });
  },

  createFileToFileFFmpeggy(
    inputFile: string,
    outputFile: string,
    outputOptions: string[] = [],
  ): FFmpeggy {
    return new FFmpeggy({
      input: inputFile,
      output: outputFile,
      outputOptions,
    });
  },

  createPipedFFmpeggy(
    inputFile: string,
    outputOptions: string[] = [],
  ): FFmpeggy {
    return new FFmpeggy({
      autorun: true,
      input: inputFile,
      pipe: true,
      outputOptions,
    });
  },

  async runAndWait(
    ffmpeggy: FFmpeggy,
  ): Promise<{ file?: string; sizes?: FFmpeggyFinalSizes }> {
    return new Promise<{ file?: string; sizes?: FFmpeggyFinalSizes }>(
      (resolve, reject) => {
        let result: { file?: string; sizes?: FFmpeggyFinalSizes } | undefined;
        let hasResolved = false;

        // Listen for the done event to get the result
        ffmpeggy.on("done", (doneResult) => {
          if (hasResolved) return; // Prevent multiple resolutions

          // Handle both single result and array of results (for tee muxer)
          result =
            Array.isArray(doneResult) && doneResult.length > 0
              ? doneResult[0] // For tee muxer with multiple outputs, use the first result
              : doneResult; // Single result
        });

        // Listen for errors
        ffmpeggy.on("error", (error) => {
          if (hasResolved) return;
          hasResolved = true;
          reject(error);
        });

        // Listen for exit to ensure process is fully complete
        ffmpeggy.on("exit", async (code, error) => {
          if (hasResolved) return;
          hasResolved = true;

          if (error) {
            reject(error);
            return;
          }

          // Handle undefined exit codes more gracefully
          // This can happen in some edge cases, especially with streaming operations
          if (code !== 0 && code !== undefined && code !== null) {
            reject(new Error(`FFmpeg process exited with code ${code}`));
            return;
          }

          // If we have a result, consider it successful even with undefined exit code
          if (result) {
            // If there's a file in the result, wait for it to be actually available on disk
            if (result.file) {
              try {
                await waitForFileExists(result.file);
              } catch (error) {
                reject(
                  new Error(
                    `Output file ${result.file} not available after FFmpeg completion: ${error}`,
                  ),
                );
                return;
              }
            }
            resolve(result);
            return;
          }

          // If no result but exit code is 0 or undefined, still resolve
          // This can happen with streaming operations where no file is produced
          if (code === 0 || code === undefined || code === null) {
            resolve({});
            return;
          }

          // Only reject if we have a non-zero exit code and no result
          reject(new Error("FFmpeg completed but no result was received"));
        });

        // Start the FFmpeg process
        ffmpeggy.triggerAutorun();
      },
    );
  },

  async runWithEvents(
    ffmpeggy: FFmpeggy,
    eventHandlers: {
      onDone?: (
        result:
          | { file?: string; sizes?: FFmpeggyFinalSizes; outputIndex?: number }
          | Array<{
              file?: string;
              sizes?: FFmpeggyFinalSizes;
              outputIndex?: number;
            }>,
      ) => void;
      onError?: (error: Error) => void;
      onProgress?: (progress: FFmpeggyProgressEvent) => void;
      onWriting?: (
        info:
          | { file: string; outputIndex: number }
          | Array<{ file: string; outputIndex: number }>,
      ) => void;
      onExit?: (code?: number | null, error?: Error) => void;
    } = {},
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (eventHandlers.onDone) {
        ffmpeggy.on("done", eventHandlers.onDone);
      }

      if (eventHandlers.onError) {
        ffmpeggy.on("error", eventHandlers.onError);
      }

      if (eventHandlers.onProgress) {
        ffmpeggy.on("progress", eventHandlers.onProgress);
      }

      if (eventHandlers.onWriting) {
        ffmpeggy.on("writing", eventHandlers.onWriting);
      }

      if (eventHandlers.onExit) {
        ffmpeggy.on("exit", eventHandlers.onExit);
      }

      // Default handlers for resolve/reject
      ffmpeggy.on("done", async () => {
        // Wait for the FFmpeg process to fully exit before resolving
        try {
          await ffmpeggy.exit();
        } catch (error) {
          // Ignore exit errors, but log them in debug mode
          if (process.env.DEBUG) {
            console.warn("FFmpeg exit error (non-critical):", error);
          }
        }
        resolve();
      });
      ffmpeggy.on("error", (error) => reject(error));

      ffmpeggy.run().catch(reject);
    });
  },

  /**
   * Robust streaming test helper that handles common flakiness issues
   * Specifically designed for tests that stream from one format to another
   */
  async runStreamingTest(
    ffmpeggy: FFmpeggy,
    outputFile: string,
    options: {
      minFileSize?: number;
      maxRetries?: number;
      retryDelay?: number;
    } = {},
  ): Promise<{ fileSize: number }> {
    const { minFileSize = 1, maxRetries = 3, retryDelay = 1000 } = options;

    return retryTest(
      async () => {
        return new Promise<{ fileSize: number }>((resolve, reject) => {
          let hasResolved = false;

          const cleanup = () => {
            if (hasResolved) return;
            hasResolved = true;
          };

          ffmpeggy.on("done", async () => {
            try {
              cleanup();
              // Wait for file to exist and have proper size
              await waitForFileExists(outputFile);
              const fileSize = await waitForFileSize(outputFile, minFileSize);
              resolve({ fileSize });
            } catch (error) {
              reject(error);
            }
          });

          ffmpeggy.on("error", (error) => {
            cleanup();
            reject(error);
          });

          ffmpeggy.on("exit", async (code, error) => {
            if (hasResolved) return;

            // Handle undefined exit codes gracefully
            if (error) {
              cleanup();
              reject(error);
              return;
            }

            // Accept 0, undefined, or null exit codes as success
            if (code === 0 || code === undefined || code === null) {
              try {
                await waitForFileExists(outputFile);
                const fileSize = await waitForFileSize(outputFile, minFileSize);
                cleanup();
                resolve({ fileSize });
              } catch (fileError) {
                cleanup();
                reject(fileError);
              }
            } else {
              cleanup();
              reject(new Error(`FFmpeg process exited with code ${code}`));
            }
          });

          // Start the process
          ffmpeggy.run().catch((error) => {
            cleanup();
            reject(error);
          });
        });
      },
      maxRetries,
      retryDelay,
    );
  },
};

/**
 * Retry mechanism for flaky tests
 * Based on patterns from Playwright and TestNG retry implementations
 */
export async function retryTest<T>(
  testFunction: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await testFunction();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        // Final attempt failed, throw the error
        console.error(
          `Test failed after ${maxRetries} attempts. Final error:`,
          lastError.message,
        );
        throw lastError;
      }

      // Use exponential backoff: 1s, 2s, 4s, etc.
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);

      // Log retry attempt for debugging
      console.warn(
        `Test attempt ${attempt}/${maxRetries} failed, retrying in ${delayMs}ms...`,
      );
      console.warn(`Error: ${lastError.message}`);

      // Wait before retry
      await wait(delayMs);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError!;
}

/**
 * Retry mechanism specifically for file existence checks
 * This is useful for tests that fail due to file system timing issues
 */
export async function retryFileTest<T>(
  testFunction: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await testFunction();
    } catch (error) {
      lastError = error as Error;

      // Check if this is a file-related error that might be transient
      const isFileError =
        lastError.message.includes("does not exist") ||
        lastError.message.includes("ENOENT") ||
        lastError.message.includes("EBUSY");

      if (attempt === maxRetries || !isFileError) {
        // Final attempt failed or not a file error, throw the error
        if (attempt === maxRetries) {
          console.error(
            `File test failed after ${maxRetries} attempts. Final error:`,
            lastError.message,
          );
        }
        throw lastError;
      }

      // Use exponential backoff for file errors
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);

      // Log retry attempt for debugging
      console.warn(
        `File test attempt ${attempt}/${maxRetries} failed (file error), retrying in ${delayMs}ms...`,
      );
      console.warn(`Error: ${lastError.message}`);

      // Wait before retry
      await wait(delayMs);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError!;
}

export { TEST_TIMEOUTS } from "./testTimeouts.js";
