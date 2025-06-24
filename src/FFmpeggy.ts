import EventEmitter from "events";
import { ReadStream, WriteStream } from "fs";
import { nextTick } from "process";
import { PassThrough } from "stream";
import { pipeline } from "stream/promises";
import createDebug from "debug";
import {
  execa,
  type ExecaReturnValue,
  type ExecaChildProcess,
} from "@esm2cjs/execa";
import TypedEmitter from "typed-emitter";
import {
  parseInfo,
  parseWriting,
  parseProgress,
  parseFinalSizes,
} from "./parsers";
import { FFmpeggyProgress, FFmpeggyFinalSizes } from "./types/FFmpeggyProgress";
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

const DEFAULT_STREAM_OPEN_TIMEOUT_MS = 5000;

export type FFmpeggyProgressEvent = FFmpeggyProgress & {
  duration?: number;
  percent?: number;
};

type FFmpegEvents = {
  error: (error: Error) => void;
  start: (ffmpegArgs: readonly string[]) => void;
  done: (file?: string, sizes?: FFmpeggyFinalSizes) => void;
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
  private finalSizes?: FFmpeggyFinalSizes;
  private shouldAutorun = false;

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
      this.shouldAutorun = true;
      // Don't call run() immediately - wait until the binary is set
      nextTick(() => {
        if (this.shouldAutorun && this.ffmpegBin) {
          this.run();
        }
      });
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

    // Handle input: if it's a ReadStream, use "pipe:", otherwise use the file path
    const ffmpegInput = input instanceof ReadStream ? "pipe:" : input;

    // Handle output: if it's a WriteStream or pipe is set, use "pipe:", otherwise use the file path
    const ffmpegOutput =
      output instanceof WriteStream || output === "-" ? "pipe:" : output;

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

    // Set pipedOutput flag for stream handling
    if (ffmpegOutput === "pipe:" || output === "-") {
      this.pipedOutput = true;
    } else if (
      typeof ffmpegOutput === "string" &&
      !ffmpegOutput.includes("%d")
    ) {
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
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for input stream to open"));
          }, DEFAULT_STREAM_OPEN_TIMEOUT_MS);

          input.once("open", () => {
            clearTimeout(timeout);
            resolve(undefined);
          });

          input.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      if (output instanceof WriteStream) {
        // We need to wait for the output stream to open before we can pass it
        // More info:https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_options_stdio
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for output stream to open"));
          }, DEFAULT_STREAM_OPEN_TIMEOUT_MS);

          output.once("open", () => {
            clearTimeout(timeout);
            resolve(undefined);
          });

          output.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      this.process = execa(ffmpegBin, joinedArgs, {
        cwd,
        input: input instanceof ReadStream ? input : undefined,
        stdout: output instanceof WriteStream ? output : undefined,
        reject: false,
      });

      // Use pipeline for robust stream handling when output is a WriteStream
      if (this.process.stdout && output instanceof WriteStream) {
        // Pipeline will handle proper cleanup and error propagation
        pipeline(this.process.stdout, output).catch((err) => {
          debug("Pipeline error: %o", err);
          this.error = err;
          this.emit("error", err);
        });
      }

      // Use pipeline for piped output to PassThrough stream
      if (this.pipedOutput && this.process.stdout) {
        pipeline(this.process.stdout, this.outputStream).catch((err) => {
          debug("Pipeline error for piped output: %o", err);
          this.error = err;
          this.emit("error", err);
        });
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
            this.emit("done", this.currentFile, this.finalSizes);
          }
          this.currentFile = writing;
          debug("writing: %o", writing);
          this.emit("writing", writing);
        }
        const finalSizes = parseFinalSizes(txt);
        if (finalSizes) {
          this.finalSizes = finalSizes;
          debug("final sizes: %o", finalSizes);
        }
        this.log += txt;
      });
    }
  }

  private async awaitStatus() {
    if (this.process) {
      try {
        this.status = await this.process;
        // Store the process reference and exit code before clearing it
        const processRef = this.process;
        const code = processRef.exitCode;

        if (code === 1) {
          console.error("FFmpeg failed:", this.log);
          // Extract concise error information from the log
          const conciseError = this.extractConciseError(this.log);
          this.error = new Error(
            `FFmpeg failed with exit code ${code}: ${conciseError}`
          );
        } else {
          debug("done: %s", this.currentFile);
          this.emit("done", this.currentFile, this.finalSizes);
        }

        // Cleanup and emit exit event in next tick
        await this.cleanupAndEmitExit(code);
      } catch (error) {
        // Handle process errors
        this.error = error as Error;
        debug("process error in awaitStatus: %o", error);

        // Cleanup and emit exit event in next tick
        await this.cleanupAndEmitExit(null);
      }
    }
  }

  private async cleanupAndEmitExit(code: number | null): Promise<void> {
    return new Promise<void>((resolve) => {
      nextTick(() => {
        this.process = undefined;
        this.running = false;
        debug("exit: %o %o", code, this.error);
        this.emit("exit", code, this.error);
        resolve();
      });
    });
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

  public async done(): Promise<{ file?: string; sizes?: FFmpeggyFinalSizes }> {
    if (this.running && this.process) {
      try {
        await this.process;
      } catch (error) {
        // Handle process errors
        this.error = error as Error;
        debug("process error: %o", error);
      } finally {
        // Always clear the state when done, regardless of success or failure
        this.running = false;
        this.process = undefined;
      }
    }

    // For streaming operations, file is undefined since we're writing to a stream
    // For file operations, return the currentFile
    const file =
      this.output instanceof WriteStream
        ? undefined
        : this.currentFile || this.output;

    // Return the same information as the done event
    return { file, sizes: this.finalSizes };
  }

  public async exit(): Promise<{ code?: number | null; error?: Error }> {
    if (this.running && this.process) {
      // Wait for the process to complete
      await this.process;
    }

    // Return the current status
    return { code: this.status?.exitCode, error: this.error };
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

  public triggerAutorun(): FFmpeggy {
    if (this.shouldAutorun && this.ffmpegBin && !this.running) {
      this.run();
    }
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
    this.finalSizes = undefined;
    this.shouldAutorun = false;
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

  private extractConciseError(
    log: string,
    maxLines = 3,
    maxLength = 250
  ): string {
    if (!log) {
      return "Unknown error (log is empty)";
    }

    // Split log into lines
    const lines = log.trim().split("\n");
    if (!lines.length) {
      return "Unknown error (log has no content)";
    }

    // Common error keywords
    const errorKeywords = [
      "error",
      "invalid",
      "fail",
      "could not",
      "no such",
      "denied",
      "unsupported",
      "unable",
      "can't open",
      "conversion failed",
      "not found",
      "permission",
    ];

    // Look at the last few lines (default is 3 lines)
    const start = Math.max(0, lines.length - maxLines);
    for (let i = lines.length - 1; i >= start; i--) {
      const line = lines[i].trim();
      if (!line) continue;

      // If this line contains a keyword, it's likely what we're looking for
      if (
        errorKeywords.some((keyword) => line.toLowerCase().includes(keyword))
      ) {
        // Add the previous line for context if it exists
        if (i > 0 && lines[i - 1].trim()) {
          const result = `${lines[i - 1].trim()}\n${line}`;
          return result.length > maxLength
            ? result.substring(0, maxLength) + "..."
            : result;
        }
        return line.length > maxLength
          ? line.substring(0, maxLength) + "..."
          : line;
      }
    }

    // If no keywords are found, take the last non-empty line
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line) {
        return line.length > maxLength
          ? line.substring(0, maxLength) + "..."
          : line;
      }
    }

    return "Unknown error (no specific problem found)";
  }
}
