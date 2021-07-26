import fs, { createWriteStream, createReadStream } from "fs";
import path from "path";
import { path as ffmpegBin } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobeBin } from "@ffprobe-installer/ffprobe";
import { FFmpeg } from "../FFmpeg";

const sampleMp4 = path.join(__dirname, "samples/sample1.mp4");
const sampleMkv = path.join(__dirname, "samples/sample1.mkv");
const sampleMp3 = path.join(__dirname, "samples/sample1.mp3");
const tempFile = path.join(__dirname, "temp.mkv");

// NOTE: "fs/promises" is not available in node 12
const { unlink, stat } = fs.promises;

FFmpeg.DefaultConfig = {
  ...FFmpeg.DefaultConfig,
  overwriteExisting: true,
  ffprobeBin,
  ffmpegBin
}

describe("FFmpeg", () => {
  it("should initialize", () => {
    const ffmpeg = new FFmpeg();
    expect(ffmpeg).toBeInstanceOf(FFmpeg);
  });

  it("should copy sample.mp4 to temp.mkv", (done) => {
    const ffmpeg = new FFmpeg();
    ffmpeg
      .setInput(sampleMp4)
      .setOutputOptions(["-c copy"])
      .setOutput(path.join(__dirname, "temp.mkv"))
      .run();

    ffmpeg.on("done", async () => {
      const tempStats = await stat(tempFile);
      await unlink(tempFile);
      expect(tempStats.size).toBeGreaterThan(0);
    });

    ffmpeg.on("exit", (exitCode, error) => {
      expect(exitCode).toBe(0);
      expect(error).toBeUndefined();
      done();
    });
  });

  it("should stream sample1.mkv to test.mkv", async () => {
    const testFile = path.join(__dirname, "test.mkv");
    const ffmpeg = new FFmpeg({
      autorun: true,
      input: createReadStream(sampleMkv),
      inputOptions: ["-f matroska"],
      output: createWriteStream(testFile),
      outputOptions: ["-f matroska", "-c copy"],
    });
    await ffmpeg.done();
    const pipedStats = await stat(testFile);
    await unlink(testFile);
    expect(pipedStats.size).toBeGreaterThan(0);
  });

  it("should stream sample1.mp3 to test.mp3", async () => {
    const testFile = path.join(__dirname, "test.mp3");
    const ffmpeg = new FFmpeg({
      autorun: true,
      input: createReadStream(sampleMp3),
      inputOptions: ["-f mp3"],
      output: createWriteStream(testFile),
      outputOptions: ["-f mp3", "-c copy"],
    });
    await ffmpeg.done();
    const pipedStats = await stat(testFile);
    await unlink(testFile);
    expect(pipedStats.size).toBeGreaterThan(0);
  });

  it("should receive progress event", (done) => {
    expect.assertions(11);
    const ffmpeg = new FFmpeg();
    ffmpeg
      .setInput(sampleMp4)
      .setOutputOptions(["-c copy"])
      .setOutput(path.join(__dirname, "temp.mkv"))
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

    ffmpeg.on("exit", () => {
      done();
    });
  });

  describe("toStream()", () => {
    it("should pipe to piped.mkv", async () => {
      const ffmpeg = new FFmpeg({
        autorun: true,
        input: sampleMp4,
        pipe: true,
        outputOptions: ["-f matroska"],
      });

      const stream = ffmpeg.toStream();
      const pipedFile = path.join(__dirname, "piped.mkv");
      stream.pipe(createWriteStream(pipedFile));
      await ffmpeg.done();
      const pipedStats = await stat(pipedFile);
      await unlink(pipedFile);
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
