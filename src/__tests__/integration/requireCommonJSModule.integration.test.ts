import { describe, it, expect } from "vitest";

describe("CommonJS build", () => {
  it("can be required and used", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { FFmpeggy } = require("../../../dist/index.cjs");
    expect(FFmpeggy).toBeDefined();
    const ffmpeggy = new FFmpeggy();
    expect(ffmpeggy).toBeInstanceOf(FFmpeggy);
  });
});
