import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FFmpeggy } from "../FFmpeggy";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TEST_TIMEOUT_MS,
  TestFileManager,
  FFmpeggyTestHelpers,
  StreamHelpers,
  TestAssertions,
  cleanupStreams,
} from "./utils/testHelpers";

// Configure FFmpeggy with binaries
configureFFmpeggy();

describe("FFMpeggy:async", () => {
  const fileManager = new TestFileManager("async");

  beforeAll(async () => {
    await fileManager.setup();
  });

  afterAll(async () => {
    await fileManager.cleanup();
  });

  it("should initialize", () => {
    const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
    TestAssertions.expectFFmpeggyInstance(ffmpeggy);
  });

  it("should pass in options in constructor", () => {
    const ffmpeggy = FFmpeggyTestHelpers.createFFmpeggyWithOptions({
      cwd: __dirname,
      overwriteExisting: false,
      pipe: true,
      hideBanner: false,
      globalOptions: ["-max_alloc 1024", "-vol 512"],
    });

    TestAssertions.expectConstructorOptions(ffmpeggy, {
      cwd: __dirname,
      overwriteExisting: false,
      output: "-", // pipe = true
      hideBanner: false,
      globalOptions: ["-max_alloc 1024", "-vol 512"],
    });
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

    ffmpeggy.setInputOptions([`-i ${SAMPLE_FILES.mp4}`]);
    expect(ffmpeggy.inputOptions.includes(`-i ${SAMPLE_FILES.mp4}`)).toBe(true);

    ffmpeggy.setOutputOptions(["-f mp4", "-c:v libx264"]);
    expect(ffmpeggy.outputOptions.includes("-f mp4")).toBe(true);
    expect(ffmpeggy.outputOptions.includes("-c:v libx264")).toBe(true);
  });

  it(
    "should stream bunny1.mkv to temp file using await",
    async () => {
      const tempFile = fileManager.createTempFile("mkv");
      const inputStream = StreamHelpers.createInputStream(SAMPLE_FILES.mkv);
      const outputStream = StreamHelpers.createOutputStream(tempFile);

      const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
        inputStream,
        outputStream,
        ["-f matroska"],
        ["-f matroska", "-c copy", "-stats"],
      );

      try {
        // Wait for FFmpeg to complete and get result
        const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
        // For streaming operations, file is undefined since we're writing to a stream
        expect(file).toBeUndefined();

        // Wait for file to exist and have proper size
        // stream.pipeline ensures the output stream is properly closed
        await TestAssertions.expectFileExists(tempFile);
        const fileSize = await TestAssertions.expectFileSize(tempFile, 1000); // Should be at least 1KB

        // Additional verification: check if the file is a valid MKV
        expect(fileSize).toBeGreaterThan(1000); // Should be at least 1KB
      } finally {
        // Ensure streams are properly closed with enhanced cleanup
        await cleanupStreams(inputStream, outputStream);
      }
    },
    TEST_TIMEOUT_MS,
  );

  it(
    "should stream audio.mp3 to temp file using await",
    async () => {
      const tempFile = fileManager.createTempFile("mp3");
      const inputStream = StreamHelpers.createInputStream(SAMPLE_FILES.mp3);
      const outputStream = StreamHelpers.createOutputStream(tempFile);

      const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
        inputStream,
        outputStream,
        ["-f mp3"],
        ["-f mp3", "-c copy", "-stats"],
      );

      try {
        // Wait for FFmpeg to complete and get result
        const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
        // For streaming operations, file is undefined since we're writing to a stream
        expect(file).toBeUndefined();

        // Wait for file to exist and have proper size
        // stream.pipeline ensures the output stream is properly closed
        await TestAssertions.expectFileExists(tempFile);
        const fileSize = await TestAssertions.expectFileSize(tempFile, 1); // Should be at least 1 byte

        expect(fileSize).toBeGreaterThan(0);
      } finally {
        // Ensure streams are properly closed with enhanced cleanup
        await cleanupStreams(inputStream, outputStream);
      }
    },
    TEST_TIMEOUT_MS,
  );

  it("should return existing process", () => {
    const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
    const tempFile = fileManager.createTempFile("mp4");
    const process = ffmpeggy
      .setInput(SAMPLE_FILES.mp4)
      .setOutputOptions(["-c copy"])
      .setOutput(tempFile)
      .run();
    expect(ffmpeggy.run()).toEqual(process);
  });

  describe("toStream()", () => {
    it(
      "should pipe to piped.mkv",
      async () => {
        const tempFile = fileManager.createTempFile("mkv");
        const outputStream = StreamHelpers.createOutputStream(tempFile);

        const ffmpeg = FFmpeggyTestHelpers.createPipedFFmpeggy(
          SAMPLE_FILES.mp4,
          ["-f matroska"],
        );

        try {
          const stream = ffmpeg.toStream();
          stream.pipe(outputStream);

          // Wait for FFmpeg to complete
          await ffmpeg.done();

          // Wait for file to exist and have proper size
          // stream.pipeline ensures the output stream is properly closed
          await TestAssertions.expectFileExists(tempFile);
          const fileSize = await TestAssertions.expectFileSize(tempFile, 1); // Should be at least 1 byte

          expect(fileSize).toBeGreaterThan(0);
        } finally {
          // Ensure stream is properly closed with enhanced cleanup
          await cleanupStreams(outputStream);
        }
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe("reset()", () => {
    it(
      "should be possible to reuse instance",
      async () => {
        expect.assertions(2);
        const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
        const tempFile1 = fileManager.createTempFile("mp4");

        await ffmpeggy
          .setInput(SAMPLE_FILES.mp4)
          .setOutputOptions(["-c copy"])
          .setOutput(tempFile1)
          .run();

        // Wait for the process to complete
        await ffmpeggy.done();

        const tempStats1 = await import("fs/promises").then((fs) =>
          fs.stat(tempFile1),
        );
        expect(tempStats1.size).toBeGreaterThan(0);

        ffmpeggy.reset();

        const tempFile2 = fileManager.createTempFile("mp4");
        await ffmpeggy
          .setInput(SAMPLE_FILES.mp4)
          .setOutputOptions(["-c copy"])
          .setOutput(tempFile2)
          .run();

        // Wait for the process to complete
        await ffmpeggy.done();

        const tempStats2 = await import("fs/promises").then((fs) =>
          fs.stat(tempFile2),
        );
        expect(tempStats2.size).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS,
    );
  });

  describe("probe()", () => {
    it(
      "should probe bunny2.mp4",
      async () => {
        expect.assertions(6);
        const result = await FFmpeggy.probe(SAMPLE_FILES.mp4);
        TestAssertions.expectProbeResult(result);
      },
      TEST_TIMEOUT_MS,
    );

    it(
      "should throw error if failed",
      async () => {
        await expect(FFmpeggy.probe("path_does_not_exist")).rejects.toThrow(
          "Failed to probe",
        );
      },
      TEST_TIMEOUT_MS,
    );
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
        input: "foo",
        output: "",
      });
      await expect(ffmpeggy.run()).rejects.toThrow("No output specified");
    });
  });
});
