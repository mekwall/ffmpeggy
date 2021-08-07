describe("import CommonJS module", () => {
  it("should be able to require", async () => {
    const module = require("../../cjs/index.js");
    expect(module.FFmpeggy).toBeDefined();
    const ffmpeggy = new module.FFmpeggy();
    expect(ffmpeggy).toBeInstanceOf(module.FFmpeggy);
  });
});
