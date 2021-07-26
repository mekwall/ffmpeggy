describe("import CommonJS module", () => {
  it("should be able to require", async () => {
    const module = require("../../cjs/index.js");
    expect(module.FFmpeg).toBeDefined();
    const ffmpeg = new module.FFmpeg();
    expect(ffmpeg).toBeInstanceOf(module.FFmpeg);
  });
});
