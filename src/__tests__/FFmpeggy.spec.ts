import crypto from "crypto";
import { mkdir, unlink, rm } from "fs/promises";
import path from "path";
import ffmpegBin from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";
import { FFmpeggy } from "../FFmpeggy";
import { waitFiles } from "./utils/waitFiles";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ReadStream } from "fs";

// Test timeout constants for better readability and maintainability
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
const TMP_DIR = path.join(SAMPLE_DIR, ".temp/unit");

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

describe("FFMpeggy:unit", () => {
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

  describe("run(): stream error handling", () => {
    it("should handle input stream errors", async () => {
      // Use a non-existent file to trigger a real stream error
      const { createReadStream } = await import("fs");
      const fakeStream = createReadStream("non-existent-file.mp4");

      const ffmpeggy = new FFmpeggy({
        input: fakeStream,
        output: "output.mp4",
      });
      ffmpeggy.ffmpegBin = ffmpegBin || "";

      // The stream will emit an error, which should be caught
      await expect(ffmpeggy.run()).rejects.toThrow();
    });

    it("should handle output stream errors", async () => {
      const { createWriteStream } = await import("fs");
      // Try to write to a directory that doesn't exist
      const fakeStream = createWriteStream("/non/existent/path/output.mp4");

      const ffmpeggy = new FFmpeggy({
        input: "src/__tests__/samples/bunny2.mp4",
        output: fakeStream,
      });
      ffmpeggy.ffmpegBin = ffmpegBin || "";

      // The stream will emit an error, which should be caught
      await expect(ffmpeggy.run()).rejects.toThrow();
    });

    it.skip("should throw timeout error if input stream never opens", async () => {
      // This test is impractical to implement reliably
      // Stream timeouts are handled by the OS and are not easily testable
    });

    it.skip("should throw timeout error if output stream never opens", async () => {
      // This test is impractical to implement reliably
      // Stream timeouts are handled by the OS and are not easily testable
    });
  });

  describe("setter methods", () => {
    it("should set global options", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setGlobalOptions(["-max_alloc 1024"]);
      expect(ffmpeggy.globalOptions).toContain("-max_alloc 1024");
    });

    it("should set input options", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setInputOptions(["-f mp4"]);
      expect(ffmpeggy.inputOptions).toContain("-f mp4");
    });

    it("should set output options", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setOutputOptions(["-c copy"]);
      expect(ffmpeggy.outputOptions).toContain("-c copy");
    });

    it("should set cwd", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setCwd("/tmp");
      expect(ffmpeggy.cwd).toBe("/tmp");
    });

    it("should set overwrite existing", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setOverwriteExisting(true);
      expect(ffmpeggy.overwriteExisting).toBe(true);
    });

    it("should set pipe", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setPipe(true);
      expect(ffmpeggy.output).toBe("-");
    });

    it("should set hide banner", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setHideBanner(false);
      expect(ffmpeggy.hideBanner).toBe(false);
    });

    it("should set input", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setInput("input.mp4");
      expect(ffmpeggy.input).toBe("input.mp4");
    });

    it("should set output", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setOutput("output.mp4");
      expect(ffmpeggy.output).toBe("output.mp4");
    });
  });

  describe("exit()", () => {
    it("should return status when not running", async () => {
      const ffmpeggy = new FFmpeggy();
      const result = await ffmpeggy.exit();
      expect(result).toEqual({ code: undefined, error: undefined });
    });
  });

  describe("reset()", () => {
    it("should reset instance to default state", async () => {
      const ffmpeggy = new FFmpeggy({
        input: "test.mp4",
        output: "test.mp4",
        globalOptions: ["-test"],
        inputOptions: ["-test"],
        outputOptions: ["-test"],
      });

      await ffmpeggy.reset();

      expect(ffmpeggy.input).toBe("");
      expect(ffmpeggy.globalOptions).toEqual([]);
      expect(ffmpeggy.inputOptions).toEqual([]);
      expect(ffmpeggy.outputOptions).toEqual([]);
      expect(ffmpeggy.error).toBeUndefined();
    });
  });

  describe("probe()", () => {
    it("should throw error if no input specified", async () => {
      const ffmpeggy = new FFmpeggy();
      await expect(ffmpeggy.probe()).rejects.toThrow("No input file specified");
    });

    it("should throw error if input is not a string", async () => {
      const ffmpeggy = new FFmpeggy({ input: "test" });
      ffmpeggy.input = {} as ReadStream;
      await expect(ffmpeggy.probe()).rejects.toThrow(
        "Probe can only accept strings. Use static FFmpeg.probe() directly."
      );
    });
  });

  describe("static probe()", () => {
    it("should throw error if ffprobe binary is missing", async () => {
      const originalBin = FFmpeggy.DefaultConfig.ffprobeBin;
      FFmpeggy.DefaultConfig.ffprobeBin = "";

      try {
        await expect(FFmpeggy.probe("test.mp4")).rejects.toThrow(
          "Failed to probe"
        );
      } finally {
        FFmpeggy.DefaultConfig.ffprobeBin = originalBin;
      }
    });

    it("should throw error if ffprobe fails", async () => {
      await expect(FFmpeggy.probe("nonexistent.mp4")).rejects.toThrow(
        "Failed to probe"
      );
    });
  });
});
