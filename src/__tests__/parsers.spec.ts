import { parseProgress } from "../parsers";

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
});
