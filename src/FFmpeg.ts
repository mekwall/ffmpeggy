import EventEmitter from "events";
import { ReadStream, WriteStream } from "fs";
import { PassThrough } from "stream";
import createDebug from "debug";
import execa from "execa";
import TypedEmitter from "typed-emitter";
import { parseInfo, parseWriting, parseProgress } from "./parsers";
import { FFmpegProgress } from "./types/FFmpegProgress";
import { FFprobeResult } from "./types/probeTypes";

export interface FFMpegOptions {
  cwd?: string;
  input?: string | ReadStream;
  output?: string | WriteStream;
  pipe?: boolean;
  globalOptions?: string[];
  inputOptions?: string[];
  outputOptions?: string[];
  autorun?: boolean;
}

type FFmpegProgressEvent = FFmpegProgress & {
  duration?: number;
  percent?: number;
};

interface FFmpegEvents {
  start: (ffmpegArgs: readonly string[]) => void;
  error: (error: Error) => void;
  done: (file?: string) => void;
  exit: (code?: number | null, error?: Error) => void;
  probe: (probeResult: FFprobeResult) => void;
  progress: (progress: FFmpegProgressEvent) => void;
  writing: (file: string) => void;
}

const debug = createDebug("ffmpeggy");
export class FFmpeg extends (EventEmitter as new () => TypedEmitter<FFmpegEvents>) {
  public running = false;
  public status?: execa.ExecaReturnValue;
  public process?: execa.ExecaChildProcess;
  public error?: Error;
  public currentFile?: string;
  public input: string | ReadStream = "";
  public outputOptions: string[] = [];
  public inputOptions: string[] = [];
  public globalOptions: string[] = [];

  // set from DefaultConfig in constructor
  public ffmpegBin!: string;
  public ffprobeBin!: string;
  public cwd!: string;
  public output!: string | WriteStream;
  public overwriteExisting!: boolean;

  public static DefaultConfig = {
    cwd: process.cwd(),
    output: "",
    overwriteExisting: false,
    ffmpegBin: "",
    ffprobeBin: "",
    ffprobeArgs: [
      "-hide_banner",
      "-show_format",
      "-show_streams",
      "-print_format",
      "json",
      "-loglevel",
      "quiet",
    ],
  };

  private log = "";
  private pipedOutput = false;
  private outputStream = new PassThrough();

  public constructor(opts: FFMpegOptions = {}) {
    super();
    Object.assign(this, FFmpeg.DefaultConfig);
    if (opts.cwd) {
      this.cwd = opts.cwd;
    }
    if (opts.input) {
      this.input = opts.input;
    }
    if (opts.output) {
      this.output = opts.output;
    }
    if (opts.pipe) {
      this.output = "-";
    }
    if (opts.globalOptions) {
      this.globalOptions = opts.globalOptions;
    }
    if (opts.inputOptions) {
      this.inputOptions = opts.inputOptions;
    }
    if (opts.outputOptions) {
      this.outputOptions = opts.outputOptions;
    }
    if (opts.autorun) {
      this.run();
    }
  }

  public async run(): Promise<execa.ExecaChildProcess<string> | undefined> {
    // Return any existing process
    if (this.process) {
      debug("returning existing process");
      return this.process;
    }

    const {
      cwd,
      input,
      output,
      ffmpegBin,
      globalOptions,
      inputOptions,
      outputOptions,
    } = this;

    if (!ffmpegBin) {
      throw Error("Missing path to ffmpeg binary");
    }

    if (!input) {
      throw new Error("No input specified");
    }

    if (!output) {
      throw new Error("No output specified");
    }

    const ffmpegInput = input instanceof ReadStream ? "pipe:" : input;
    const ffmpegOutput = output instanceof WriteStream ? "pipe:" : output;

    const args = [
      ...(this.overwriteExisting ? ["-y"] : []),
      ...globalOptions.join(" ").split(" "),
      ...inputOptions.join(" ").split(" "),
      ...["-i", ffmpegInput],
      ...outputOptions.join(" ").split(" "),
      ffmpegOutput,
    ].filter((a) => !!a);

    if (ffmpegOutput.startsWith("pipe:") || output === "-") {
      this.pipedOutput = true;
    } else if (!ffmpegOutput.includes("%d")) {
      this.currentFile = ffmpegOutput;
    }

    const joinedArgs: readonly string[] = args;
    try {
      this.emit("start", joinedArgs);
      debug("bin: %s", ffmpegBin);
      debug("args: %o", joinedArgs);

      if (input instanceof ReadStream) {
        // We need to wait for the input stream to open before we can pass it
        // More info: https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_options_stdio
        await new Promise((resolve) => {
          input.on("open", resolve);
        });
      }

      if (output instanceof WriteStream) {
        // We need to wait for the output stream to open before we can pass it
        // More info:https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_options_stdio
        await new Promise((resolve) => {
          output.on("open", resolve);
        });
      }

      this.process = execa(ffmpegBin, joinedArgs, {
        cwd,
        input: input instanceof ReadStream ? input : undefined,
        stdout: output instanceof WriteStream ? output : undefined,
      });

      // if (this.process.stdin && input instanceof ReadStream) {
      //   input.pipe(this.process.stdin);
      // }

      if (this.process.stdout && output instanceof WriteStream) {
        this.process.stdout.pipe(output);
      }

      if (this.pipedOutput) {
        this.process.stdout?.pipe(this.outputStream);
      }

      this.running = true;
    } catch (e) {
      this.error = e;
      debug("error: %o", e);
      this.emit("error", e);
      this.emit("exit");
      this.running = false;
    }

    this.awaitStatus();
    this.parseOutput();
    return this.process;
  }

  private async parseOutput() {
    // ffmpeg uses stdout for piping and stderr for messages
    const output = this.process?.stderr;
    if (output) {
      let duration = 0;
      output.on("data", (data) => {
        const txt = data.toString();
        if (!duration) {
          const info = parseInfo(txt);
          if (info) {
            debug("info: %o", info);
            duration = info.duration;
          }
        }
        const progress = parseProgress(txt);
        if (progress) {
          const progressEvent: FFmpegProgressEvent = {
            ...progress,
            duration,
            percent: Math.min(
              100,
              Math.round((progress.time / duration) * 100 * 100) / 100
            ),
          };
          debug("progress: %o", progressEvent);
          this.emit("progress", progressEvent);
        }
        const writing = parseWriting(txt);
        if (writing) {
          if (this.currentFile && !writing.includes("%d")) {
            debug("done: %o", this.currentFile);
            this.emit("done", this.currentFile);
          }
          this.currentFile = writing;
          debug("writing: %o", writing);
          this.emit("writing", writing);
        }
        this.log += txt;
      });
    }
  }

  private async awaitStatus() {
    if (this.process) {
      const status = await this.process;
      const code = this.process.exitCode;
      if (code === 1) {
        console.error("FFMPeg failed:", this.log);
      } else {
        debug("done: %s", this.currentFile);
        this.emit("done", this.currentFile);
      }
      this.status = status;
      this.process = undefined;
      this.running = false;
      debug("exit: %o %o", code, this.error);
      this.emit("exit", code, this.error);
    }
  }

  public async stop(signal = 15): Promise<void> {
    // 2 is SIGINT, 9 is SIGKILL, 15 is SIGTERM
    if (this.running && this.process) {
      try {
        this.process.kill(signal);
        await this.process.finally();
      } catch (e) {
        this.emit("exit", process.exitCode, this.error);
      }
    }
    this.process = undefined;
    this.running = false;
  }

  public async done(): Promise<void> {
    if (this.running) {
      await this.process;
    }
  }

  public setOverwriteExisting(overwriteExisting: boolean): FFmpeg {
    this.overwriteExisting = overwriteExisting;
    return this;
  }

  public setCwd(cwd: string): FFmpeg {
    this.cwd = cwd;
    return this;
  }

  public setInput(input: string): FFmpeg {
    this.input = input;
    return this;
  }

  public setOutput(output: string): FFmpeg {
    this.output = output;
    return this;
  }

  public setGlobalOptions(opts: string[]): FFmpeg {
    this.globalOptions = [...this.globalOptions, ...opts];
    return this;
  }

  public setInputOptions(opts: string[]): FFmpeg {
    this.inputOptions = [...this.inputOptions, ...opts];
    return this;
  }

  public setOutputOptions(opts: string[]): FFmpeg {
    this.outputOptions = [...this.outputOptions, ...opts];
    return this;
  }

  public async reset(): Promise<void> {
    if (this.process) {
      await this.stop(15);
    }
    this.input = "";
    this.globalOptions = [];
    this.inputOptions = [];
    this.outputOptions = [];
    this.outputStream = new PassThrough();
    this.error = undefined;
    Object.assign(this, FFmpeg.DefaultConfig);
  }

  public toStream(): PassThrough {
    return this.outputStream;
  }

  public async probe(): Promise<FFprobeResult> {
    const { input } = this;
    if (!input) {
      throw new Error("No input file specified");
    }
    if (typeof input !== "string") {
      throw new Error("Probe can only accept strings. Use static FFmpeg.probe() directly.");
    }
    const result = await FFmpeg.probe(input);
    return result;
  }

  public static async probe(filePath: string): Promise<FFprobeResult> {
    const args = [...FFmpeg.DefaultConfig.ffprobeArgs, filePath];
    try {
      const binPath = FFmpeg.DefaultConfig.ffprobeBin;
      if (!binPath) {
        throw Error("Missing path to ffprobe binary");
      }
      const { stdout, exitCode } = await execa(
        FFmpeg.DefaultConfig.ffprobeBin,
        args
      );
      if (exitCode === 1) {
        throw Error("Failed to probe");
      }
      try {
        return JSON.parse(stdout) as FFprobeResult;
      } catch {
        throw Error("Failed to parse ffprobe output");
      }
    } catch (e) {
      throw Error("Failed to probe");
    }
  }
}
