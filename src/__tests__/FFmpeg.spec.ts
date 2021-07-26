import fs, { createWriteStream, createReadStream } from "fs";
import path from "path";
import { path as ffmpegBin } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobeBin } from "@ffprobe-installer/ffprobe";
import { file as tmpFile } from "tempy";
import { waitFile } from "wait-file";
import { FFmpeg } from "../FFmpeg";

// NOTE: "fs/promises" is not available in node 12
const { unlink, stat } = fs.promises;

FFmpeg.DefaultConfig = {
  ...FFmpeg.DefaultConfig,
  overwriteExisting: true,
  ffprobeBin,
  ffmpegBin,
};

describe("FFmpeg", () => {
  const sampleMp4 = path.join(__dirname, "samples/sample1.mp4");
  const sampleMkv = path.join(__dirname, "samples/sample1.mkv");
  const sampleMp3 = path.join(__dirname, "samples/sample1.mp3");
  const tempFiles: string[] = [];

  // bump jest timeout since file ops can take some time
  jest.setTimeout(30000);

  function getTempFile(extension: string): string {
    const file = tmpFile({ extension });
    tempFiles.push(file);
    return file;
  }

  afterAll(async () => {
    // Clean up temp files
    await waitFile({ resources: tempFiles });
    await Promise.allSettled(tempFiles.map(unlink));
  });

  it("should initialize", () => {
    const ffmpeg = new FFmpeg();
    expect(ffmpeg).toBeInstanceOf(FFmpeg);
  });

  it("should copy sample.mp4 to temp file", (done) => {
    const ffmpeg = new FFmpeg();
    const tempFile = getTempFile("mp4");
    ffmpeg
      .setInput(sampleMp4)
      .setOutputOptions(["-c copy"])
      .setOutput(tempFile)
      .run();

    ffmpeg.on("done", async () => {
      await waitFile({ resources: [tempFile] });
      const tempStats = await stat(tempFile);
      expect(tempStats.size).toBeGreaterThan(0);
    });

    ffmpeg.on("exit", async (exitCode, error) => {
      expect(exitCode).toBe(0);
      expect(error).toBeUndefined();
      done();
    });
  });

  it("should stream sample1.mkv to temp file", async () => {
    const tempFile = getTempFile("mkv");
    const ffmpeg = new FFmpeg({
      autorun: true,
      input: createReadStream(sampleMkv),
      inputOptions: ["-f matroska"],
      output: createWriteStream(tempFile),
      outputOptions: ["-f matroska", "-c copy"],
    });
    await ffmpeg.done();
    await waitFile({ resources: [tempFile] });
    const pipedStats = await stat(tempFile);
    expect(pipedStats.size).toBeGreaterThan(0);
  });

  it("should stream sample1.mp3 to temp file", async () => {
    const tempFile = getTempFile("mp3");
    const ffmpeg = new FFmpeg({
      autorun: true,
      input: createReadStream(sampleMp3),
      inputOptions: ["-f mp3"],
      output: createWriteStream(tempFile),
      outputOptions: ["-f mp3", "-c copy"],
    });
    await ffmpeg.done();
    await waitFile({ resources: [tempFile] });
    const pipedStats = await stat(tempFile);
    expect(pipedStats.size).toBeGreaterThan(0);
  });

  it("should receive progress event", (done) => {
    expect.assertions(11);
    const tempFile = getTempFile("mp4");
    const ffmpeg = new FFmpeg();
    ffmpeg
      .setInput(sampleMp4)
      .setOutputOptions(["-c copy"])
      .setOutput(tempFile)
      .run();

    ffmpeg.on("progress", async (e) => {
      expect(e.frame).toBeGreaterThan(0);
      expect(e.fps).toBeDefined();
      expect(e.q).toBeDefined();
      expect(e.size).toBe(1055744);
      expect(e.time).toBeGreaterThan(0);
      expect(e.bitrate).toBeGreaterThan(0);
      expect(e.duplicates).toBeDefined();
      expect(e.dropped).toBeDefined();
      expect(e.speed).toBeGreaterThan(0);
      expect(e.duration).toBeDefined();
      expect(e.percent).toBeGreaterThan(0);
    });

    ffmpeg.on("exit", async () => {
      done();
    });
  });

  describe("toStream()", () => {
    it("should pipe to piped.mkv", async () => {
      const tempFile = getTempFile("mkv");
      const ffmpeg = new FFmpeg({
        autorun: true,
        input: sampleMp4,
        pipe: true,
        outputOptions: ["-f matroska"],
      });

      const stream = ffmpeg.toStream();
      stream.pipe(createWriteStream(tempFile));
      await ffmpeg.done();
      await waitFile({ resources: [tempFile] });
      const pipedStats = await stat(tempFile);
      expect(pipedStats.size).toBeGreaterThan(0);
    });
  });

  describe("probe", () => {
    it("should probe sample.mp4", async () => {
      expect.assertions(5);
      const result = await FFmpeg.probe(sampleMp4);
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBe(2);
      expect(result.format.duration).toBe("5.312000");
      expect(result.streams.length).toBeGreaterThan(0);
      expect(result.streams[0].codec_name).toBe("h264");
    });

    it("should throw error if failed", (done) => {
      expect.assertions(1);
      FFmpeg.probe("path_does_not_exist").catch((e) => {
        expect(e.message).toBe("Failed to probe");
        done();
      });
    });
  });
});
