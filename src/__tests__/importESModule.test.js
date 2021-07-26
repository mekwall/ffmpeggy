describe("import ES modules", () => {
  it("should be able to import", async () => {
    if (process.version.startsWith("v12")) {
      // Next line blows up on v12 so let's skip this for now
      return;
    }
    const module = await import("../../es/index.mjs");
    expect(module.FFmpeg).toBeDefined();
    const ffmpeg = new module.FFmpeg();
    expect(ffmpeg).toBeInstanceOf(module.FFmpeg);
  });
});
