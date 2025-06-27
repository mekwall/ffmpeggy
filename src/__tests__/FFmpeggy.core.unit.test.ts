import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ReadStream } from "node:fs";
import { FFmpeggy } from "#/FFmpeggy";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TestFileManager,
  FFmpeggyTestHelpers,
  HOOK_TIMEOUT_MS,
} from "./utils/testHelpers";

// Configure FFmpeggy with binaries
configureFFmpeggy();

describe("FFmpeggy:core", () => {
  const fileManager = new TestFileManager("unit");

  beforeAll(async () => {
    await fileManager.setup();
  });

  afterAll(async () => {
    await fileManager.cleanup();
  }, HOOK_TIMEOUT_MS);

  it("should initialize", () => {
    const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
    expect(ffmpeggy).toBeDefined();
  });

  it("should pass in options in constructor", () => {
    const options = {
      cwd: __dirname,
      overwriteExisting: false,
      pipe: true,
      hideBanner: false,
      globalOptions: ["-max_alloc 1024", "-vol 512"],
    };

    const ffmpeggy = FFmpeggyTestHelpers.createFFmpeggyWithOptions(options);
    expect(ffmpeggy.cwd).toBe(options.cwd);
    expect(ffmpeggy.overwriteExisting).toBe(options.overwriteExisting);
    expect(ffmpeggy.output).toBe("-");
    expect(ffmpeggy.hideBanner).toBe(options.hideBanner);
    // -stats is always added to globalOptions
    expect(ffmpeggy.globalOptions).toEqual([
      "-stats",
      ...options.globalOptions,
    ]);
    expect(ffmpeggy).toBeDefined();
  });

  it("should set options with methods", () => {
    const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();

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

    ffmpeggy.setInputOptions([`-i ${SAMPLE_FILES.video_basic_mp4}`]);
    expect(
      ffmpeggy.inputOptions.includes(`-i ${SAMPLE_FILES.video_basic_mp4}`),
    ).toBe(true);

    ffmpeggy.setOutputOptions(["-f mp4", "-c:v libx264"]);
    expect(ffmpeggy.outputOptions.includes("-f mp4")).toBe(true);
    expect(ffmpeggy.outputOptions.includes("-c:v libx264")).toBe(true);
  });

  it("should return existing process", () => {
    const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
    const temporaryFile = fileManager.createTempFile("mp4");
    const process = ffmpeggy
      .setInput(SAMPLE_FILES.video_basic_mp4)
      .setOutputOptions(["-c copy"])
      .setOutput(temporaryFile)
      .run();
    expect(ffmpeggy.run()).toEqual(process);
  });

  describe("run(): error handling", () => {
    it("should throw error if ffmpegBin is falsey", async () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.ffmpegBin = "";
      await expect(ffmpeggy.run()).rejects.toThrow(
        "Missing path to ffmpeg binary",
      );
    });

    it("should throw error if input is falsey", async () => {
      const ffmpeggy = FFmpeggyTestHelpers.createFFmpeggyWithOptions({
        input: "",
      });
      ffmpeggy.input = "";
      await expect(ffmpeggy.run()).rejects.toThrow("No input specified");
    });

    it("should throw error if output is falsey", async () => {
      const ffmpeggy = FFmpeggyTestHelpers.createFFmpeggyWithOptions({
        input: SAMPLE_FILES.video_basic_mp4,
        output: "",
      });
      await expect(ffmpeggy.run()).rejects.toThrow("No output specified");
    });
  });

  describe("run(): stream error handling", () => {
    it("should throw error if input file does not exist", async () => {
      // Test that FFmpeggy validates file existence before calling FFmpeg
      const ffmpeggy = FFmpeggyTestHelpers.createFFmpeggyWithOptions({
        input: "nonexistent_file.mp4",
        output: "output.mp4",
      });
      const ffmpegStatic = await import("ffmpeg-static");
      ffmpeggy.ffmpegBin = (ffmpegStatic.default as unknown as string) || "";

      // This should fail with a clear error message before FFmpeg is even called
      await expect(ffmpeggy.run()).rejects.toThrow(
        "Input file does not exist: nonexistent_file.mp4",
      );
    });
  });

  describe("setter methods", () => {
    it("should set global options", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setGlobalOptions(["-max_alloc 1024"]);
      expect(ffmpeggy.globalOptions).toContain("-max_alloc 1024");
    });

    it("should set input options", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setInputOptions(["-f mp4"]);
      expect(ffmpeggy.inputOptions).toContain("-f mp4");
    });

    it("should set output options", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setOutputOptions(["-c copy"]);
      expect(ffmpeggy.outputOptions).toContain("-c copy");
    });

    it("should set cwd", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setCwd("/tmp");
      expect(ffmpeggy.cwd).toBe("/tmp");
    });

    it("should set overwrite existing", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setOverwriteExisting(true);
      expect(ffmpeggy.overwriteExisting).toBe(true);
    });

    it("should set pipe", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setPipe(true);
      expect(ffmpeggy.output).toBe("-");
    });

    it("should set hide banner", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setHideBanner(false);
      expect(ffmpeggy.hideBanner).toBe(false);
    });

    it("should set input", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setInput("input.mp4");
      expect(ffmpeggy.input).toBe("input.mp4");
    });

    it("should set output", () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      ffmpeggy.setOutput("output.mp4");
      expect(ffmpeggy.output).toBe("output.mp4");
    });
  });

  describe("exit()", () => {
    it("should return status when not running", async () => {
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      const result = await ffmpeggy.exit();
      expect(result).toEqual({ code: undefined, error: undefined });
    });
  });

  describe("reset()", () => {
    it("should reset instance to default state", async () => {
      const ffmpeggy = FFmpeggyTestHelpers.createFFmpeggyWithOptions({
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
      const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
      await expect(ffmpeggy.probe()).rejects.toThrow("No input file specified");
    });

    it("should throw error if input is not a string", async () => {
      const ffmpeggy = FFmpeggyTestHelpers.createFFmpeggyWithOptions({
        input: "test",
      });
      ffmpeggy.input = {} as ReadStream;
      await expect(ffmpeggy.probe()).rejects.toThrow(
        "Probe can only accept strings. Use static FFmpeg.probe() directly.",
      );
    });
  });

  describe("static probe()", () => {
    it("should throw error if ffprobe binary is missing", async () => {
      const originalBin = FFmpeggy.DefaultConfig.ffprobeBin;
      FFmpeggy.DefaultConfig.ffprobeBin = "";

      try {
        await expect(FFmpeggy.probe("test.mp4")).rejects.toThrow(
          "Failed to probe",
        );
      } finally {
        FFmpeggy.DefaultConfig.ffprobeBin = originalBin;
      }
    });

    it("should throw error if ffprobe fails", async () => {
      await expect(FFmpeggy.probe("nonexistent.mp4")).rejects.toThrow(
        "Failed to probe",
      );
    });
  });
});
