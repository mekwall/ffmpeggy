import { describe, expect, it } from "vitest";
import { parseProgress, parseFinalSizes } from "../parsers";

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
});
