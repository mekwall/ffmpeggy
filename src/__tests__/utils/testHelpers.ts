import crypto from "crypto";
import {
  createWriteStream,
  createReadStream,
  ReadStream,
  WriteStream,
} from "fs";
import { mkdir, stat, unlink, rm, access } from "fs/promises";
import path from "path";
import ffmpegBin from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";
import { FFmpeggy, FFmpeggyProgressEvent } from "../../FFmpeggy";
import { FFmpeggyFinalSizes } from "../../types/FFmpeggyProgress";
import { FFprobeResult } from "../../types/probeTypes";
import { waitFiles } from "./waitFiles";
import { expect } from "vitest";

// Test timeout constants for better readability and maintainability
export const TEST_TIMEOUT_MS = 60000; // 60 seconds for most test operations
export const PROBE_TIMEOUT_MS = 30000; // 30 seconds for probe operations

// FFmpeg binary validation
if (!ffmpegBin) {
  throw new Error("ffmpeg not found");
}

// Configure FFmpeggy with binaries
export function configureFFmpeggy(): void {
  FFmpeggy.DefaultConfig = {
    ...FFmpeggy.DefaultConfig,
    overwriteExisting: true,
    ffprobeBin: ffprobeBin || "",
    ffmpegBin: ffmpegBin || "",
  };
}

// Sample file paths
export const SAMPLE_DIR = path.join(__dirname, "../samples/");
export const SAMPLE_FILES = {
  mkv: path.join(SAMPLE_DIR, "bunny1.mkv"),
  mp4: path.join(SAMPLE_DIR, "bunny2.mp4"),
  mp3: path.join(SAMPLE_DIR, "audio.mp3"),
} as const;

// Utility functions
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Enhanced file waiting function with retries and better error handling
export async function waitForFileExists(
  filePath: string,
  maxRetries = 10,
  retryDelay = 500,
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await access(filePath);
      return; // File exists
    } catch {
      if (i === maxRetries - 1) {
        throw new Error(
          `File ${filePath} does not exist after ${maxRetries} retries`,
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
  retryDelay = 500,
): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const stats = await stat(filePath);
      if (stats.size >= minSize) {
        return stats.size;
      }
      if (i === maxRetries - 1) {
        throw new Error(
          `File ${filePath} size (${stats.size}) is less than minimum expected size (${minSize})`,
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
    `Failed to check file size for ${filePath} after ${maxRetries} retries`,
  );
}

// Enhanced stream cleanup function
interface DestroyableStream {
  destroy(): void;
  once(event: string, listener: () => void): void;
  removeListener(event: string, listener: () => void): void;
}

function isDestroyableStream(stream: unknown): stream is DestroyableStream {
  return (
    stream !== null &&
    stream !== undefined &&
    typeof (stream as DestroyableStream).destroy === "function"
  );
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
        // Handle stream errors during cleanup
        const onError = () => resolve();
        stream.once("error", onError);
        stream.destroy();
        // Resolve after a short delay to allow cleanup
        setTimeout(() => {
          stream.removeListener("error", onError);
          resolve();
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

  constructor(testType: "unit" | "async" | "events") {
    this.tempDir = path.join(SAMPLE_DIR, `.temp/${testType}`);
  }

  async setup(): Promise<void> {
    try {
      await mkdir(this.tempDir, { recursive: true });
    } catch {
      // Ignore if directory already exists
    }
  }

  async cleanup(): Promise<void> {
    // Clean up temp files
    await wait(500); // Longer wait to ensure all processes are done

    if (this.tempFiles.length > 0) {
      try {
        await waitFiles(this.tempFiles);
        await Promise.allSettled(this.tempFiles.map(unlink));
      } catch {
        // If waitFiles fails, try to unlink anyway
        await Promise.allSettled(this.tempFiles.map(unlink));
      }
    }

    try {
      await rm(this.tempDir, {
        recursive: true,
        force: true,
      });
    } catch {
      // Ignore cleanup errors
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
      `temp-${timestamp}-${randomBytes}${extension}`,
    );

    this.tempFiles.push(tempFilename);
    return tempFilename;
  }

  getTempFiles(): string[] {
    return [...this.tempFiles];
  }
}

// FFmpeggy test helpers
export class FFmpeggyTestHelpers {
  static createBasicFFmpeggy(): FFmpeggy {
    return new FFmpeggy();
  }

  static createFFmpeggyWithOptions(
    options: ConstructorParameters<typeof FFmpeggy>[0],
  ): FFmpeggy {
    return new FFmpeggy(options);
  }

  static createStreamingFFmpeggy(
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
  }

  static createFileToFileFFmpeggy(
    inputFile: string,
    outputFile: string,
    outputOptions: string[] = [],
  ): FFmpeggy {
    return new FFmpeggy({
      input: inputFile,
      output: outputFile,
      outputOptions,
    });
  }

  static createPipedFFmpeggy(
    inputFile: string,
    outputOptions: string[] = [],
  ): FFmpeggy {
    return new FFmpeggy({
      autorun: true,
      input: inputFile,
      pipe: true,
      outputOptions,
    });
  }

  static async runAndWait(
    ffmpeggy: FFmpeggy,
  ): Promise<{ file?: string; sizes?: FFmpeggyFinalSizes }> {
    ffmpeggy.triggerAutorun();
    return await ffmpeggy.done();
  }

  static async runWithEvents(
    ffmpeggy: FFmpeggy,
    eventHandlers: {
      onDone?: (file?: string, sizes?: FFmpeggyFinalSizes) => void;
      onError?: (error: Error) => void;
      onProgress?: (progress: FFmpeggyProgressEvent) => void;
      onWriting?: (file: string) => void;
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
      ffmpeggy.on("done", () => resolve());
      ffmpeggy.on("error", (error) => reject(error));

      ffmpeggy.run().catch(reject);
    });
  }
}

// Stream creation helpers
export class StreamHelpers {
  static createInputStream(filePath: string): ReadStream {
    return createReadStream(filePath);
  }

  static createOutputStream(filePath: string): WriteStream {
    return createWriteStream(filePath);
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
    },
  ): void {
    if (expectedOptions.cwd !== undefined) {
      expect(ffmpeggy.cwd).toBe(expectedOptions.cwd);
    }
    if (expectedOptions.overwriteExisting !== undefined) {
      expect(ffmpeggy.overwriteExisting).toBe(
        expectedOptions.overwriteExisting,
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
    expect(result.format.nb_streams).toBe(2);
    expect(result.format.duration).toBe("5.312000");
    expect(result.streams.length).toBeGreaterThan(0);
    expect(result.streams[0].codec_name).toBe("h264");
  }
}
