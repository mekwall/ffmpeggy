describe("import ES modules", () => {
  it("should be able to import", async () => {
    const module = await import("../../es/index.mjs");
    expect(module.FFmpeg).toBeDefined();
    const ffmpeg = new module.FFmpeg();
    expect(ffmpeg).toBeInstanceOf(module.FFmpeg);
  });
});
