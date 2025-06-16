import { describe, expect, it } from "vitest";
import { parseBitrate } from "../parseBitrate";

describe("parseBitrate", () => {
  it("should convert mbit/s to kbit/s", () => {
    expect(parseBitrate(1, "mb/s")).toBe(1000);
    expect(parseBitrate(1, "mbit/s")).toBe(1000);
    expect(parseBitrate(1, "mbits/s")).toBe(1000);
  });

  it("should convert bit/s to kbit/s", () => {
    expect(parseBitrate(1000, "b/s")).toBe(1);
    expect(parseBitrate(1000, "bit/s")).toBe(1);
    expect(parseBitrate(1000, "bits/s")).toBe(1);
  });

  it("shouldn't do anything", () => {
    expect(parseBitrate(1, "kb/s")).toBe(1);
    expect(parseBitrate(1, "kbit/s")).toBe(1);
    expect(parseBitrate(1, "kbits/s")).toBe(1);
  });

  it("should throw exception", () => {
    expect(() => parseBitrate(1, "z")).toThrow(new Error("Unknown unit"));
  });
});
