import EventEmitter from "events";
import { ReadStream, WriteStream } from "fs";
import { nextTick } from "process";
import { PassThrough } from "stream";
import createDebug from "debug";
import {
  execa,
  type ExecaReturnValue,
  type ExecaChildProcess,
} from "@esm2cjs/execa";
import TypedEmitter from "typed-emitter";
import { parseInfo, parseWriting, parseProgress } from "./parsers";
import { FFmpeggyProgress } from "./types/FFmpeggyProgress";
import { FFprobeResult } from "./types/probeTypes";
import { parseOptions } from "./utils/parseOptions";

export interface FFmpeggyOptions {
  cwd?: string;
  input?: string | ReadStream;
  output?: string | WriteStream;
  pipe?: boolean;
  globalOptions?: string[];
  inputOptions?: string[];
  outputOptions?: string[];
  overwriteExisting?: boolean;
  hideBanner?: boolean;
  autorun?: boolean;
}

export type FFmpeggyProgressEvent = FFmpeggyProgress & {
  duration?: number;
  percent?: number;
};

type FFmpegEvents = {
  error: (error: Error) => void;
  start: (ffmpegArgs: readonly string[]) => void;
  done: (file?: string) => void;
  exit: (code?: number | null, error?: Error) => void;
  probe: (probeResult: FFprobeResult) => void;
  progress: (progress: FFmpeggyProgressEvent) => void;
  writing: (file: string) => void;
};

const debug = createDebug("ffmpeggy");
export class FFmpeggy extends (EventEmitter as new () => TypedEmitter<FFmpegEvents>) {
  public running = false;
  public status?: ExecaReturnValue;
  public process?: ExecaChildProcess;
  public error?: Error;
  public currentFile?: string;
  public input: string | ReadStream = "";
  public outputOptions: string[] = [];
  public inputOptions: string[] = [];
  public globalOptions: string[] = ["-stats"];

  // set from DefaultConfig in constructor
  public ffmpegBin!: string;
  public ffprobeBin!: string;
  public cwd!: string;
  public output!: string | WriteStream;
  public overwriteExisting!: boolean;
  public hideBanner!: boolean;

  public static DefaultConfig = {
    cwd: process.cwd(),
    output: "",
    overwriteExisting: false,
    hideBanner: true,
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

  public log = "";
  private pipedOutput = false;
  private outputStream = new PassThrough();

  public constructor(opts: FFmpeggyOptions = {}) {
    super();
    Object.assign(this, FFmpeggy.DefaultConfig);
    if (opts.cwd) {
      this.cwd = opts.cwd;
    }
    if (opts.input) {
      this.input = opts.input;
    }
    if (opts.output) {
      this.output = opts.output;
    }
    if (typeof opts.pipe !== "undefined") {
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
    if (typeof opts.overwriteExisting !== "undefined") {
      this.overwriteExisting = opts.overwriteExisting;
    }
    if (typeof opts.hideBanner !== "undefined") {
      this.hideBanner = opts.hideBanner;
    }
    if (opts.autorun) {
      this.run();
    }
  }

  public async run(): Promise<ExecaChildProcess | undefined> {
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

    if (this.hideBanner) {
      globalOptions.push("-hide_banner");
    }

    if (this.overwriteExisting) {
      globalOptions.push("-y");
    }

    const args = [
      ...parseOptions(globalOptions),
      ...parseOptions(inputOptions),
      ...["-i", ffmpegInput],
      ...parseOptions(outputOptions),
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
        reject: false,
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
    } catch (err) {
      const e = err as Error;
      this.error = e;
      debug("error: %o", e);
      this.emit("error", e);
      this.emit("exit", 1, e);
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
        debug(txt);
        if (!duration) {
          const info = parseInfo(txt);
          if (info) {
            debug("info: %o", info);
            if (info.duration) {
              duration = info.duration;
            }
          }
        }
        const progress = parseProgress(txt);
        if (progress) {
          const progressEvent: FFmpeggyProgressEvent = {
            ...progress,
            duration,
            percent: Math.min(
              100,
              progress.time
                ? Math.round((progress.time / duration) * 100 * 100) / 100
                : 0
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
        console.error("FFmpeg failed:", this.log);
      } else {
        debug("done: %s", this.currentFile);
        this.emit("done", this.currentFile);
      }
      nextTick(() => {
        // Wait until next tick to emit the exit event
        // This is to ensure that the done event is emitted
        // before the exit event
        this.status = status;
        this.process = undefined;
        this.running = false;
        debug("exit: %o %o", code, this.error);
        this.emit("exit", code, this.error);
      });
    }
  }

  public async stop(signal = 15): Promise<void> {
    // 2 is SIGINT, 9 is SIGKILL, 15 is SIGTERM
    if (this.running && this.process) {
      try {
        this.process.kill(signal);
        await this.process.finally();
      } catch {
        this.emit(
          "exit",
          typeof process.exitCode === "number" ? process.exitCode : null,
          this.error
        );
      }
    }
    this.process = undefined;
    this.running = false;
  }

  public async done(): Promise<void> {
    if (this.running && this.process) {
      await this.process;
    }
  }

  public setCwd(cwd: string): FFmpeggy {
    this.cwd = cwd;
    return this;
  }

  public setOverwriteExisting(overwriteExisting: boolean): FFmpeggy {
    this.overwriteExisting = overwriteExisting;
    return this;
  }

  public setPipe(pipe: boolean): FFmpeggy {
    if (pipe) {
      this.output = "-";
    }
    return this;
  }

  public setHideBanner(hideBanner: boolean): FFmpeggy {
    this.hideBanner = hideBanner;
    return this;
  }

  public setInput(input: string): FFmpeggy {
    this.input = input;
    return this;
  }

  public setOutput(output: string): FFmpeggy {
    this.output = output;
    return this;
  }

  public setGlobalOptions(opts: string[]): FFmpeggy {
    this.globalOptions = [...this.globalOptions, ...opts];
    return this;
  }

  public setInputOptions(opts: string[]): FFmpeggy {
    this.inputOptions = [...this.inputOptions, ...opts];
    return this;
  }

  public setOutputOptions(opts: string[]): FFmpeggy {
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
    Object.assign(this, FFmpeggy.DefaultConfig);
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
      throw new Error(
        "Probe can only accept strings. Use static FFmpeg.probe() directly."
      );
    }
    const result = await FFmpeggy.probe(input);
    return result;
  }

  public static async probe(filePath: string): Promise<FFprobeResult> {
    const args = [...FFmpeggy.DefaultConfig.ffprobeArgs, filePath];
    try {
      const binPath = FFmpeggy.DefaultConfig.ffprobeBin;
      if (!binPath) {
        throw Error("Missing path to ffprobe binary");
      }
      const { stdout, exitCode } = await execa(
        FFmpeggy.DefaultConfig.ffprobeBin,
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
    } catch {
      throw Error("Failed to probe");
    }
  }
}
