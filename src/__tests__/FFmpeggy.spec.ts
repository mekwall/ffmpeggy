import crypto from "crypto";
import { createWriteStream, createReadStream } from "fs";
import { mkdir, stat, unlink, rm } from "fs/promises";
import path from "path";
import ffmpegBin from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";
import { FFmpeggy, FFmpeggyProgressEvent } from "../FFmpeggy";
import { FFmpeggyFinalSizes } from "../types/FFmpeggyProgress";
import { waitFiles } from "./utils/waitFiles";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test timeout constants for better readability and maintainability
const TEST_TIMEOUT_MS = 60000; // 60 seconds for most test operations
const PROBE_TIMEOUT_MS = 30000; // 30 seconds for probe operations
const LARGE_FILE_WAIT_TIMEOUT_MS = 30000; // 30 seconds for waiting on large files
const LARGE_FILE_CHECK_INTERVAL_MS = 2000; // 2 seconds between checks for large files

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
const TMP_DIR = path.join(SAMPLE_DIR, ".temp/");

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

describe("FFmpeggy", () => {
  const sampleMkv = path.join(SAMPLE_DIR, "bunny1.mkv");
  const sampleMp4 = path.join(SAMPLE_DIR, "bunny2.mp4");
  const sampleMp3 = path.join(SAMPLE_DIR, "audio.mp3");
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
    await wait(100);
    if (tempFiles.length > 0) {
      await waitFiles(tempFiles);
      await Promise.allSettled(tempFiles.map(unlink));
    }
    try {
      await rm(TMP_DIR, {
        recursive: true,
        force: true,
      });
    } catch {
      // Ignore
    }
  });

  function getTempFile(extension: string): string {
    const file = tmpFile(extension);
    tempFiles.push(file);
    return file;
  }

  it("should initialize", () => {
    const ffmpeggy = new FFmpeggy();
    expect(ffmpeggy).toBeInstanceOf(FFmpeggy);
  });

  it("should pass in options in constructor", () => {
    const ffmpeggy = new FFmpeggy({
      cwd: __dirname,
      overwriteExisting: false,
      pipe: true,
      hideBanner: false,
      globalOptions: ["-max_alloc 1024", "-vol 512"],
    });
    const go = ffmpeggy.globalOptions;
    expect(ffmpeggy.cwd).toBe(__dirname);
    expect(ffmpeggy.overwriteExisting).toBe(false);
    expect(ffmpeggy.output).toBe("-"); // pipe = true
    expect(ffmpeggy.hideBanner).toBe(false);
    expect(go.includes("-max_alloc 1024")).toBe(true);
    expect(go.includes("-vol 512")).toBe(true);
  });

  it("should set options with methods", () => {
    const ffmpeggy = new FFmpeggy();

    ffmpeggy.setCwd(__dirname);
    expect(ffmpeggy.cwd).toBe(__dirname);

    ffmpeggy.setOverwriteExisting(false);
    expect(ffmpeggy.overwriteExisting).toBe(false);

    ffmpeggy.setPipe(true); // output = "-"
    expect(ffmpeggy.output).toBe("-"); // pipe = true

    ffmpeggy.setHideBanner(false);
    expect(ffmpeggy.hideBanner).toBe(false);

    ffmpeggy.setGlobalOptions(["-max_alloc 1024", "-vol 512"]);
    expect(ffmpeggy.globalOptions.includes("-max_alloc 1024")).toBe(true);
    expect(ffmpeggy.globalOptions.includes("-vol 512")).toBe(true);

    ffmpeggy.setInputOptions([`-i ${sampleMp4}`]);
    expect(ffmpeggy.inputOptions.includes(`-i ${sampleMp4}`)).toBe(true);

    ffmpeggy.setOutputOptions(["-f mp4", "-c:v libx264"]);
    expect(ffmpeggy.outputOptions.includes("-f mp4")).toBe(true);
    expect(ffmpeggy.outputOptions.includes("-c:v libx264")).toBe(true);
  });

  it(
    "should copy bunny2.mp4 to temp file",
    async () => {
      const ffmpeggy = new FFmpeggy();
      const tempFile = getTempFile("mp4");

      const promise = new Promise<void>((resolve) => {
        ffmpeggy
          .setInput(sampleMp4)
          .setOutputOptions(["-c copy"])
          .setOutput(tempFile)
          .run();

        ffmpeggy.on("done", async () => {
          await waitFiles([tempFile]);
          const tempStats = await stat(tempFile);
          expect(tempStats.size).toBeGreaterThan(0);
        });

        ffmpeggy.on("exit", async (exitCode, error) => {
          expect(exitCode).toBe(0);
          expect(error).toBeUndefined();
          resolve();
        });
      });

      await promise;
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should emit done event with final sizes",
    async () => {
      const ffmpeggy = new FFmpeggy();
      const tempFile = getTempFile("mp4");

      const promise = new Promise<void>((resolve) => {
        let finalSizes: FFmpeggyFinalSizes | undefined;

        ffmpeggy
          .setInput(sampleMp4)
          .setOutputOptions(["-c:v libx264", "-c:a aac"])
          .setOutput(tempFile)
          .run();

        ffmpeggy.on("done", async (file, sizes) => {
          finalSizes = sizes;
          await waitFiles([tempFile]);
          const tempStats = await stat(tempFile);
          expect(tempStats.size).toBeGreaterThan(0);
        });

        ffmpeggy.on("exit", async (code, error) => {
          expect(code).toBe(0);
          expect(error).toBeUndefined();
          expect(finalSizes).toBeDefined();
          if (finalSizes) {
            expect(finalSizes.video).toBeGreaterThan(0);
            expect(finalSizes.audio).toBeGreaterThan(0);
            expect(finalSizes.subtitles).toBeGreaterThanOrEqual(0);
          }
          resolve();
        });
      });

      await promise;
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should emit done event with final sizes",
    async () => {
      const ffmpeggy = new FFmpeggy();
      const tempFile = getTempFile("mp4");

      const promise = new Promise<void>((resolve) => {
        let finalSizes: FFmpeggyFinalSizes | undefined;

        ffmpeggy
          .setInput(sampleMp4)
          .setOutputOptions(["-c:v libx264", "-c:a aac"])
          .setOutput(tempFile)
          .run();

        ffmpeggy.on("done", async (file, sizes) => {
          finalSizes = sizes;
          await waitFiles([tempFile]);
          const tempStats = await stat(tempFile);
          expect(tempStats.size).toBeGreaterThan(0);
        });

        ffmpeggy.on("exit", async (code, error) => {
          expect(code).toBe(0);
          expect(error).toBeUndefined();
          expect(finalSizes).toBeDefined();
          if (finalSizes) {
            expect(finalSizes.video).toBeGreaterThan(0);
            expect(finalSizes.audio).toBeGreaterThan(0);
            expect(finalSizes.subtitles).toBeGreaterThanOrEqual(0);
          }
          resolve();
        });
      });

      await promise;
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should emit done event with final sizes",
    async () => {
      const ffmpeggy = new FFmpeggy();
      const tempFile = getTempFile("mp4");

      const promise = new Promise<void>((resolve) => {
        let finalSizes: FFmpeggyFinalSizes | undefined;

        ffmpeggy
          .setInput(sampleMp4)
          .setOutputOptions(["-c:v libx264", "-c:a aac"])
          .setOutput(tempFile)
          .run();

        ffmpeggy.on("done", async (file, sizes) => {
          finalSizes = sizes;
          await waitFiles([tempFile]);
          const tempStats = await stat(tempFile);
          expect(tempStats.size).toBeGreaterThan(0);
        });

        ffmpeggy.on("exit", async (code, error) => {
          expect(code).toBe(0);
          expect(error).toBeUndefined();
          expect(finalSizes).toBeDefined();
          if (finalSizes) {
            expect(finalSizes.video).toBeGreaterThan(0);
            expect(finalSizes.audio).toBeGreaterThan(0);
            expect(finalSizes.subtitles).toBeGreaterThanOrEqual(0);
          }
          resolve();
        });
      });

      await promise;
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should stream bunny1.mkv to temp file",
    async () => {
      const tempFile = getTempFile("mkv");
      const ffmpeggy = new FFmpeggy({
        autorun: true,
        input: createReadStream(sampleMkv),
        inputOptions: ["-f matroska"],
        output: createWriteStream(tempFile),
        outputOptions: ["-f matroska", "-c copy"],
      });

      // Add error handling to catch FFmpeg errors
      ffmpeggy.on("error", (error) => {
        throw error;
      });

      await ffmpeggy.done();

      // Wait for the file to be fully written and closed
      // Use longer timeout for larger files like bunny1.mkv (22MB)
      await waitFiles(
        [tempFile],
        LARGE_FILE_WAIT_TIMEOUT_MS,
        LARGE_FILE_CHECK_INTERVAL_MS
      );

      const pipedStats = await stat(tempFile);
      expect(pipedStats.size).toBeGreaterThan(0);

      // Additional verification: check if the file is a valid MKV
      // This helps catch cases where the file was created but corrupted
      expect(pipedStats.size).toBeGreaterThan(1000); // Should be at least 1KB
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should stream audio.mp3 to temp file",
    async () => {
      const tempFile = getTempFile("mp3");
      const ffmpeggy = new FFmpeggy({
        autorun: true,
        input: createReadStream(sampleMp3),
        inputOptions: ["-f mp3"],
        output: createWriteStream(tempFile),
        outputOptions: ["-f mp3", "-c copy"],
      });
      await ffmpeggy.done();
      await waitFiles([tempFile]);
      const pipedStats = await stat(tempFile);
      expect(pipedStats.size).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should receive progress event",
    async () => {
      expect.assertions(9);
      const tempFile = getTempFile("mkv");
      const ffmpeggy = new FFmpeggy();

      const promise = new Promise<void>((resolve) => {
        ffmpeggy
          .setInput(sampleMp4)
          .setOutputOptions(["-c:v libx264", "-c:a aac"])
          .setOutput(tempFile)
          .run();

        let progress: FFmpeggyProgressEvent;
        ffmpeggy.on("progress", async (p) => {
          progress = p;
        });

        ffmpeggy.on("exit", async (code, error) => {
          expect(progress.frame).toBeGreaterThan(0);
          expect(progress.fps).toBeDefined();
          expect(progress.q).toBeDefined();
          expect(progress.size).toBeGreaterThan(0);
          expect(progress.time).toBeGreaterThan(0);
          expect(progress.bitrate).toBeGreaterThan(0);
          expect(progress.speed).toBeGreaterThan(0);
          expect(progress.duration).toBeDefined();
          expect(progress.percent).toBeGreaterThan(0);

          if (code === 1 || error) {
            throw error;
          } else {
            resolve();
          }
        });
      });

      await promise;
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should emit writing and done events for segments",
    async () => {
      const segmentCount = 3;
      const ffmpeggy = new FFmpeggy({
        input: sampleMkv,
        output: path.join(TMP_DIR, "temp-%d.mpegts"),
        outputOptions: [
          `-t ${segmentCount}`,
          "-map 0",
          "-c:v libx264",
          "-c:a aac",
          "-force_key_frames expr:gte(t,n_forced*1)",
          "-f ssegment",
          "-forced-idr 1",
          "-flags +cgop",
          "-copyts",
          "-vsync -1",
          "-avoid_negative_ts disabled",
          "-individual_header_trailer 0",
          "-start_at_zero",
          "-segment_list_type m3u8",
          `-segment_list ${path.join(TMP_DIR, "playlist.m3u8")}`,
          "-segment_time 1",
          "-segment_format mpegts",
        ],
      });

      const segments = new Array(segmentCount)
        .fill(undefined)
        .map((_v, idx) => path.join(TMP_DIR, `temp-${idx}.mpegts`));

      const promise = new Promise<void>((resolve) => {
        let writingEvents = 0;
        ffmpeggy.on("writing", (file) => {
          if (file.includes("temp-")) {
            expect(segments.includes(file)).toBe(true);
            writingEvents++;
          }
        });

        let doneEvents = 0;
        ffmpeggy.on("done", (file) => {
          if (file?.includes("temp-")) {
            expect(segments.includes(file)).toBe(true);
            doneEvents++;
          }
        });

        ffmpeggy.on("exit", (code, error) => {
          if (code === 1 || error) {
            throw error;
          } else {
            expect(writingEvents).toBeGreaterThan(0);
            expect(doneEvents).toBeGreaterThan(0);
            resolve();
          }
        });

        ffmpeggy.run();
      });

      await promise;
    },
    TEST_TIMEOUT_MS
  );

  it("should return existing process", () => {
    const ffmpeggy = new FFmpeggy();
    const tempFile = getTempFile("mp4");
    const process = ffmpeggy
      .setInput(sampleMp4)
      .setOutputOptions(["-c copy"])
      .setOutput(tempFile)
      .run();
    expect(ffmpeggy.run()).toEqual(process);
  });

  describe("toStream()", () => {
    it(
      "should pipe to piped.mkv",
      async () => {
        const tempFile = getTempFile("mkv");
        const ffmpeg = new FFmpeggy({
          autorun: true,
          input: sampleMp4,
          pipe: true,
          outputOptions: ["-f matroska"],
        });

        const stream = ffmpeg.toStream();
        stream.pipe(createWriteStream(tempFile));
        await ffmpeg.done();
        await waitFiles([tempFile]);
        const pipedStats = await stat(tempFile);
        expect(pipedStats.size).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS
    );
  });

  describe("reset()", () => {
    it(
      "should be possible to reuse instance",
      async () => {
        expect.assertions(2);
        const ffmpeggy = new FFmpeggy();
        const tempFile1 = getTempFile("mp4");
        await ffmpeggy
          .setInput(sampleMp4)
          .setOutputOptions(["-c copy"])
          .setOutput(tempFile1)
          .run();

        const tempStats1 = await stat(tempFile1);
        expect(tempStats1.size).toBeGreaterThan(0);

        ffmpeggy.reset();

        const tempFile2 = getTempFile("mp4");
        await ffmpeggy
          .setInput(sampleMp4)
          .setOutputOptions(["-c copy"])
          .setOutput(tempFile2)
          .run();

        const tempStats2 = await stat(tempFile2);
        expect(tempStats2.size).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS
    );
  });

  describe("probe()", () => {
    it(
      "should probe bunny2.mp4",
      async () => {
        expect.assertions(5);
        const result = await FFmpeggy.probe(sampleMp4);
        expect(result.format).toBeDefined();
        expect(result.format.nb_streams).toBe(2);
        expect(result.format.duration).toBe("5.312000");
        expect(result.streams.length).toBeGreaterThan(0);
        expect(result.streams[0].codec_name).toBe("h264");
      },
      PROBE_TIMEOUT_MS
    );

    it(
      "should throw error if failed",
      async () => {
        await expect(FFmpeggy.probe("path_does_not_exist")).rejects.toThrow(
          "Failed to probe"
        );
      },
      PROBE_TIMEOUT_MS
    );
  });

  describe("run(): error handling", () => {
    it("should throw error if ffmpegBin is falsey", async () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.ffmpegBin = "";
      await expect(ffmpeggy.run()).rejects.toThrow(
        "Missing path to ffmpeg binary"
      );
    });

    it("should throw error if input is falsey", async () => {
      const ffmpeggy = new FFmpeggy({ input: "" });
      ffmpeggy.input = "";
      await expect(ffmpeggy.run()).rejects.toThrow("No input specified");
    });

    it("should throw error if output is falsey", async () => {
      const ffmpeggy = new FFmpeggy({ input: "foo", output: "" });
      await expect(ffmpeggy.run()).rejects.toThrow("No output specified");
    });
  });
});
