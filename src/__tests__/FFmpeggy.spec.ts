import { createWriteStream, createReadStream } from "fs";
import { mkdir, rm, unlink, stat } from "fs/promises";
import path from "path";
import ffmpegBin from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";
import { file as tmpFile } from "tempy";
import { FFmpeggy, FFmpeggyProgressEvent } from "../FFmpeggy";
import { waitFiles } from "./utils/waitFiles";

FFmpeggy.DefaultConfig = {
  ...FFmpeggy.DefaultConfig,
  overwriteExisting: true,
  ffprobeBin,
  ffmpegBin,
};

describe("FFmpeggy", () => {
  const sampleMkv = path.join(__dirname, "samples/bunny1.mkv");
  const sampleMp4 = path.join(__dirname, "samples/bunny2.mp4");
  const sampleMp3 = path.join(__dirname, "samples/audio.mp3");
  const tempFiles: string[] = [];

  // bump jest timeout since file operations can take some time (especially on CI)
  jest.setTimeout(60000);

  function getTempFile(extension: string): string {
    const file = tmpFile({ extension });
    tempFiles.push(file);
    return file;
  }

  beforeAll(async () => {
    try {
      await mkdir(path.join(__dirname, "samples/.temp/"));
    } catch {
      // Ignore
    }
  });

  afterAll(async () => {
    // Clean up temp files
    if (tempFiles.length > 0) {
      await waitFiles(tempFiles);
      await Promise.allSettled(tempFiles.map(unlink));
    }
    try {
      await rm(path.join(__dirname, "samples/.temp/"), { recursive: true });
    } catch {
      // Ignore
    }
  });

  it("should initialize", () => {
    const ffmpeggy = new FFmpeggy();
    expect(ffmpeggy).toBeInstanceOf(FFmpeggy);
  });

  it("should pass in options in constructor", () => {
    const ffmpeggy = new FFmpeggy({
      cwd: __dirname,
      overwriteExisting: false,
      pipe: true,
      hideBanner: false,
      globalOptions: ["-max_alloc 1024", "-vol 512"],
    });
    const go = ffmpeggy.globalOptions;
    expect(ffmpeggy.cwd).toBe(__dirname);
    expect(ffmpeggy.overwriteExisting).toBe(false);
    expect(ffmpeggy.output).toBe("-"); // pipe = true
    expect(ffmpeggy.hideBanner).toBe(false);
    expect(go.includes("-max_alloc 1024")).toBe(true);
    expect(go.includes("-vol 512")).toBe(true);
  });

  it("should set options with methods", () => {
    const ffmpeggy = new FFmpeggy();

    ffmpeggy.setCwd(__dirname);
    expect(ffmpeggy.cwd).toBe(__dirname);

    ffmpeggy.setOverwriteExisting(false);
    expect(ffmpeggy.overwriteExisting).toBe(false);

    ffmpeggy.setPipe(true); // output = "-"
    expect(ffmpeggy.output).toBe("-"); // pipe = true

    ffmpeggy.setHideBanner(false);
    expect(ffmpeggy.hideBanner).toBe(false);

    ffmpeggy.setGlobalOptions(["-max_alloc 1024", "-vol 512"]);
    expect(ffmpeggy.globalOptions.includes("-max_alloc 1024")).toBe(true);
    expect(ffmpeggy.globalOptions.includes("-vol 512")).toBe(true);

    ffmpeggy.setInputOptions([`-i ${sampleMp4}`]);
    expect(ffmpeggy.inputOptions.includes(`-i ${sampleMp4}`)).toBe(true);

    ffmpeggy.setOutputOptions(["-f mp4", "-c:v libx264"]);
    expect(ffmpeggy.outputOptions.includes("-f mp4")).toBe(true);
    expect(ffmpeggy.outputOptions.includes("-c:v libx264")).toBe(true);
  });

  it("should copy bunny2.mp4 to temp file", (done) => {
    const ffmpeggy = new FFmpeggy();
    const tempFile = getTempFile("mp4");
    ffmpeggy
      .setInput(sampleMp4)
      .setOutputOptions(["-c copy"])
      .setOutput(tempFile)
      .run();

    ffmpeggy.on("done", async () => {
      await waitFiles([tempFile]);
      const tempStats = await stat(tempFile);
      expect(tempStats.size).toBeGreaterThan(0);
    });

    ffmpeggy.on("exit", async (exitCode, error) => {
      expect(exitCode).toBe(0);
      expect(error).toBeUndefined();
      done();
    });
  });

  it("should stream bunny1.mkv to temp file", async () => {
    const tempFile = getTempFile("mkv");
    const ffmpeggy = new FFmpeggy({
      autorun: true,
      input: createReadStream(sampleMkv),
      inputOptions: ["-f matroska"],
      output: createWriteStream(tempFile),
      outputOptions: ["-f matroska", "-c copy"],
    });
    await ffmpeggy.done();
    await waitFiles([tempFile]);
    const pipedStats = await stat(tempFile);
    expect(pipedStats.size).toBeGreaterThan(0);
  });

  it("should stream audio.mp3 to temp file", async () => {
    const tempFile = getTempFile("mp3");
    const ffmpeggy = new FFmpeggy({
      autorun: true,
      input: createReadStream(sampleMp3),
      inputOptions: ["-f mp3"],
      output: createWriteStream(tempFile),
      outputOptions: ["-f mp3", "-c copy"],
    });
    await ffmpeggy.done();
    await waitFiles([tempFile]);
    const pipedStats = await stat(tempFile);
    expect(pipedStats.size).toBeGreaterThan(0);
  });

  it("should receive progress event", (done) => {
    expect.assertions(9);
    const tempFile = getTempFile("mkv");
    const ffmpeggy = new FFmpeggy();
    ffmpeggy
      .setInput(sampleMp4)
      .setOutputOptions(["-c:v libx264", "-c:a aac", "-f matroska"])
      .setOutput(tempFile)
      .run();

    let progress: FFmpeggyProgressEvent;
    ffmpeggy.on("progress", async (p) => {
      progress = p;
    });

    ffmpeggy.on("exit", async (code, error) => {
      expect(progress.frame).toBeGreaterThan(0);
      expect(progress.fps).toBeDefined();
      expect(progress.q).toBeDefined();
      expect(progress.size).toBeGreaterThan(0);
      expect(progress.time).toBeGreaterThan(0);
      expect(progress.bitrate).toBeGreaterThan(0);
      expect(progress.speed).toBeGreaterThan(0);
      expect(progress.duration).toBeDefined();
      expect(progress.percent).toBeGreaterThan(0);

      if (code === 1 || error) {
        done.fail(error);
      } else {
        done();
      }
    });
  });

  it("should emit writing and done events for segments", (done) => {
    // expect.assertions(10);
    const segmentCount = 3;
    const ffmpeggy = new FFmpeggy({
      input: sampleMkv,
      output: path.join(__dirname, "samples/.temp/temp-%d.mpegts"),
      outputOptions: [
        `-t ${segmentCount}`,
        "-map 0",
        "-c:v libx264",
        "-c:a aac",
        "-force_key_frames expr:gte(t,n_forced*1)",
        "-f ssegment",
        "-forced-idr 1",
        "-flags +cgop",
        "-copyts",
        "-vsync -1",
        "-avoid_negative_ts disabled",
        "-individual_header_trailer 0",
        "-start_at_zero",
        "-segment_list_type m3u8",
        `-segment_list ${path.join(__dirname, "samples/.temp/playlist.m3u8")}`,
        "-segment_time 1",
        "-segment_format mpegts",
      ],
    });

    const segments = new Array(segmentCount)
      .fill(undefined)
      .map((_v, idx) =>
        path.join(__dirname, "samples/.temp/", `temp-${idx}.mpegts`)
      );

    let writingEvents = 0;
    ffmpeggy.on("writing", (file) => {
      if (file.includes("temp-")) {
        expect(segments.includes(file)).toBe(true);
        writingEvents++;
      }
    });

    let doneEvents = 0;
    ffmpeggy.on("done", (file) => {
      if (file?.includes("temp-")) {
        expect(segments.includes(file)).toBe(true);
        doneEvents++;
      }
    });

    ffmpeggy.on("exit", (code, error) => {
      if (code === 1 || error) {
        done.fail(error);
      } else {
        expect(writingEvents).toBeGreaterThan(0);
        expect(doneEvents).toBeGreaterThan(0);
        done();
      }
    });

    ffmpeggy.run();
  });

  it("should return existing process", () => {
    const ffmpeggy = new FFmpeggy();
    const tempFile = getTempFile("mp4");
    const process = ffmpeggy
      .setInput(sampleMp4)
      .setOutputOptions(["-c copy"])
      .setOutput(tempFile)
      .run();
    expect(ffmpeggy.run()).toEqual(process);
  });

  describe("toStream()", () => {
    it("should pipe to piped.mkv", async () => {
      const tempFile = getTempFile("mkv");
      const ffmpeg = new FFmpeggy({
        autorun: true,
        input: sampleMp4,
        pipe: true,
        outputOptions: ["-f matroska"],
      });

      const stream = ffmpeg.toStream();
      stream.pipe(createWriteStream(tempFile));
      await ffmpeg.done();
      await waitFiles([tempFile]);
      const pipedStats = await stat(tempFile);
      expect(pipedStats.size).toBeGreaterThan(0);
    });
  });

  describe("reset()", () => {
    it("should be possible to reuse instance", async () => {
      expect.assertions(2);
      const ffmpeggy = new FFmpeggy();
      const tempFile1 = getTempFile("mp4");
      await ffmpeggy
        .setInput(sampleMp4)
        .setOutputOptions(["-c copy"])
        .setOutput(tempFile1)
        .run();

      const tempStats1 = await stat(tempFile1);
      expect(tempStats1.size).toBeGreaterThan(0);

      ffmpeggy.reset();

      const tempFile2 = getTempFile("mp4");
      await ffmpeggy
        .setInput(sampleMp4)
        .setOutputOptions(["-c copy"])
        .setOutput(tempFile2)
        .run();

      const tempStats2 = await stat(tempFile2);
      expect(tempStats2.size).toBeGreaterThan(0);
    });
  });

  describe("probe()", () => {
    it("should probe bunny2.mp4", async () => {
      expect.assertions(5);
      const result = await FFmpeggy.probe(sampleMp4);
      expect(result.format).toBeDefined();
      expect(result.format.nb_streams).toBe(2);
      expect(result.format.duration).toBe("5.312000");
      expect(result.streams.length).toBeGreaterThan(0);
      expect(result.streams[0].codec_name).toBe("h264");
    });

    it("should throw error if failed", (done) => {
      expect.assertions(1);
      FFmpeggy.probe("path_does_not_exist").catch((e) => {
        expect(e.message).toBe("Failed to probe");
        done();
      });
    });
  });

  describe("run(): error handling", () => {
    it("should throw error if ffmpegBin is falsey", () => {
      const ffmpeggy = new FFmpeggy();
      ffmpeggy.ffmpegBin = "";
      const fn = async () => ffmpeggy.run();
      expect(fn).rejects.toThrow("Missing path to ffmpeg binary");
    });

    it("should throw error if input is falsey", () => {
      const ffmpeggy = new FFmpeggy({ input: "" });
      ffmpeggy.input = "";
      const fn = async () => ffmpeggy.run();
      expect(fn).rejects.toThrow("No input specified");
    });

    it("should throw error if output is falsey", () => {
      const ffmpeggy = new FFmpeggy({ input: "foo", output: "" });
      const fn = async () => ffmpeggy.run();
      expect(fn).rejects.toThrow("No output specified");
    });
  });
});
