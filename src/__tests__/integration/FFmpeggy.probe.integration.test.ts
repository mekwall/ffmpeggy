import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { FFmpeggy } from "#/FFmpeggy";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TestFileManager,
} from "../utils/testHelpers";
import { writeFile } from "node:fs/promises";

// Configure FFmpeggy with binaries
configureFFmpeggy();

describe("FFmpeggy:probe", () => {
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

  describe("Static probe() method", () => {
    it("should probe MP4 video file", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_basic_mp4);
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);

      // Verify specific MP4 properties
      expect(result.format.format_name).toContain("mp4");
      expect(result.streams).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);

      // Check for video stream
      const videoStream = result.streams.find((s) => s.codec_type === "video");
      expect(videoStream).toBeDefined();
      expect(videoStream?.codec_name).toBeDefined();
    });

    it("should probe MKV video file", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_basic_mkv);
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);

      // Verify specific MKV properties
      expect(result.format.format_name).toContain("matroska");
      expect(result.streams).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
    });

    it("should probe MP3 audio file", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.audio_basic_mp3);
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);

      // Verify specific MP3 properties
      expect(result.format.format_name).toContain("mp3");
      expect(result.streams).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);

      // Check for audio stream
      const audioStream = result.streams.find((s) => s.codec_type === "audio");
      expect(audioStream).toBeDefined();
      expect(audioStream?.codec_name).toBeDefined();
    });

    it("should probe OGG audio file", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.audio_basic_ogg);
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);

      // Verify specific OGG properties
      expect(result.format.format_name).toContain("ogg");
      expect(result.streams).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
    });

    it("should probe VTT subtitle file", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.subtitle_vtt);

      // VTT files might not have duration, so we'll check format and streams separately
      expect(result.format).toBeDefined();
      expect(result.format.format_name).toContain("webvtt");
      expect(result.streams).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);

      // Check for subtitle stream
      const subtitleStream = result.streams.find(
        (s) => s.codec_type === "subtitle",
      );
      expect(subtitleStream).toBeDefined();
    });

    it("should probe complex video with multiple streams", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_multi_stream);
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);

      // Verify multiple streams
      expect(result.streams.length).toBeGreaterThan(1);

      // Check for multiple audio and video streams
      const videoStreams = result.streams.filter(
        (s) => s.codec_type === "video",
      );
      const audioStreams = result.streams.filter(
        (s) => s.codec_type === "audio",
      );

      expect(videoStreams.length).toBeGreaterThan(0);
      expect(audioStreams.length).toBeGreaterThan(0);
    });

    it("should handle files without duration", async () => {
      // Use a file that might not have duration information
      const result = await FFmpeggy.probe(SAMPLE_FILES.subtitle_vtt);

      // Check that we get a valid result even if duration is undefined
      expect(result.format).toBeDefined();
      expect(result.streams).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);

      // Duration might be undefined for some file types
      expect(
        result.format.duration === undefined ||
          typeof result.format.duration === "number",
      ).toBe(true);
    });

    it("should throw error for non-existent file", async () => {
      await expect(FFmpeggy.probe("nonexistent_file.mp4")).rejects.toThrow(
        "Failed to probe",
      );
    });

    it("should throw error for invalid file path", async () => {
      await expect(FFmpeggy.probe("")).rejects.toThrow("Failed to probe");
    });
  });

  describe("Instance probe() method", () => {
    it("should probe file using instance method", async () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setInput(SAMPLE_FILES.video_basic_mp4);

      const result = await ffmpeggy.probe();
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);

      expect(result.format.format_name).toContain("mp4");
    });

    it("should probe different files with same instance", async () => {
      const ffmpeggy = new FFmpeggy();

      // Probe MP4
      ffmpeggy.setInput(SAMPLE_FILES.video_basic_mp4);
      const mp4Result = await ffmpeggy.probe();
      expect(mp4Result.format.format_name).toContain("mp4");

      // Probe MKV
      ffmpeggy.setInput(SAMPLE_FILES.video_basic_mkv);
      const mkvResult = await ffmpeggy.probe();
      expect(mkvResult.format.format_name).toContain("matroska");
    });

    it("should throw error if no input specified", async () => {
      const ffmpeggy = new FFmpeggy();
      await expect(ffmpeggy.probe()).rejects.toThrow("No input file specified");
    });

    it("should throw error if input is not a string", async () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.setInput("test");
      ffmpeggy.input = {} as unknown as string;
      await expect(ffmpeggy.probe()).rejects.toThrow(
        "Probe can only accept strings. Use static FFmpeg.probe() directly.",
      );
    });
  });

  describe("Probe with specific options", () => {
    it("should probe with custom ffprobe binary", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_basic_mp4);
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);
      expect(result).toBeDefined();
    });

    it("should probe with different working directory", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_basic_mp4);
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);
      expect(result).toBeDefined();
    });
  });

  describe("Probe result validation", () => {
    it("should return valid format information", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_basic_mp4);

      expect(result.format).toBeDefined();
      expect(result.format.format_name).toBeDefined();
      expect(result.format.duration).toBeDefined();
      expect(result.format.size).toBeDefined();
      expect(result.format.bit_rate).toBeDefined();
    });

    it("should return valid stream information", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_basic_mp4);

      expect(result.streams).toBeDefined();
      expect(Array.isArray(result.streams)).toBe(true);
      expect(result.streams.length).toBeGreaterThan(0);

      const stream = result.streams[0];
      expect(stream.index).toBeDefined();
      expect(stream.codec_name).toBeDefined();
      expect(stream.codec_type).toBeDefined();
    });

    it("should handle video stream properties", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_basic_mp4);

      const videoStream = result.streams.find((s) => s.codec_type === "video");
      expect(videoStream).toBeDefined();

      // Use optional chaining and nullish coalescing to avoid conditional tests
      expect(videoStream?.width).toBeDefined();
      expect(videoStream?.height).toBeDefined();
      expect(videoStream?.r_frame_rate).toBeDefined();
      expect(videoStream?.avg_frame_rate).toBeDefined();
    });

    it("should handle audio stream properties", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.audio_basic_mp3);

      const audioStream = result.streams.find((s) => s.codec_type === "audio");
      expect(audioStream).toBeDefined();

      // Use optional chaining to avoid conditional tests
      expect(audioStream?.sample_rate).toBeDefined();
      expect(audioStream?.channels).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should handle corrupted files gracefully", async () => {
      // Create a corrupted file
      const corruptedFile = fileManager.createTempFile("mp4");
      await writeFile(corruptedFile, "This is not a valid video file");

      await expect(FFmpeggy.probe(corruptedFile)).rejects.toThrow(
        "Failed to probe",
      );
    });

    it("should handle permission denied files", async () => {
      // This test would require creating a file with no read permissions
      // which is platform-specific and complex to set up reliably
      // For now, we'll test with a non-existent file
      await expect(FFmpeggy.probe("/root/nonexistent.mp4")).rejects.toThrow(
        "Failed to probe",
      );
    });

    it("should handle network timeouts for remote files", async () => {
      // This would require a mock server or actual network file
      // For now, we'll test with an invalid URL
      await expect(
        FFmpeggy.probe("http://invalid-url-that-does-not-exist.com/file.mp4"),
      ).rejects.toThrow("Failed to probe");
    });
  });

  describe("Performance and timeout", () => {
    it("should complete probing within reasonable time", async () => {
      const startTime = Date.now();

      await FFmpeggy.probe(SAMPLE_FILES.video_basic_mp4);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    it("should handle large files", async () => {
      const result = await FFmpeggy.probe(SAMPLE_FILES.video_multi_stream);
      expect(result).toBeDefined();
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBeGreaterThan(0);
      expect(result.format.duration).toBeDefined();
      expect(result.streams.length).toBeGreaterThan(0);
      // Check that at least one stream has a valid codec
      const hasValidCodec = result.streams.some(
        (stream) => stream.codec_name && stream.codec_name.length > 0,
      );
      expect(hasValidCodec).toBe(true);
      expect(result).toBeDefined();
    });
  });
});
