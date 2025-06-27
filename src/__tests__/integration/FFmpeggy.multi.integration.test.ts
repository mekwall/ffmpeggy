import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { FFmpeggy } from "#/FFmpeggy";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TestFileManager,
  FFmpeggyTestHelpers,
  waitForFileExists,
} from "../utils/testHelpers";

// Configure FFmpeggy with binaries
configureFFmpeggy();

describe("FFmpeggy:multi", () => {
  const fileManager = new TestFileManager("multiple");

  beforeAll(async () => {
    await fileManager.setup();
  });

  afterAll(async () => {
    await fileManager.cleanup();
  });

  afterEach(async () => {
    await fileManager.cleanupStreams();
  });

  describe("Debug", () => {
    it("should run a simple FFmpeg command", async () => {
      const outputFile = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutput(outputFile)
        .setOutputOptions(["-c", "copy"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(outputFile);
      await waitForFileExists(outputFile);
    });
  });

  describe("Multiple inputs", () => {
    it("should handle multiple file inputs", async () => {
      const output = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInputs([SAMPLE_FILES.video_basic_mp4, SAMPLE_FILES.video_basic_mkv])
        .setOutput(output)
        .setOutputOptions(["-c:v", "libx264", "-c:a", "aac"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output);
      await waitForFileExists(output);
    });

    it("should handle mixed input types", async () => {
      const output = fileManager.createTempFile("mp4");
      const inputStream = fileManager.createInputStream(
        SAMPLE_FILES.audio_basic_mp3,
      );

      const ffmpeggy = new FFmpeggy()
        .setInputs([
          SAMPLE_FILES.video_basic_mp4,
          { source: inputStream, options: ["-f", "mp3"] },
        ])
        .setOutput(output)
        .setOutputOptions(["-c:v", "libx264", "-c:a", "aac"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output);
      await waitForFileExists(output);
    });

    it("should support input options", async () => {
      const output = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInputs([
          { source: SAMPLE_FILES.video_basic_mp4, options: ["-ss", "1"] },
          { source: SAMPLE_FILES.video_basic_mkv, options: ["-ss", "2"] },
        ])
        .setOutput(output)
        .setOutputOptions(["-c:v", "libx264", "-c:a", "aac"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output);
      await waitForFileExists(output);
    });

    it("should handle mixed audio and video inputs", async () => {
      const outputFile = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInputs([SAMPLE_FILES.video_basic_mp4, SAMPLE_FILES.audio_basic_mp3])
        .setOutput(outputFile)
        .setOutputOptions(["-c:v", "libx264", "-c:a", "aac"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(outputFile);
      await waitForFileExists(outputFile);
    });

    it("should handle different video formats", async () => {
      const output1 = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInputs([SAMPLE_FILES.video_basic_mp4, SAMPLE_FILES.video_alt_mkv])
        .setOutput(output1)
        .setOutputOptions(["-c:v", "libx264", "-c:a", "aac"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
    });
  });

  describe("Multiple outputs", () => {
    it("should handle multiple file outputs", async () => {
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

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle mixed output types", async () => {
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

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should support output options", async () => {
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

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle WebM to MP4 conversion", async () => {
      const outputFile = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_alt_mkv)
        .setOutput(outputFile)
        .setOutputOptions(["-c:v", "libx264", "-c:a", "aac"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(outputFile);
      await waitForFileExists(outputFile);
    });
  });

  describe("Tee pseudo-muxer", () => {
    it("should use tee pseudo-muxer when useTee() is called", async () => {
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

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should use tee pseudo-muxer when tee option is set in constructor", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mkv");

      const ffmpeggy = new FFmpeggy({
        input: SAMPLE_FILES.video_basic_mp4,
        outputs: [
          {
            destination: output1,
            options: ["-c:v", "libx264", "-c:a", "aac"],
          },
          {
            destination: output2,
            options: ["-c:v", "libx264", "-c:a", "aac"], // Same codec for tee compatibility
          },
        ],
        tee: true, // Enable tee via constructor option
      });

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should not use tee pseudo-muxer by default for multiple outputs", async () => {
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
            options: ["-c:v", "libx265", "-c:a", "mp3"], // Different codecs - standard multi-output
          },
        ]);
      // No .useTee() called - should use standard multi-output

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should use tee with different codecs", async () => {
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
        ])
        .useTee();

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle tee with streams", async () => {
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
        ])
        .useTee();

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle tee with mixed input types", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mkv");
      const inputStream = fileManager.createInputStream(
        SAMPLE_FILES.audio_basic_mp3,
      );

      const ffmpeggy = new FFmpeggy()
        .setInputs([
          SAMPLE_FILES.video_basic_mp4,
          { source: inputStream, options: ["-f", "mp3"] },
        ])
        .setOutputs([
          {
            destination: output1,
            options: ["-c:v", "libx264", "-c:a", "aac"],
          },
          {
            destination: output2,
            options: ["-c:v", "libx265", "-c:a", "mp3"],
          },
        ])
        .useTee();

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });
  });

  describe("Helper methods", () => {
    it("should provide input and output counts", () => {
      const ffmpeggy = new FFmpeggy()
        .setInputs([SAMPLE_FILES.video_basic_mp4, SAMPLE_FILES.video_basic_mkv])
        .setOutputs([
          { destination: "output1.mp4", options: ["-c:v", "libx264"] },
          { destination: "output2.mp4", options: ["-c:v", "libx265"] },
        ]);

      expect(ffmpeggy.getInputCount()).toBe(2);
      expect(ffmpeggy.getOutputCount()).toBe(2);
    });

    it("should clear inputs and outputs", () => {
      const ffmpeggy = new FFmpeggy()
        .setInputs([SAMPLE_FILES.video_basic_mp4, SAMPLE_FILES.video_basic_mkv])
        .setOutputs([
          { destination: "output1.mp4", options: ["-c:v", "libx264"] },
          { destination: "output2.mp4", options: ["-c:v", "libx265"] },
        ]);

      expect(ffmpeggy.getInputCount()).toBe(2);
      expect(ffmpeggy.getOutputCount()).toBe(2);

      ffmpeggy.clearInputs();
      ffmpeggy.clearOutputs();

      expect(ffmpeggy.getInputCount()).toBe(0);
      expect(ffmpeggy.getOutputCount()).toBe(0);
    });

    it("should probe specific inputs", async () => {
      const ffmpeggy = new FFmpeggy()
        .addInput(SAMPLE_FILES.video_basic_mp4)
        .addInput(SAMPLE_FILES.video_basic_mkv);

      const result1 = await ffmpeggy.probeInput(0);
      const result2 = await ffmpeggy.probeInput(1);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.format?.filename).toContain(
        "big_buck_bunny_h264_aac_320x180_2aud_2vid_ccby.mp4",
      );
      expect(result2.format?.filename).toContain(
        "sample_mkv_640x360_h264_640x360_free.mkv",
      );
    });

    it("should throw error for invalid input index", async () => {
      const ffmpeggy = new FFmpeggy().addInput(SAMPLE_FILES.video_basic_mp4);

      await expect(ffmpeggy.probeInput(1)).rejects.toThrow(
        "Input index 1 out of range (1 inputs)",
      );
    });
  });

  describe("Backward compatibility", () => {
    it("should maintain backward compatibility with single input/output", async () => {
      const outputFile = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutput(outputFile)
        .setOutputOptions(["-c", "copy"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(outputFile);
      await waitForFileExists(outputFile);
    });

    it("should work with constructor options", async () => {
      const outputFile = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy({
        input: SAMPLE_FILES.video_basic_mp4,
        output: outputFile,
        outputOptions: ["-c", "copy"],
      });

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(outputFile);
      await waitForFileExists(outputFile);
    });
  });

  describe("Complex scenarios", () => {
    it("should handle multiple inputs and outputs", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mkv");

      const ffmpeggy = new FFmpeggy()
        .setInputs([SAMPLE_FILES.video_basic_mp4, SAMPLE_FILES.video_basic_mkv])
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

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle complex input options", async () => {
      const outputFile = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInputs([
          {
            source: SAMPLE_FILES.video_basic_mp4,
            options: ["-ss", "1", "-t", "5"],
          },
          {
            source: SAMPLE_FILES.video_basic_mkv,
            options: ["-ss", "2", "-t", "3"],
          },
        ])
        .setOutput(outputFile)
        .setOutputOptions(["-c:v", "libx264", "-c:a", "aac"]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(outputFile);
      await waitForFileExists(outputFile);
    });

    it("should handle different resolutions for each output", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutputs([
          {
            destination: output1,
            options: ["-s", "1280x720", "-c:v", "libx264"],
          },
          {
            destination: output2,
            options: ["-s", "640x480", "-c:v", "libx264"],
          },
        ]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle different bitrates for each output", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutputs([
          {
            destination: output1,
            options: ["-b:v", "2M", "-c:v", "libx264"],
          },
          {
            destination: output2,
            options: ["-b:v", "1M", "-c:v", "libx264"],
          },
        ]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle different audio codecs for each output", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mkv");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutputs([
          {
            destination: output1,
            options: ["-c:v", "copy", "-c:a", "aac"],
          },
          {
            destination: output2,
            options: ["-c:v", "copy", "-c:a", "mp3"],
          },
        ]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle different quality settings for each output", async () => {
      const hdOutput = fileManager.createTempFile("mp4");
      const sdOutput = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutputs([
          {
            destination: hdOutput,
            options: ["-s", "1280x720", "-b:v", "2M", "-c:v", "libx264"],
          },
          {
            destination: sdOutput,
            options: ["-s", "640x480", "-b:v", "500k", "-c:v", "libx264"],
          },
        ]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(hdOutput);
      await waitForFileExists(hdOutput);
      await waitForFileExists(sdOutput);
    });

    it("should handle different frame rates for each output", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mp4");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutputs([
          {
            destination: output1,
            options: ["-r", "30", "-c:v", "libx264"],
          },
          {
            destination: output2,
            options: ["-r", "24", "-c:v", "libx264"],
          },
        ]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle different audio bitrates for each output", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mkv");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutputs([
          {
            destination: output1,
            options: ["-c:v", "copy", "-b:a", "192k", "-c:a", "aac"],
          },
          {
            destination: output2,
            options: ["-c:v", "copy", "-b:a", "128k", "-c:a", "mp3"],
          },
        ]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });

    it("should handle different audio sample rates for each output", async () => {
      const output1 = fileManager.createTempFile("mp4");
      const output2 = fileManager.createTempFile("mkv");

      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutputs([
          {
            destination: output1,
            options: ["-c:v", "copy", "-ar", "48000", "-c:a", "aac"],
          },
          {
            destination: output2,
            options: ["-c:v", "copy", "-ar", "44100", "-c:a", "mp3"],
          },
        ]);

      const { file } = await FFmpeggyTestHelpers.runAndWait(ffmpeggy);
      expect(file).toBe(output1);
      await waitForFileExists(output1);
      await waitForFileExists(output2);
    });
  });
});
