import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FFmpeggyProgressEvent } from "../FFmpeggy";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TEST_TIMEOUT_MS,
  TestFileManager,
  FFmpeggyTestHelpers,
} from "./utils/testHelpers";

// Configure FFmpeggy with binaries
configureFFmpeggy();

describe("FFMpeggy:events", () => {
  const fileManager = new TestFileManager("events");

  beforeAll(async () => {
    await fileManager.setup();
  });

  afterAll(async () => {
    await fileManager.cleanup();
  });

  it(
    "should copy bunny2.mp4 to temp file using events",
    async () => {
      const tempFile = fileManager.createTempFile("mp4");
      const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
        SAMPLE_FILES.mp4,
        tempFile,
        ["-c copy"]
      );

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
      const tempFile = fileManager.createTempFile("mp4");
      const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
        SAMPLE_FILES.mp4,
        tempFile,
        ["-c copy"]
      );

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
      const tempFile = fileManager.createTempFile("mp4");
      const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
        SAMPLE_FILES.mp4,
        tempFile,
        ["-c copy"]
      );

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
      const tempFile = fileManager.createTempFile("mp4");
      const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
        SAMPLE_FILES.mp4,
        tempFile.replace(".mp4", "%03d.mp4"),
        ["-f segment", "-segment_time", "1", "-reset_timestamps", "1"]
      );

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
