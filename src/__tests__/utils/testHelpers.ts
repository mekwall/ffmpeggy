import crypto from "crypto";
import {
  createWriteStream,
  createReadStream,
  ReadStream,
  WriteStream,
} from "fs";
import { mkdir, stat, unlink, rm, access } from "fs/promises";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";
import { FFmpeggy } from "#/FFmpeggy.js";
import { waitFiles } from "./waitFiles.js";
import { expect } from "vitest";
import type {
  FFmpeggyFinalSizes,
  FFmpeggyProgressEvent,
  FFprobeResult,
} from "#/types";
import { TEST_TIMEOUTS } from "./testTimeouts.js";

// Legacy exports for backward compatibility
export const TEST_TIMEOUT_MS = TEST_TIMEOUTS.TEST_OPERATION;
export const PROBE_TIMEOUT_MS = TEST_TIMEOUTS.PROBE_OPERATION;
export const HOOK_TIMEOUT_MS = TEST_TIMEOUTS.HOOK_OPERATION;

// Re-export TEST_TIMEOUTS for convenience
export { TEST_TIMEOUTS };

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
    "sample_mkv_640x360_h264_640x360_free.mkv"
  ), // Basic MKV video
  video_basic_mp4: path.join(
    SAMPLE_DIR,
    "big_buck_bunny_h264_aac_320x180_2aud_2vid_ccby.mp4"
  ), // Basic MP4 video (multi-stream)
  video_multi_stream: path.join(
    SAMPLE_DIR,
    "big_buck_bunny_h264_aac_320x180_2aud_2vid_ccby.mp4"
  ), // Multi-stream video (2 video, 2 audio)
  video_alt_mkv: path.join(
    SAMPLE_DIR,
    "sample_ocean_h264_aac_960x400_free.mkv"
  ), // Alternate MKV video
  audio_basic_mp3: path.join(SAMPLE_DIR, "sample_mp3_free.mp3"), // Basic MP3 audio
  audio_basic_ogg: path.join(SAMPLE_DIR, "sample_vorbis_free.ogg"), // Basic OGG audio
  subtitle_vtt: path.join(
    SAMPLE_DIR,
    "big_buck_bunny_subtitles_en_subs_ccby.vtt"
  ), // VTT subtitle
  audio_raw_pcm_s16le: path.join(
    SAMPLE_DIR,
    "sample_pcm_s16le_no_duration.raw"
  ), // Raw PCM audio, no duration
} as const;

// Utility functions
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Enhanced file waiting function with retries and better error handling
export async function waitForFileExists(
  filePath: string,
  maxRetries = 10,
  retryDelay = 500
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await access(filePath);
      return; // File exists
    } catch {
      if (i === maxRetries - 1) {
        throw new Error(
          `File ${filePath} does not exist after ${maxRetries} retries`
        );
      }
      await wait(retryDelay);
    }
  }
}

// Enhanced file size checking with retries
export async function waitForFileSize(
  filePath: string,
  minSize = 1,
  maxRetries = 10,
  retryDelay = 500
): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const stats = await stat(filePath);
      if (stats.size >= minSize) {
        return stats.size;
      }
      if (i === maxRetries - 1) {
        throw new Error(
          `File ${filePath} size (${stats.size}) is less than minimum expected size (${minSize})`
        );
      }
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
    }
    await wait(retryDelay);
  }
  throw new Error(
    `Failed to check file size for ${filePath} after ${maxRetries} retries`
  );
}

// Enhanced stream cleanup function
interface DestroyableStream {
  destroy(): void;
  once(event: string, listener: () => void): void;
  removeListener(event: string, listener: () => void): void;
  on(event: "error", listener: (err: Error) => void): void;
  on(event: "close" | "finish" | "end", listener: () => void): void;
  off(event: "error", listener: (err: Error) => void): void;
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
        // Create cleanup function that will be called in all cases
        let cleanupCalled = false;
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

        // Handle stream errors during cleanup
        const onError = (err: Error) => {
          // Suppress expected stream cleanup errors
          const errorMessage = err.message || "";
          const isExpectedError =
            /premature close|write after end|cannot pipe|stream.*error/i.test(
              errorMessage
            );

          if (process.env.DEBUG && !isExpectedError) {
            console.warn("[Stream cleanup] Unexpected error:", err.message);
          }
          cleanup();
        };

        const onClose = () => cleanup();
        const onFinish = () => cleanup();
        const onEnd = () => cleanup();

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
        setTimeout(() => {
          try {
            stream.destroy();
          } catch {
            // Ignore destroy errors
          }

          // Ensure cleanup is called even if destroy doesn't trigger events
          setTimeout(cleanup, 50);
        }, 100);
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
    testType: "unit" | "async" | "multiple" | "events" | "validation"
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

        // Retry file deletion with exponential backoff for CI environments
        for (
          let attempt = 0;
          attempt < TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES;
          attempt++
        ) {
          try {
            await Promise.allSettled(this.tempFiles.map(unlink));
            break; // Success, exit retry loop
          } catch (error) {
            if (attempt === TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES - 1) {
              // Last attempt failed, log but don't throw
              console.warn(
                `Failed to delete temp files after ${TEST_TIMEOUTS.CLEANUP.FILE_DELETION_RETRIES} attempts:`,
                error
              );
            } else {
              // Wait before retry with exponential backoff
              await wait(
                Math.pow(2, attempt) * TEST_TIMEOUTS.CLEANUP.RETRY_DELAY_BASE
              );
            }
          }
        }
      } catch (error) {
        // If waitFiles fails, try to unlink anyway
        console.warn("waitFiles failed, attempting direct deletion:", error);
        await Promise.allSettled(this.tempFiles.map(unlink));
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
        if (attempt === TEST_TIMEOUTS.CLEANUP.DIR_DELETION_RETRIES - 1) {
          // Last attempt failed, log but don't throw
          console.warn(
            `Failed to remove temp directory after ${TEST_TIMEOUTS.CLEANUP.DIR_DELETION_RETRIES} attempts:`,
            error
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
    const timestamp = new Date().getTime();
    const randomBytes = crypto.randomBytes(8).toString("hex");
    const tempFilename = path.join(
      this.tempDir,
      `temp-${timestamp}-${randomBytes}${extension}`
    );

    this.tempFiles.push(tempFilename);
    return tempFilename;
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
    await cleanupStreams(...this.streams);
    this.streams = [];
  }

  async cleanupAll(): Promise<void> {
    await this.cleanupStreams();
    await this.cleanup();
  }
}

// FFmpeggy test helpers
export class FFmpeggyTestHelpers {
  static createBasicFFmpeggy(): FFmpeggy {
    return new FFmpeggy();
  }

  static createFFmpeggyWithOptions(
    options: ConstructorParameters<typeof FFmpeggy>[0]
  ): FFmpeggy {
    return new FFmpeggy(options);
  }

  static createStreamingFFmpeggy(
    inputStream: ReadStream,
    outputStream: WriteStream,
    inputOptions: string[] = [],
    outputOptions: string[] = []
  ): FFmpeggy {
    return new FFmpeggy({
      autorun: true,
      input: inputStream,
      inputOptions,
      output: outputStream,
      outputOptions,
    });
  }

  static createFileToFileFFmpeggy(
    inputFile: string,
    outputFile: string,
    outputOptions: string[] = []
  ): FFmpeggy {
    return new FFmpeggy({
      input: inputFile,
      output: outputFile,
      outputOptions,
    });
  }

  static createPipedFFmpeggy(
    inputFile: string,
    outputOptions: string[] = []
  ): FFmpeggy {
    return new FFmpeggy({
      autorun: true,
      input: inputFile,
      pipe: true,
      outputOptions,
    });
  }

  static async runAndWait(
    ffmpeggy: FFmpeggy
  ): Promise<{ file?: string; sizes?: FFmpeggyFinalSizes }> {
    ffmpeggy.triggerAutorun();
    return await ffmpeggy.done();
  }

  static async runWithEvents(
    ffmpeggy: FFmpeggy,
    eventHandlers: {
      onDone?: (
        result:
          | { file?: string; sizes?: FFmpeggyFinalSizes; outputIndex?: number }
          | Array<{
              file?: string;
              sizes?: FFmpeggyFinalSizes;
              outputIndex?: number;
            }>
      ) => void;
      onError?: (error: Error) => void;
      onProgress?: (progress: FFmpeggyProgressEvent) => void;
      onWriting?: (
        info:
          | { file: string; outputIndex: number }
          | Array<{ file: string; outputIndex: number }>
      ) => void;
      onExit?: (code?: number | null, error?: Error) => void;
    } = {}
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
      ffmpeggy.on("done", () => resolve());
      ffmpeggy.on("error", (error) => reject(error));

      ffmpeggy.run().catch(reject);
    });
  }
}

// Common test assertions
export class TestAssertions {
  static expectFFmpeggyInstance(ffmpeggy: FFmpeggy): void {
    expect(ffmpeggy).toBeInstanceOf(FFmpeggy);
  }

  static expectConstructorOptions(
    ffmpeggy: FFmpeggy,
    expectedOptions: {
      cwd?: string;
      overwriteExisting?: boolean;
      output?: string;
      hideBanner?: boolean;
      globalOptions?: string[];
    }
  ): void {
    if (expectedOptions.cwd !== undefined) {
      expect(ffmpeggy.cwd).toBe(expectedOptions.cwd);
    }
    if (expectedOptions.overwriteExisting !== undefined) {
      expect(ffmpeggy.overwriteExisting).toBe(
        expectedOptions.overwriteExisting
      );
    }
    if (expectedOptions.output !== undefined) {
      expect(ffmpeggy.output).toBe(expectedOptions.output);
    }
    if (expectedOptions.hideBanner !== undefined) {
      expect(ffmpeggy.hideBanner).toBe(expectedOptions.hideBanner);
    }
    if (expectedOptions.globalOptions) {
      expectedOptions.globalOptions.forEach((option) => {
        expect(ffmpeggy.globalOptions.includes(option)).toBe(true);
      });
    }
  }

  static expectFileExists(filePath: string): Promise<void> {
    return waitForFileExists(filePath);
  }

  static expectFileSize(filePath: string, minSize: number): Promise<number> {
    return waitForFileSize(filePath, minSize);
  }

  static expectProbeResult(result: FFprobeResult): void {
    expect(result).toBeDefined();
    expect(result.format).toBeDefined();
    expect(result.format.nb_streams).toBeGreaterThan(0);
    expect(result.format.duration).toBeDefined();
    expect(result.streams.length).toBeGreaterThan(0);
    // Check that at least one stream has a valid codec
    const hasValidCodec = result.streams.some(
      (stream) => stream.codec_name && stream.codec_name.length > 0
    );
    expect(hasValidCodec).toBe(true);
  }
}
