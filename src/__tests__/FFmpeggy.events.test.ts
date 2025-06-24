import crypto from "crypto";
import { mkdir, unlink, rm } from "fs/promises";
import path from "path";
import ffmpegBin from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";
import { FFmpeggy, FFmpeggyProgressEvent } from "../FFmpeggy";
import { waitFiles } from "./utils/waitFiles";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test timeout constants for better readability and maintainability
const TEST_TIMEOUT_MS = 60000; // 60 seconds for most test operations

if (!ffmpegBin) {
  throw new Error("ffmpeg not found");
}

FFmpeggy.DefaultConfig = {
  ...FFmpeggy.DefaultConfig,
  overwriteExisting: true,
  ffprobeBin,
  ffmpegBin,
};

const SAMPLE_DIR = path.join(__dirname, "samples/");
const TMP_DIR = path.join(SAMPLE_DIR, ".temp/events");

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tmpFile(extension: string): string {
  // Ensure the extension starts with a dot
  if (extension[0] !== ".") {
    extension = "." + extension;
  }

  // Generate a random file name using current timestamp and random bytes
  const timestamp = new Date().getTime();
  const randomBytes = crypto.randomBytes(8).toString("hex");
  const tempFilename = path.join(
    TMP_DIR,
    `temp-${timestamp}-${randomBytes}${extension}`
  );
  return tempFilename;
}

describe("FFMpeggy:events", () => {
  const sampleMp4 = path.join(SAMPLE_DIR, "bunny2.mp4");
  const tempFiles: string[] = [];

  beforeAll(async () => {
    try {
      await mkdir(TMP_DIR, { recursive: true });
    } catch {
      // Ignore
    }
  });

  afterAll(async () => {
    // Clean up temp files
    await wait(500); // Longer wait to ensure all processes are done

    if (tempFiles.length > 0) {
      try {
        await waitFiles(tempFiles);
        await Promise.allSettled(tempFiles.map(unlink));
      } catch {
        // If waitFiles fails, try to unlink anyway
        await Promise.allSettled(tempFiles.map(unlink));
      }
    }

    try {
      await rm(TMP_DIR, {
        recursive: true,
        force: true,
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  function getTempFile(extension: string): string {
    const file = tmpFile(extension);
    tempFiles.push(file);
    return file;
  }

  it(
    "should copy bunny2.mp4 to temp file using events",
    async () => {
      const tempFile = getTempFile("mp4");
      const ffmpeggy = new FFmpeggy({
        input: sampleMp4,
        outputOptions: ["-c copy"],
        output: tempFile,
      });

      return new Promise<void>((resolve, reject) => {
        ffmpeggy.on("done", (file) => {
          expect(file).toBe(tempFile);
          resolve();
        });

        ffmpeggy.on("error", (error) => {
          reject(error);
        });

        ffmpeggy.run().catch(reject);
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should emit done event with final sizes",
    async () => {
      const tempFile = getTempFile("mp4");
      const ffmpeggy = new FFmpeggy({
        input: sampleMp4,
        outputOptions: ["-c copy"],
        output: tempFile,
      });

      return new Promise<void>((resolve, reject) => {
        ffmpeggy.on("done", (file, sizes) => {
          expect(file).toBe(tempFile);
          expect(sizes).toBeDefined();
          expect(sizes?.video).toBeGreaterThan(0);
          expect(sizes?.audio).toBeGreaterThan(0);
          resolve();
        });

        ffmpeggy.on("error", (error) => {
          reject(error);
        });

        ffmpeggy.run().catch(reject);
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should receive progress event",
    async () => {
      const tempFile = getTempFile("mp4");
      const ffmpeggy = new FFmpeggy({
        input: sampleMp4,
        outputOptions: ["-c copy"],
        output: tempFile,
      });

      return new Promise<void>((resolve, reject) => {
        let progressReceived = false;

        ffmpeggy.on("progress", (progress: FFmpeggyProgressEvent) => {
          expect(progress).toBeDefined();
          expect(progress.time).toBeGreaterThan(0);
          expect(progress.percent).toBeGreaterThan(0);
          expect(progress.percent).toBeLessThanOrEqual(100);
          progressReceived = true;
        });

        ffmpeggy.on("done", () => {
          expect(progressReceived).toBe(true);
          resolve();
        });

        ffmpeggy.on("error", (error) => {
          reject(error);
        });

        ffmpeggy.run().catch(reject);
      });
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should emit writing and done events for segments",
    async () => {
      const tempFile = getTempFile("mp4");
      const ffmpeggy = new FFmpeggy({
        input: sampleMp4,
        outputOptions: [
          "-f segment",
          "-segment_time",
          "1",
          "-reset_timestamps",
          "1",
        ],
        output: tempFile.replace(".mp4", "%03d.mp4"),
      });

      return new Promise<void>((resolve, reject) => {
        const writingEvents: string[] = [];
        const doneEvents: string[] = [];

        ffmpeggy.on("writing", (file) => {
          writingEvents.push(file);
        });

        ffmpeggy.on("done", (file) => {
          if (file) {
            doneEvents.push(file);
          }
        });

        ffmpeggy.on("exit", (code) => {
          expect(code).toBe(0);
          expect(writingEvents.length).toBeGreaterThan(0);
          expect(doneEvents.length).toBeGreaterThan(0);
          resolve();
        });

        ffmpeggy.on("error", (error) => {
          reject(error);
        });

        ffmpeggy.run().catch(reject);
      });
    },
    TEST_TIMEOUT_MS
  );
});
