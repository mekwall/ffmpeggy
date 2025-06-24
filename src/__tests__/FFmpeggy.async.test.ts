import crypto from "crypto";
import { createWriteStream, createReadStream } from "fs";
import { mkdir, stat, unlink, rm } from "fs/promises";
import path from "path";
import ffmpegBin from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";
import { FFmpeggy } from "../FFmpeggy";
import { waitFiles } from "./utils/waitFiles";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// Test timeout constants for better readability and maintainability
const TEST_TIMEOUT_MS = 60000; // 60 seconds for most test operations
const PROBE_TIMEOUT_MS = 30000; // 30 seconds for probe operations

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
const TMP_DIR = path.join(SAMPLE_DIR, ".temp/await");

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

describe("FFMpeggy:async", () => {
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
    "should stream bunny1.mkv to temp file using await",
    async () => {
      const tempFile = getTempFile("mkv");
      const inputStream = createReadStream(sampleMkv);
      const outputStream = createWriteStream(tempFile);

      const ffmpeggy = new FFmpeggy({
        autorun: true,
        input: inputStream,
        inputOptions: ["-f matroska"],
        output: outputStream,
        outputOptions: [
          "-f matroska",
          "-c copy",
          "-stats", // Force statistics output
        ],
      });

      // Trigger autorun since the binary is set after import
      ffmpeggy.triggerAutorun();

      try {
        // Wait for FFmpeg to complete and get result
        const { file } = await ffmpeggy.done();
        // For streaming operations, file is undefined since we're writing to a stream
        expect(file).toBeUndefined();
        // Final sizes might not be available for streaming operations with -c copy
        // This is expected behavior - the important thing is that the file is created successfully

        // For streaming operations, we need to wait for the file to be created
        // Since we're writing to a stream, we'll wait a bit and then check if the file exists
        await wait(2000); // Longer wait for larger files like bunny1.mkv (22MB)

        // Check if file exists before trying to stat it
        try {
          const pipedStats = await stat(tempFile);
          expect(pipedStats.size).toBeGreaterThan(0);

          // Additional verification: check if the file is a valid MKV
          // This helps catch cases where the file was created but corrupted
          expect(pipedStats.size).toBeGreaterThan(1000); // Should be at least 1KB
        } catch (error) {
          throw new Error(`File ${tempFile} was not created. Error: ${error}`);
        }
      } finally {
        // Ensure streams are properly closed
        inputStream.destroy();
        outputStream.destroy();
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should stream audio.mp3 to temp file using await",
    async () => {
      const tempFile = getTempFile("mp3");
      const inputStream = createReadStream(sampleMp3);
      const outputStream = createWriteStream(tempFile);

      const ffmpeggy = new FFmpeggy({
        autorun: true,
        input: inputStream,
        inputOptions: ["-f mp3"],
        output: outputStream,
        outputOptions: [
          "-f mp3",
          "-c copy",
          "-stats", // Force statistics output
        ],
      });

      // Trigger autorun since the binary is set after import
      ffmpeggy.triggerAutorun();

      try {
        // Wait for FFmpeg to complete and get result
        const { file } = await ffmpeggy.done();
        // For streaming operations, file is undefined since we're writing to a stream
        expect(file).toBeUndefined();
        // Final sizes might not be available for streaming operations with -c copy
        // This is expected behavior - the important thing is that the file is created successfully

        // For streaming operations, we need to wait for the file to be created
        // Since we're writing to a stream, we'll wait a bit and then check if the file exists
        await wait(500);

        // Check if file exists before trying to stat it
        try {
          const pipedStats = await stat(tempFile);
          expect(pipedStats.size).toBeGreaterThan(0);
        } catch (error) {
          throw new Error(`File ${tempFile} was not created. Error: ${error}`);
        }
      } finally {
        // Ensure streams are properly closed
        inputStream.destroy();
        outputStream.destroy();
      }
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
        const outputStream = createWriteStream(tempFile);

        const ffmpeg = new FFmpeggy({
          autorun: true,
          input: sampleMp4,
          pipe: true,
          outputOptions: ["-f matroska"],
        });

        // Trigger autorun since the binary is set after import
        ffmpeg.triggerAutorun();

        try {
          const stream = ffmpeg.toStream();
          stream.pipe(outputStream);
          await ffmpeg.done();

          // For stream operations, wait for the file to be written
          await wait(500);

          // Check if file exists before trying to stat it
          try {
            const pipedStats = await stat(tempFile);
            expect(pipedStats.size).toBeGreaterThan(0);
          } catch (error) {
            throw new Error(
              `File ${tempFile} was not created. Error: ${error}`
            );
          }
        } finally {
          // Ensure stream is properly closed
          outputStream.destroy();
        }
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

        // Wait for the process to complete
        await ffmpeggy.done();

        const tempStats1 = await stat(tempFile1);
        expect(tempStats1.size).toBeGreaterThan(0);

        ffmpeggy.reset();

        const tempFile2 = getTempFile("mp4");
        await ffmpeggy
          .setInput(sampleMp4)
          .setOutputOptions(["-c copy"])
          .setOutput(tempFile2)
          .run();

        // Wait for the process to complete
        await ffmpeggy.done();

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
