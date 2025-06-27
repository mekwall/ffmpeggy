/* eslint-disable @typescript-eslint/no-require-imports, unicorn/prefer-module */
import { describe, it, expect } from "vitest";

describe("CommonJS build", () => {
  it("can be required and used", () => {
    // We can safely ignore the no-require-imports rule here because we are
    // testing the CommonJS build of the library.
    // We can also ignore the prefer-module rule because we are testing the
    // CommonJS build of the library.
    // skipcq: JS-0359
    const { FFmpeggy } = require("../../../dist/index.cjs");
    expect(FFmpeggy).toBeDefined();
    const ffmpeggy = new FFmpeggy();
    expect(ffmpeggy).toBeInstanceOf(FFmpeggy);
  });
});
