import { EventEmitter } from "node:events";

describe("import ES modules", () => {
  it("should be able to import", async () => {
    if (process.version.startsWith("v12")) {
      // Next line blows up on v12 so let's skip this for now
      return;
    }
    // Ensure __signal_exit_emitter__ is defined or jest-runtime blows up
    // This bug is tracked here: https://github.com/facebook/jest/issues/11746
    process.__signal_exit_emitter__ = new EventEmitter();
    const module = await import("../../es/index.mjs");
    expect(module.FFmpeggy).toBeDefined();
    const ffmpeggy = new module.FFmpeggy();
    expect(ffmpeggy).toBeInstanceOf(module.FFmpeggy);
  });
});
