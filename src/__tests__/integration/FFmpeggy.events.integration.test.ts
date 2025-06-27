import { FFmpeggy } from "#/FFmpeggy";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TestFileManager,
  FFmpeggyTestHelpers,
} from "../utils/testHelpers";
import type { FFmpeggyFinalSizes } from "#/types";

// Configure FFmpeggy with binaries
configureFFmpeggy();

describe("FFmpeggy:events", () => {
  const fileManager = new TestFileManager("events");

  beforeEach(async () => {
    await fileManager.setup();
  });

  afterEach(async () => {
    await fileManager.cleanupStreams();
    await fileManager.cleanup();
  });

  it("should emit done event when copying video file", async () => {
    const temporaryFile = fileManager.createTempFile("mp4");
    const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
      SAMPLE_FILES.video_basic_mp4,
      temporaryFile,
      ["-c copy"],
    );

    return new Promise<void>((resolve, reject) => {
      ffmpeggy.on("done", (result) => {
        const file = Array.isArray(result) ? result[0]?.file : result?.file;
        expect(file).toBe(temporaryFile);
        resolve();
      });

      ffmpeggy.on("error", (error) => {
        reject(error);
      });

      ffmpeggy.run().catch(reject);
    });
  });

  it("should emit done event with final sizes", async () => {
    const temporaryFile = fileManager.createTempFile("mp4");
    const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
      SAMPLE_FILES.video_basic_mp4,
      temporaryFile,
      ["-c copy"],
    );

    return new Promise<void>((resolve, reject) => {
      ffmpeggy.on("done", (result) => {
        const r = Array.isArray(result) ? result[0] : result;
        expect(r?.file).toBe(temporaryFile);
        expect(r?.sizes).toBeDefined();
        expect(r?.sizes?.video).toBeGreaterThan(0);
        expect(r?.sizes?.audio).toBeGreaterThan(0);
        resolve();
      });

      ffmpeggy.on("error", (error) => {
        reject(error);
      });

      ffmpeggy.run().catch(reject);
    });
  });

  it("should receive progress event", async () => {
    const temporaryFile = fileManager.createTempFile("mp4");
    const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
      SAMPLE_FILES.video_basic_mp4,
      temporaryFile,
      ["-c copy"],
    );

    return new Promise<void>((resolve, reject) => {
      let progressReceived = false;
      ffmpeggy.on("progress", (progress) => {
        const array = Array.isArray(progress) ? progress : [progress];
        for (const p of array) {
          expect(p).toBeDefined();
          expect(p.time).toBeGreaterThan(0);
          if (p.duration === 0 || p.duration === undefined) {
            expect(p.percent).toBe(0);
          } else {
            expect(p.percent).toBeGreaterThan(0);
            expect(p.percent).toBeLessThanOrEqual(100);
          }
          progressReceived = true;
        }
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
  });

  it("should emit writing and done events for segments", async () => {
    const temporaryFile = fileManager.createTempFile("mp4");
    const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
      SAMPLE_FILES.video_basic_mp4,
      temporaryFile.replace(".mp4", "%03d.mp4"),
      ["-f segment", "-segment_time", "1", "-reset_timestamps", "1"],
    );

    return new Promise<void>((resolve, reject) => {
      const writingEvents: { file: string; outputIndex: number }[] = [];
      const doneEvents: {
        file?: string;
        sizes?: FFmpeggyFinalSizes;
        outputIndex?: number;
      }[] = [];
      ffmpeggy.on("writing", (info) => {
        const array = Array.isArray(info) ? info : [info];
        writingEvents.push(...array);
      });
      ffmpeggy.on("done", (result) => {
        const array = Array.isArray(result) ? result : [result];
        doneEvents.push(...array);
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
  });

  it("should handle progress when duration is not available", async () => {
    const temporaryFile = fileManager.createTempFile("mp4");
    const ffmpeggy = FFmpeggyTestHelpers.createFileToFileFFmpeggy(
      SAMPLE_FILES.video_basic_mp4,
      temporaryFile,
      ["-c copy", "-t", "1"], // Limit to 1 second to make test faster
    );

    return new Promise<void>((resolve, reject) => {
      let progressReceived = false;
      ffmpeggy.on("progress", (progress) => {
        const array = Array.isArray(progress) ? progress : [progress];
        for (const p of array) {
          expect(p).toBeDefined();
          expect(p.time).toBeGreaterThan(0);
          if (p.duration === 0 || p.duration === undefined) {
            expect(p.percent).toBe(0);
          } else {
            expect(p.percent).toBeGreaterThan(0);
            expect(p.percent).toBeLessThanOrEqual(100);
          }
          progressReceived = true;
        }
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
  });

  it("should handle streaming with events", async () => {
    const temporaryFile = fileManager.createTempFile("mkv");
    const inputStream = fileManager.createInputStream(
      SAMPLE_FILES.video_basic_mkv, // Use simpler MKV file with single video stream
    );
    const outputStream = fileManager.createOutputStream(temporaryFile);

    const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
      inputStream,
      outputStream,
      ["-analyzeduration", "10M", "-probesize", "10M"], // Increase analysis duration and probe size
      [
        "-f",
        "matroska",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p", // Explicitly specify pixel format
        "-c:a",
        "aac",
        "-stats",
      ],
    );

    return new Promise<void>((resolve, reject) => {
      ffmpeggy.on("done", ({ sizes }) => {
        expect(sizes.video).toBeGreaterThan(0);
        resolve();
      });

      ffmpeggy.on("error", (error) => {
        reject(error);
      });

      ffmpeggy.run();
    });
  });

  it("should handle multiple outputs with events", async () => {
    const output1 = fileManager.createTempFile("mp4");
    const output2 = fileManager.createTempFile("mkv");

    const ffmpeggy = new FFmpeggy()
      .setInput(SAMPLE_FILES.video_basic_mp4)
      .setOutputs([
        {
          destination: output1,
          options: ["-c:v", "libx264", "-c:a", "aac"],
        },
        {
          destination: output2,
          options: ["-c:v", "libx265", "-c:a", "mp3"],
        },
      ]);

    return new Promise<void>((resolve, reject) => {
      const doneEvents: {
        file?: string;
        sizes?: FFmpeggyFinalSizes;
        outputIndex?: number;
      }[] = [];

      ffmpeggy.on("done", (result) => {
        const array = Array.isArray(result) ? result : [result];
        doneEvents.push(...array);
      });

      ffmpeggy.on("exit", (code) => {
        expect(code).toBe(0);
        expect(doneEvents.length).toBeGreaterThan(0);
        expect(doneEvents[0]?.file).toBe(output1);
        resolve();
      });

      ffmpeggy.on("error", (error) => {
        reject(error);
      });

      ffmpeggy.run().catch(reject);
    });
  });

  it("should handle tee muxer with events", async () => {
    const output1 = fileManager.createTempFile("mp4");
    const output2 = fileManager.createTempFile("mkv");

    const ffmpeggy = new FFmpeggy()
      .setInput(SAMPLE_FILES.video_basic_mp4)
      .setOutputs([
        {
          destination: output1,
          options: ["-c:v", "libx264", "-c:a", "aac"],
        },
        {
          destination: output2,
          options: ["-c:v", "libx264", "-c:a", "aac"], // Same codec for tee compatibility
        },
      ])
      .useTee();

    return new Promise<void>((resolve, reject) => {
      const doneEvents: {
        file?: string;
        sizes?: FFmpeggyFinalSizes;
        outputIndex?: number;
      }[] = [];

      ffmpeggy.on("done", (result) => {
        const array = Array.isArray(result) ? result : [result];
        doneEvents.push(...array);
      });

      ffmpeggy.on("exit", (code) => {
        expect(code).toBe(0);
        expect(doneEvents.length).toBe(2);
        expect(doneEvents[0]?.file).toBe(output1);
        expect(doneEvents[1]?.file).toBe(output2);
        resolve();
      });

      ffmpeggy.on("error", (error) => {
        reject(error);
      });

      ffmpeggy.run().catch(reject);
    });
  });
});
