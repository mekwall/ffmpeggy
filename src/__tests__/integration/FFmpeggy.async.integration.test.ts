import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { FFmpeggy } from "#/FFmpeggy.js";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TEST_TIMEOUT_MS,
  TestFileManager,
  FFmpeggyTestHelpers,
  TestAssertions,
  HOOK_TIMEOUT_MS,
} from "../utils/testHelpers.js";

// Configure FFmpeggy with binaries
configureFFmpeggy();

describe("FFmpeggy:async", () => {
  const fileManager = new TestFileManager("async");

  beforeAll(async () => {
    await fileManager.setup();
  });

  afterAll(async () => {
    await fileManager.cleanup();
  }, HOOK_TIMEOUT_MS);

  afterEach(async () => {
    await fileManager.cleanupStreams();
  });

  it(
    "should stream bunny1.mkv to temp file using await",
    async () => {
      const tempFile = fileManager.createTempFile("mkv");
      const inputStream = fileManager.createInputStream(
        SAMPLE_FILES.video_basic_mkv
      );
      const outputStream = fileManager.createOutputStream(tempFile);

      const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
        inputStream,
        outputStream,
        ["-f matroska"],
        ["-f matroska", "-c copy", "-stats"]
      );

      try {
        // Wait for FFmpeg to complete and get result
        const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
        // For streaming operations, file is undefined since we're writing to a stream
        expect(file).toBeUndefined();

        // Wait for file to exist and have proper size
        await TestAssertions.expectFileExists(tempFile);
        const fileSize = await TestAssertions.expectFileSize(tempFile, 1000); // Should be at least 1KB

        // Additional verification: check if the file is a valid MKV
        expect(fileSize).toBeGreaterThan(1000); // Should be at least 1KB
      } finally {
        // Streams are cleaned up in afterEach
      }
    },
    TEST_TIMEOUT_MS
  );

  it(
    "should stream audio.mp3 to temp file using await",
    async () => {
      const tempFile = fileManager.createTempFile("mp3");
      const inputStream = fileManager.createInputStream(
        SAMPLE_FILES.audio_basic_mp3
      );
      const outputStream = fileManager.createOutputStream(tempFile);

      const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
        inputStream,
        outputStream,
        ["-f mp3"],
        ["-f mp3", "-c copy", "-stats"]
      );

      try {
        // Wait for FFmpeg to complete and get result
        const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
        // For streaming operations, file is undefined since we're writing to a stream
        expect(file).toBeUndefined();

        // Wait for file to exist and have proper size
        await TestAssertions.expectFileExists(tempFile);
        const fileSize = await TestAssertions.expectFileSize(tempFile, 1); // Should be at least 1 byte

        expect(fileSize).toBeGreaterThan(0);
      } finally {
        // Streams are cleaned up in afterEach
      }
    },
    TEST_TIMEOUT_MS
  );

  describe("toStream()", () => {
    it("should pipe to piped.mkv", async () => {
      const tempFile = fileManager.createTempFile("mkv");
      const outputStream = fileManager.createOutputStream(tempFile);

      const ffmpeggy = new FFmpeggy({
        input: SAMPLE_FILES.video_basic_mp4,
        output: "-", // Set output to stdout so FFmpeg knows where to write
        outputOptions: ["-f matroska"],
      });

      try {
        const stream = ffmpeggy.toStream();

        // Start FFmpeg after calling toStream() so _wantsStream is set
        ffmpeggy.run();

        // Pipe the stream and wait for both the stream and ffmpeg to finish
        const streamPromise = new Promise<void>((resolve, reject) => {
          outputStream.on("finish", async () => {
            try {
              await ffmpeggy.done();
              resolve();
            } catch (err) {
              reject(err);
            }
          });
          outputStream.on("error", (err) => {
            reject(err);
          });
          stream.pipe(outputStream);
        });

        // Wait for the stream and ffmpeg to complete
        await streamPromise;

        // Wait for file to exist and have proper size
        await TestAssertions.expectFileExists(tempFile);
        const fileSize = await TestAssertions.expectFileSize(tempFile, 1); // Should be at least 1 byte

        expect(fileSize).toBeGreaterThan(0);
      } finally {
        // Streams are cleaned up in afterEach
      }
    }, 5000); // 5 seconds timeout
  });

  describe("reset()", () => {
    it(
      "should be possible to reuse instance",
      async () => {
        expect.assertions(2);
        const ffmpeggy = FFmpeggyTestHelpers.createBasicFFmpeggy();
        const tempFile1 = fileManager.createTempFile("mp4");

        await ffmpeggy
          .setInput(SAMPLE_FILES.video_basic_mp4)
          .setOutputOptions(["-c copy"])
          .setOutput(tempFile1)
          .run();

        // Wait for the process to complete
        await ffmpeggy.done();

        const tempStats1 = await import("fs/promises").then((fs) =>
          fs.stat(tempFile1)
        );
        expect(tempStats1.size).toBeGreaterThan(0);

        ffmpeggy.reset();

        const tempFile2 = fileManager.createTempFile("mp4");
        await ffmpeggy
          .setInput(SAMPLE_FILES.video_basic_mp4)
          .setOutputOptions(["-c copy"])
          .setOutput(tempFile2)
          .run();

        // Wait for the process to complete
        await ffmpeggy.done();

        const tempStats2 = await import("fs/promises").then((fs) =>
          fs.stat(tempFile2)
        );
        expect(tempStats2.size).toBeGreaterThan(0);
      },
      TEST_TIMEOUT_MS
    );
  });

  // Additional tests for other audio formats
  it(
    "should stream audio.ogg to temp file using await",
    async () => {
      const tempFile = fileManager.createTempFile("ogg");
      const inputStream = fileManager.createInputStream(
        SAMPLE_FILES.audio_basic_ogg
      );
      const outputStream = fileManager.createOutputStream(tempFile);
      const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
        inputStream,
        outputStream,
        ["-f ogg"],
        ["-f ogg", "-c copy", "-stats"]
      );
      try {
        await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
        await TestAssertions.expectFileExists(tempFile);
        const fileSize = await TestAssertions.expectFileSize(tempFile, 1);
        expect(fileSize).toBeGreaterThan(0);
      } finally {
        // Streams are cleaned up in afterEach
      }
    },
    TEST_TIMEOUT_MS
  );
});
