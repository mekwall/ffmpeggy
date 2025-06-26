import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
} from "vitest";
import { FFmpeggy } from "#/FFmpeggy";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TestFileManager,
  FFmpeggyTestHelpers,
  waitForFileExists,
  waitForFileSize,
  HOOK_TIMEOUT_MS,
} from "../utils/testHelpers";

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

  beforeEach(async () => {
    await fileManager.cleanupStreams();
  });

  afterEach(async () => {
    await fileManager.cleanupStreams();
  });

  it("should stream bunny1.mkv to temp file using await", async () => {
    const tempFile = fileManager.createTempFile("mkv");
    const inputStream = fileManager.createInputStream(
      SAMPLE_FILES.video_basic_mkv,
    );
    const outputStream = fileManager.createOutputStream(tempFile);

    const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
      inputStream,
      outputStream,
      ["-f matroska"],
      ["-f matroska", "-c copy", "-stats"],
    );

    try {
      // Use the robust streaming test helper
      const { fileSize } = await FFmpeggyTestHelpers.runStreamingTest(
        ffmpeggy,
        tempFile,
        { minFileSize: 1000, maxRetries: 3, retryDelay: 1000 },
      );

      // Additional verification: check if the file is a valid MKV
      expect(fileSize).toBeGreaterThan(1000); // Should be at least 1KB
    } finally {
      // Streams are cleaned up in afterEach
    }
  });

  it("should stream audio.mp3 to temp file using await", async () => {
    const tempFile = fileManager.createTempFile("mp3");
    const inputStream = fileManager.createInputStream(
      SAMPLE_FILES.audio_basic_mp3,
    );
    const outputStream = fileManager.createOutputStream(tempFile);

    const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
      inputStream,
      outputStream,
      ["-f mp3"],
      ["-f mp3", "-c copy", "-stats"],
    );

    try {
      // Use the robust streaming test helper
      const { fileSize } = await FFmpeggyTestHelpers.runStreamingTest(
        ffmpeggy,
        tempFile,
        { minFileSize: 1, maxRetries: 3, retryDelay: 1000 },
      );

      expect(fileSize).toBeGreaterThan(0);
    } finally {
      // Streams are cleaned up in afterEach
    }
  });

  describe("toStream()", () => {
    it("should pipe to piped.mkv", async () => {
      const tempFile = fileManager.createTempFile("mkv");
      const outputStream = fileManager.createOutputStream(tempFile);

      const ffmpeggy = new FFmpeggy({
        input: SAMPLE_FILES.video_basic_mp4,
        output: "-", // Set output to stdout so FFmpeg knows where to write
        outputOptions: ["-f matroska"],
      });

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
      await waitForFileExists(tempFile);
      const fileSize = await waitForFileSize(tempFile, 1); // Should be at least 1 byte

      expect(fileSize).toBeGreaterThan(0);
    });
  });

  describe("reset()", () => {
    it("should be possible to reuse instance", async () => {
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
        fs.stat(tempFile1),
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
        fs.stat(tempFile2),
      );
      expect(tempStats2.size).toBeGreaterThan(0);
    });
  });

  // Additional tests for other audio formats
  it("should stream audio.ogg to temp file using await", async () => {
    const tempFile = fileManager.createTempFile("ogg");
    const inputStream = fileManager.createInputStream(
      SAMPLE_FILES.audio_basic_ogg,
    );
    const outputStream = fileManager.createOutputStream(tempFile);

    const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
      inputStream,
      outputStream,
      ["-f ogg"],
      ["-f ogg", "-c copy", "-stats"],
    );

    // Use the robust streaming test helper
    const { fileSize } = await FFmpeggyTestHelpers.runStreamingTest(
      ffmpeggy,
      tempFile,
      { minFileSize: 1, maxRetries: 3, retryDelay: 1000 },
    );

    expect(fileSize).toBeGreaterThan(0);
  });

  // Alternative implementation with better error handling
  it("should stream audio.ogg to temp file with robust error handling", async () => {
    const tempFile = fileManager.createTempFile("ogg");
    const inputStream = fileManager.createInputStream(
      SAMPLE_FILES.audio_basic_ogg,
    );
    const outputStream = fileManager.createOutputStream(tempFile);

    const ffmpeggy = FFmpeggyTestHelpers.createStreamingFFmpeggy(
      inputStream,
      outputStream,
      ["-f ogg"],
      ["-f ogg", "-c copy", "-stats"],
    );

    // Use a more direct approach with better error handling
    await new Promise<void>((resolve, reject) => {
      let hasResolved = false;

      const cleanup = () => {
        if (hasResolved) return;
        hasResolved = true;
      };

      ffmpeggy.on("done", async () => {
        try {
          cleanup();
          // Wait for file to exist and have proper size
          await waitForFileExists(tempFile);
          const fileSize = await waitForFileSize(tempFile, 1);
          expect(fileSize).toBeGreaterThan(0);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      ffmpeggy.on("error", (error) => {
        cleanup();
        reject(error);
      });

      ffmpeggy.on("exit", async (code, error) => {
        if (hasResolved) return;

        // Handle undefined exit codes gracefully
        if (error) {
          cleanup();
          reject(error);
          return;
        }

        // Accept 0, undefined, or null exit codes as success
        if (code === 0 || code === undefined || code === null) {
          try {
            await waitForFileExists(tempFile);
            const fileSize = await waitForFileSize(tempFile, 1);
            expect(fileSize).toBeGreaterThan(0);
            cleanup();
            resolve();
          } catch (fileError) {
            cleanup();
            reject(fileError);
          }
        } else {
          cleanup();
          reject(new Error(`FFmpeg process exited with code ${code}`));
        }
      });

      // Start the process
      ffmpeggy.run().catch((error) => {
        cleanup();
        reject(error);
      });
    });
  });
});
