import { describe, expect, it } from "vitest";
import { parseProgress, parseFinalSizes, parseInfo } from "../parsers";

function calculateProgressPercentage(
  progressTime: number | undefined,
  duration: number | undefined,
): number {
  return duration && duration > 0 && progressTime
    ? Math.min(100, Math.round((progressTime / duration) * 100 * 100) / 100)
    : 0;
}

describe("parsers", () => {
  it("should parse simple progress", () => {
    const txt =
      "size=      19kB time=01:16:04.05 bitrate=   48.0kbits/s speed= 348x";
    const progress = parseProgress(txt);
    expect(progress).toBeDefined();
    expect(progress?.size).toBe(19456);
    expect(progress?.time).toBe(4564.05);
    expect(progress?.bitrate).toBe(48);
    expect(progress?.speed).toBe(348);
  });

  it("should parse full progress", () => {
    const txt =
      "frame= 3853 fps=246 q=-1.0 size=   25202kB time=00:02:34.08 bitrate=1339.9kbits/s speed=9.82x";
    const progress = parseProgress(txt);
    expect(progress).toBeDefined();
    expect(progress?.frame).toBe(3853);
    expect(progress?.fps).toBe(246);
    expect(progress?.q).toBe(-1);
    expect(progress?.size).toBe(25806848);
    expect(progress?.time).toBe(154.08);
    expect(progress?.bitrate).toBe(1339.9);
    expect(progress?.speed).toBe(9.82);
  });

  it("should parse progress where size and bitrate are N/A", () => {
    const txt =
      "frame=   72 fps=0.0 q=-1.0 Lsize=N/A time=00:00:02.85 bitrate=N/A speed=2.93x";
    const progress = parseProgress(txt);
    expect(progress).toBeDefined();
    expect(progress?.frame).toBe(72);
    expect(progress?.fps).toBe(0);
    expect(progress?.q).toBe(-1);
    expect(progress?.size).toBe(undefined);
    expect(progress?.time).toBe(2.85);
    expect(progress?.bitrate).toBe(undefined);
    expect(progress?.speed).toBe(2.93);
  });

  describe("parseFinalSizes", () => {
    it("should parse final sizes with kB units", () => {
      const txt =
        "video:1033kB audio:226kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: 0.414726%";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeDefined();
      expect(sizes?.video).toBe(1057792); // 1033 * 1024
      expect(sizes?.audio).toBe(231424); // 226 * 1024
      expect(sizes?.subtitles).toBe(0);
      expect(sizes?.otherStreams).toBe(0);
      expect(sizes?.globalHeaders).toBe(0);
      expect(sizes?.muxingOverhead).toBe(0.00414726); // 0.414726 / 100
    });

    it("should parse final sizes with MB units", () => {
      const txt =
        "video:2MB audio:1MB subtitle:0MB other streams:0MB global headers:0kB muxing overhead: 0.414726%";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeDefined();
      expect(sizes?.video).toBe(2097152); // 2 * 1024 * 1024
      expect(sizes?.audio).toBe(1048576); // 1 * 1024 * 1024
      expect(sizes?.subtitles).toBe(0);
      expect(sizes?.otherStreams).toBe(0);
      expect(sizes?.globalHeaders).toBe(0);
      expect(sizes?.muxingOverhead).toBe(0.00414726);
    });

    it("should parse final sizes with B units", () => {
      const txt =
        "video:1024B audio:512B subtitle:0B other streams:0kB global headers:0kB muxing overhead: 0.414726%";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeDefined();
      expect(sizes?.video).toBe(1024);
      expect(sizes?.audio).toBe(512);
      expect(sizes?.subtitles).toBe(0);
      expect(sizes?.otherStreams).toBe(0);
      expect(sizes?.globalHeaders).toBe(0);
      expect(sizes?.muxingOverhead).toBe(0.00414726);
    });

    it("should parse final sizes with mixed units", () => {
      const txt =
        "video:1MB audio:512kB subtitle:256B other streams:128kB global headers:64kB muxing overhead: 1.234567%";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeDefined();
      expect(sizes?.video).toBe(1048576); // 1 * 1024 * 1024
      expect(sizes?.audio).toBe(524288); // 512 * 1024
      expect(sizes?.subtitles).toBe(256);
      expect(sizes?.otherStreams).toBe(131072); // 128 * 1024
      expect(sizes?.globalHeaders).toBe(65536); // 64 * 1024
      expect(sizes?.muxingOverhead).toBe(0.01234567); // 1.234567 / 100
    });

    it("should parse final sizes with only video", () => {
      const txt =
        "video:1033kB other streams:0kB global headers:0kB muxing overhead: 0.414726%";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeDefined();
      expect(sizes?.video).toBe(1057792); // 1033 * 1024
      expect(sizes?.audio).toBe(0);
      expect(sizes?.subtitles).toBe(0);
      expect(sizes?.otherStreams).toBe(0);
      expect(sizes?.globalHeaders).toBe(0);
      expect(sizes?.muxingOverhead).toBe(0.00414726);
    });

    it("should parse final sizes with video and audio only", () => {
      const txt =
        "video:1033kB audio:226kB other streams:0kB global headers:0kB muxing overhead: 0.414726%";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeDefined();
      expect(sizes?.video).toBe(1057792); // 1033 * 1024
      expect(sizes?.audio).toBe(231424); // 226 * 1024
      expect(sizes?.subtitles).toBe(0);
      expect(sizes?.otherStreams).toBe(0);
      expect(sizes?.globalHeaders).toBe(0);
      expect(sizes?.muxingOverhead).toBe(0.00414726);
    });

    it("should parse final sizes with different field order", () => {
      const txt =
        "audio:512kB video:1MB subtitle:256B global headers:64kB other streams:128kB muxing overhead: 0.5%";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeDefined();
      expect(sizes?.video).toBe(1048576); // 1 * 1024 * 1024
      expect(sizes?.audio).toBe(524288); // 512 * 1024
      expect(sizes?.subtitles).toBe(256);
      expect(sizes?.otherStreams).toBe(131072); // 128 * 1024
      expect(sizes?.globalHeaders).toBe(65536); // 64 * 1024
      expect(sizes?.muxingOverhead).toBe(0.005); // 0.5 / 100
    });

    it("should parse final sizes with subtitles (plural)", () => {
      const txt =
        "video:1033kB audio:226kB subtitles:0kB other streams:0kB global headers:0kB muxing overhead: 0.414726%";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeDefined();
      expect(sizes?.video).toBe(1057792);
      expect(sizes?.audio).toBe(231424);
      expect(sizes?.subtitles).toBe(0);
      expect(sizes?.otherStreams).toBe(0);
      expect(sizes?.globalHeaders).toBe(0);
      expect(sizes?.muxingOverhead).toBe(0.00414726);
    });

    it("should return undefined for non-matching text", () => {
      const txt = "This is not a final sizes line";
      const sizes = parseFinalSizes(txt);
      expect(sizes).toBeUndefined();
    });
  });

  describe("parseInfo", () => {
    it("should parse duration, start, and bitrate", () => {
      const result = parseInfo(
        "Duration: 00:00:05.31, start: 0.000000, bitrate: 1000 kb/s",
      );
      expect(result).toEqual({
        duration: 5.31,
        start: 0,
        bitrate: 1000,
      });
    });

    it("should handle N/A duration", () => {
      const result = parseInfo(
        "Duration: N/A, start: 0.000000, bitrate: 1000 kb/s",
      );
      expect(result).toEqual({
        duration: undefined,
        start: 0,
        bitrate: 1000,
      });
    });

    it("should handle missing duration", () => {
      const result = parseInfo("start: 0.000000, bitrate: 1000 kb/s");
      expect(result).toBeUndefined();
    });

    it("should handle empty duration string", () => {
      const result = parseInfo(
        "Duration: , start: 0.000000, bitrate: 1000 kb/s",
      );
      expect(result).toBeUndefined();
    });

    it("should return undefined for non-matching text", () => {
      const result = parseInfo("Some random text");
      expect(result).toBeUndefined();
    });
  });

  describe("progress percentage calculation", () => {
    it("should calculate correct percentage when duration is available", () => {
      const progress = parseProgress(
        "frame= 3853 fps=246 q=-1.0 size=   25202kB time=00:02:34.08 bitrate=1339.9kbits/s speed=9.82x",
      );
      expect(progress).toBeDefined();
      expect(progress?.time).toBe(154.08);

      const duration = 300; // 5 minutes
      const percent = calculateProgressPercentage(progress?.time, duration);

      expect(percent).toBe(51.36); // (154.08 / 300) * 100
    });

    it("should return 0 when duration is not available", () => {
      const progress = parseProgress(
        "frame= 3853 fps=246 q=-1.0 size=   25202kB time=00:02:34.08 bitrate=1339.9kbits/s speed=9.82x",
      );
      expect(progress).toBeDefined();
      expect(progress?.time).toBe(154.08);

      const duration = 0;
      const percent = calculateProgressPercentage(progress?.time, duration);

      expect(percent).toBe(0);
    });

    it("should return 0 when duration is undefined", () => {
      const progress = parseProgress(
        "frame= 3853 fps=246 q=-1.0 size=   25202kB time=00:02:34.08 bitrate=1339.9kbits/s speed=9.82x",
      );
      expect(progress).toBeDefined();
      expect(progress?.time).toBe(154.08);

      const duration = undefined;
      const percent = calculateProgressPercentage(progress?.time, duration);

      expect(percent).toBe(0);
    });

    it("should return 0 when progress time is not available", () => {
      const progress = parseProgress(
        "frame= 3853 fps=246 q=-1.0 size=   25202kB bitrate=1339.9kbits/s speed=9.82x",
      );
      expect(progress).toBeDefined();
      expect(progress?.time).toBeUndefined();

      const duration = 300;
      const percent = calculateProgressPercentage(progress?.time, duration);

      expect(percent).toBe(0);
    });
  });
});
