import { access } from "fs/promises";
import { ReadStream, WriteStream } from "fs";
import { nextTick } from "process";
import { PassThrough } from "stream";
import { pipeline } from "stream/promises";

import {
  execa,
  type ExecaReturnValue,
  type ExecaChildProcess,
} from "@esm2cjs/execa";
import createDebug from "debug";
import EventEmitter from "events";

import {
  parseInfo,
  parseWriting,
  parseProgress,
  parseFinalSizes,
} from "#/parsers";
import type {
  FFmpeggyFinalSizes,
  FFmpeggyProgressEvent,
  FFmpeggyInput,
  FFmpeggyOptions,
  FFprobeResult,
  FFmpeggyOutputs,
  FileOutput,
  StreamOutput,
} from "#/types";
import { parseOptions } from "#/utils/parseOptions";

const DEFAULT_STREAM_OPEN_TIMEOUT_MS = 5000;

const debug = createDebug("ffmpeggy");

// Utility to sanitize error objects for logging (hide large/binary bufferedData)
function sanitizeErrorForLog(err: unknown): unknown {
  if (err && typeof err === "object") {
    const copy: Record<string, unknown> = { ...err };

    // Handle bufferedData that might be a Buffer or string
    if (copy.bufferedData) {
      if (Buffer.isBuffer(copy.bufferedData)) {
        copy.bufferedData = `<Buffer length=${
          (copy.bufferedData as Buffer).length
        } (hidden)>`;
      } else if (typeof copy.bufferedData === "string") {
        const str = copy.bufferedData as string;
        if (str.length > 100) {
          copy.bufferedData = `<String length=${str.length} (hidden)>`;
        }
      }
    }

    return copy;
  }
  return err;
}

/**
 * FFmpeggy is a Node.js wrapper for FFmpeg that provides a fluent API for video and audio processing.
 * It extends EventEmitter to provide real-time progress updates and status information.
 *
 * @example
 * ```typescript
 * import { FFmpeggy } from 'ffmpeggy';
 *
 * const ffmpeg = new FFmpeggy({
 *   input: 'input.mp4',
 *   output: 'output.mp4',
 *   outputOptions: ['-c:v', 'libx264', '-crf', '23']
 * });
 *
 * ffmpeg.on('progress', (progress) => {
 *   console.log(`Progress: ${progress.percent}%`);
 * });
 *
 * ffmpeg.on('done', (result) => {
 *   console.log('Conversion complete:', result.file);
 * });
 *
 * await ffmpeg.run();
 * ```
 *
 * @extends EventEmitter
 */
export class FFmpeggy extends EventEmitter {
  /** Whether the FFmpeg process is currently running */
  public running = false;

  /** The result of the completed FFmpeg process */
  public status?: ExecaReturnValue;

  /** The current FFmpeg child process */
  public process?: ExecaChildProcess;

  /** Any error that occurred during processing */
  public error?: Error;

  /** The current output file being processed */
  public currentFile?: string;

  /** The first output file in multiple output scenarios */
  public firstOutputFile?: string;

  /** Array of input sources (files, streams, or input objects with options) */
  public inputs: (string | ReadStream | FFmpeggyInput)[] = [];

  /** Array of output destinations (files, streams, or output objects with options) */
  public outputs: FFmpeggyOutputs = [];

  /** FFmpeg output-specific options */
  public outputOptions: string[] = [];

  /** FFmpeg input-specific options */
  public inputOptions: string[] = [];

  /** FFmpeg global options applied to the entire command */
  public globalOptions: string[] = ["-stats"];

  // set from DefaultConfig in constructor
  /** Path to the FFmpeg binary */
  public ffmpegBin!: string;

  /** Path to the FFprobe binary */
  public ffprobeBin!: string;

  /** Working directory for FFmpeg operations */
  public cwd!: string;

  /** Whether to overwrite existing output files */
  public overwriteExisting!: boolean;

  /** Whether to hide the FFmpeg banner output */
  public hideBanner!: boolean;

  /** Whether to use tee pseudo-muxer for multiple outputs */
  public tee: boolean = false;

  /**
   * Timeout in milliseconds for no progress. If set, FFmpeg will be killed if no progress event is received within this time.
   */
  public timeout?: number;
  private _timeoutTimer?: NodeJS.Timeout;
  private _lastProgressTime?: number;

  /**
   * Property for accessing the first input source.
   * Returns the first input source.
   */
  public get input(): string | ReadStream {
    if (this.inputs.length === 0) return "";
    const firstInput = this.inputs[0];
    if (typeof firstInput === "string" || firstInput instanceof ReadStream) {
      return firstInput;
    }
    return firstInput.source;
  }

  /**
   * Property for setting the first input source.
   * Sets the first input source.
   */
  public set input(value: string | ReadStream) {
    this.inputs = [value];
  }

  /**
   * Property for accessing the first output destination.
   * Returns the first output destination.
   */
  public get output(): string | WriteStream {
    if (this.outputs.length === 0) return "";
    const firstOutput = this.outputs[0];
    if (typeof firstOutput === "string" || firstOutput instanceof WriteStream) {
      return firstOutput;
    }
    return firstOutput.destination;
  }

  /**
   * Property for setting the first output destination.
   * Sets the first output destination.
   */
  public set output(value: string | WriteStream) {
    // Use setOutputs to enforce type and runtime constraints
    this.setOutputs([value] as FFmpeggyOutputs);
  }

  /**
   * Default configuration for FFmpeggy instances.
   * These values are applied to new instances unless overridden.
   */
  public static DefaultConfig = {
    cwd: process.cwd(),
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

  /** Accumulated log output from FFmpeg */
  public log = "";

  /** Whether output is being piped to stdout */
  private pipedOutput = false;

  /** PassThrough stream for output when toStream() is used */
  private outputStream = new PassThrough();

  /** Track if toStream() was called */
  private _wantsStream = false;

  /** Final file sizes after processing */
  private finalSizes?: FFmpeggyFinalSizes;

  /** Whether to automatically start processing */
  private shouldAutorun = false;

  /**
   * Creates a new FFmpeggy instance for FFmpeg operations.
   *
   * @param opts - Configuration options for the FFmpeg operation
   * @param opts.cwd - Working directory for FFmpeg operations
   * @param opts.input - Single input file or stream
   * @param opts.output - Single output file or stream
   * @param opts.inputs - Array of input files, streams, or input objects with options
   * @param opts.outputs - Array of output files, streams, or output objects with options
   * @param opts.pipe - Set to true to pipe output to stdout
   * @param opts.globalOptions - Global FFmpeg options
   * @param opts.inputOptions - Input-specific FFmpeg options
   * @param opts.outputOptions - Output-specific FFmpeg options
   * @param opts.overwriteExisting - Whether to overwrite existing output files
   * @param opts.hideBanner - Whether to hide FFmpeg banner output
   * @param opts.autorun - Whether to automatically start processing
   * @param opts.tee - Whether to use tee pseudo-muxer for multiple outputs
   * @param opts.timeout - Timeout in milliseconds for no progress
   *
   * @example
   * ```typescript
   * // Basic usage
   * const ffmpeg = new FFmpeggy({
   *   input: 'input.mp4',
   *   output: 'output.mp4'
   * });
   *
   * // Advanced usage with multiple inputs/outputs
   * const ffmpeg = new FFmpeggy({
   *   inputs: [
   *     'video.mp4',
   *     { source: 'audio.mp3', options: ['-itsoffset', '1.5'] }
   *   ],
   *   outputs: [
   *     { destination: 'output.mp4', options: ['-c:v', 'libx264'] },
   *     { destination: 'output.webm', options: ['-c:v', 'libvpx'] }
   *   ],
   *   tee: true
   * });
   * ```
   */
  public constructor(opts: FFmpeggyOptions = {}) {
    super();

    // Validate incompatible input/output combinations
    if (opts.input && opts.inputs) {
      throw new Error(
        "Cannot use both 'input' and 'inputs' options. Use either 'input' for single input or 'inputs' for multiple inputs.",
      );
    }

    if (opts.output && opts.outputs) {
      throw new Error(
        "Cannot use both 'output' and 'outputs' options. Use either 'output' for single output or 'outputs' for multiple outputs.",
      );
    }

    // Apply default config
    Object.assign(this, FFmpeggy.DefaultConfig);

    // Apply custom options
    if (opts.cwd) this.cwd = opts.cwd;
    if (opts.overwriteExisting !== undefined)
      this.overwriteExisting = opts.overwriteExisting;
    if (opts.hideBanner !== undefined) this.hideBanner = opts.hideBanner;
    if (opts.globalOptions)
      this.globalOptions = [...this.globalOptions, ...opts.globalOptions];
    if (opts.inputOptions)
      this.inputOptions = [...this.inputOptions, ...opts.inputOptions];
    if (opts.outputOptions)
      this.outputOptions = [...this.outputOptions, ...opts.outputOptions];
    if (opts.tee !== undefined) this.tee = opts.tee;
    if (opts.timeout !== undefined) this.timeout = opts.timeout;

    // Handle inputs
    if (opts.inputs) {
      this.inputs = [...opts.inputs];
    } else if (opts.input) {
      this.inputs = [opts.input];
    }

    // Handle outputs
    if (opts.outputs) {
      this.setOutputs([...opts.outputs] as FFmpeggyOutputs);
    } else if (opts.output) {
      this.setOutputs([opts.output] as FFmpeggyOutputs);
    }

    // Handle pipe option
    if (opts.pipe) {
      this.output = "-";
      this.pipedOutput = true;
    }

    // Trigger autorun if requested
    if (opts.autorun) {
      this.shouldAutorun = true;
    }

    if (this.shouldAutorun) {
      this.triggerAutorun();
    }

    this._setupProgressTimeout();
  }

  /**
   * Starts the FFmpeg process with the configured inputs and outputs.
   *
   * This method builds the FFmpeg command line arguments from the configured
   * inputs, outputs, and options, then spawns the FFmpeg process. It handles
   * both single and multiple input/output scenarios, including tee muxer
   * support for multiple outputs.
   *
   * @returns Promise that resolves to the FFmpeg process or undefined if already running
   * @throws Error if ffmpeg binary path is missing, no inputs/outputs specified, or invalid input/output values
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({
   *   input: 'input.mp4',
   *   output: 'output.mp4'
   * });
   *
   * ffmpeg.on('progress', (progress) => {
   *   console.log(`Progress: ${progress.percent}%`);
   * });
   *
   * const process = await ffmpeg.run();
   * ```
   */
  public async run(): Promise<ExecaChildProcess | undefined> {
    // Return any existing process
    if (this.process) {
      debug("returning existing process");
      return this.process;
    }

    const {
      cwd,
      inputs,
      outputs,
      ffmpegBin,
      globalOptions,
      inputOptions,
      outputOptions,
    } = this;

    if (!ffmpegBin) {
      throw Error("Missing path to ffmpeg binary");
    }

    if (inputs.length === 0) {
      throw new Error("No input specified");
    }

    // Check if any input is an empty string (before file existence check)
    for (const input of inputs) {
      if (typeof input === "string" && input.trim() === "") {
        throw new Error("No input specified");
      }
      if (typeof input === "object" && !(input instanceof ReadStream)) {
        if (typeof input.source === "string" && input.source.trim() === "") {
          throw new Error("No input specified");
        }
      }
    }

    if (outputs.length === 0) {
      throw new Error("No output specified");
    }

    // Check if any output is an empty string (before file existence check)
    for (const output of outputs) {
      if (typeof output === "string" && output.trim() === "") {
        throw new Error("No output specified");
      }
      if (typeof output === "object" && !(output instanceof WriteStream)) {
        if (
          typeof output.destination === "string" &&
          output.destination.trim() === ""
        ) {
          throw new Error("No output specified");
        }
      }
    }

    // Validate that input files exist (skip for streams and special inputs like "-")
    for (const input of inputs) {
      let inputSource: string | ReadStream;

      if (typeof input === "string" || input instanceof ReadStream) {
        inputSource = input;
      } else {
        inputSource = input.source;
      }

      // Only check file existence for string inputs that are not special FFmpeg inputs
      if (
        typeof inputSource === "string" &&
        inputSource !== "-" &&
        !inputSource.startsWith("nullsrc=") &&
        !inputSource.startsWith("testsrc=") &&
        !inputSource.startsWith("lavfi=") &&
        !inputSource.startsWith("color=") &&
        !inputSource.startsWith("sine=") &&
        !inputSource.startsWith("anullsrc=")
      ) {
        try {
          await access(inputSource);
        } catch {
          throw new Error(`Input file does not exist: ${inputSource}`);
        }
      }
    }

    // Check for unsupported combinations: multiple outputs with WriteStreams
    const writeStreamCount = outputs.filter((output) => {
      if (output instanceof WriteStream) return true;
      if (typeof output === "object" && !(output instanceof WriteStream)) {
        return output.destination instanceof WriteStream;
      }
      return false;
    }).length;

    if (writeStreamCount > 1) {
      throw new Error(
        "Multiple WriteStream outputs are not supported. FFmpeg can only write to one stdout destination at a time.",
      );
    }

    // For now, disable WriteStream support in multiple output scenarios
    // as FFmpeg has issues with multiple stdout destinations
    if (writeStreamCount > 0 && outputs.length > 1) {
      throw new Error(
        "WriteStream outputs are not supported in multiple output scenarios. Use single output with WriteStream or multiple file outputs.",
      );
    }

    // Build input arguments
    const inputArgs: string[] = [];
    const inputStreams: ReadStream[] = [];

    for (const input of inputs) {
      let inputSource: string | ReadStream;
      let inputOpts: string[] = [];

      if (typeof input === "string" || input instanceof ReadStream) {
        inputSource = input;
      } else {
        inputSource = input.source;
        inputOpts = input.options || [];
      }

      // Add input options if any
      if (inputOpts.length > 0) {
        inputArgs.push(...parseOptions(inputOpts));
      }

      // Add input source
      const ffmpegInput = inputSource instanceof ReadStream ? "-" : inputSource;
      inputArgs.push("-i", ffmpegInput);

      // Collect input streams for later use
      if (inputSource instanceof ReadStream) {
        inputStreams.push(inputSource);
      }
    }

    // Build output arguments
    let outputArgs: string[] = [];
    const outputStreams: WriteStream[] = [];

    if (this.tee && outputs.length > 1) {
      // Use tee pseudo-muxer for multiple outputs
      const teeOutputs: string[] = [];
      const codecOpts: string[] = [];
      const muxerOptsList: string[][] = [];

      // Check if all outputs have compatible options for tee muxer
      let canUseTee = true;
      const firstOutputOpts =
        outputs[0] &&
        typeof outputs[0] === "object" &&
        !(outputs[0] instanceof WriteStream)
          ? outputs[0].options || []
          : [];

      // Check if any output is a WriteStream - tee muxer doesn't work well with streams
      const hasWriteStreams = outputs.some((output) => {
        if (output instanceof WriteStream) return true;
        if (typeof output === "object" && !(output instanceof WriteStream)) {
          return output.destination instanceof WriteStream;
        }
        return false;
      });

      if (hasWriteStreams) {
        canUseTee = false;
        debug("Tee incompatible: contains WriteStreams");
      }

      // For tee muxer, all outputs should use the same codec settings
      // Check if any output has different codec options that would make tee incompatible
      for (let i = 1; i < outputs.length && canUseTee; i++) {
        const output = outputs[i];
        const outputOpts =
          output &&
          typeof output === "object" &&
          !(output instanceof WriteStream)
            ? output.options || []
            : [];

        // Compare codec options between first output and current output
        // We need to check both the option and its value
        const firstCodecOpts: string[] = [];
        const currentCodecOpts: string[] = [];

        // Extract codec options with their values from first output
        for (let j = 0; j < firstOutputOpts.length; j++) {
          const opt = firstOutputOpts[j];
          if (/^-c(:[avds])?$/.test(opt)) {
            const nextVal = firstOutputOpts[j + 1];
            if (nextVal && !nextVal.startsWith("-")) {
              firstCodecOpts.push(opt, nextVal);
              j++; // skip value
            } else {
              firstCodecOpts.push(opt);
            }
          }
        }

        // Extract codec options with their values from current output
        for (let j = 0; j < outputOpts.length; j++) {
          const opt = outputOpts[j];
          if (/^-c(:[avds])?$/.test(opt)) {
            const nextVal = outputOpts[j + 1];
            if (nextVal && !nextVal.startsWith("-")) {
              currentCodecOpts.push(opt, nextVal);
              j++; // skip value
            } else {
              currentCodecOpts.push(opt);
            }
          }
        }

        // Compare the codec options and their values
        if (
          firstCodecOpts.length !== currentCodecOpts.length ||
          JSON.stringify(firstCodecOpts) !== JSON.stringify(currentCodecOpts)
        ) {
          canUseTee = false;
          debug(
            `Tee incompatible: first output codec opts: ${JSON.stringify(
              firstCodecOpts,
            )}, output ${i} codec opts: ${JSON.stringify(currentCodecOpts)}`,
          );
          break;
        }
      }

      if (!canUseTee) {
        // Fall back to standard multiple outputs for incompatible tee scenarios
        debug(
          "Tee muxer incompatible with different codec options, falling back to standard multiple outputs",
        );
        for (const output of outputs) {
          let outputDest: string | WriteStream;
          let outputOpts: string[] = [];

          if (typeof output === "string" || output instanceof WriteStream) {
            outputDest = output;
          } else {
            outputDest = output.destination;
            outputOpts = output.options || [];
          }

          // Add output-specific options first
          if (outputOpts.length > 0) {
            outputArgs.push(...parseOptions(outputOpts));
          }

          // Add output destination
          const ffmpegOutput =
            outputDest instanceof WriteStream ? "-" : outputDest;
          outputArgs.push(ffmpegOutput);

          // Collect output streams for later use
          if (outputDest instanceof WriteStream) {
            outputStreams.push(outputDest);
          }
        }
      } else {
        // Use tee muxer for compatible outputs
        outputs.forEach((output, idx) => {
          let outputDest: string | WriteStream;
          let outputOpts: string[] = [];

          if (typeof output === "string" || output instanceof WriteStream) {
            outputDest = output;
          } else {
            outputDest = output.destination;
            outputOpts = output.options || [];
          }

          // Separate codec options and muxer options
          const muxerOpts: string[] = [];
          for (let i = 0; i < outputOpts.length; i++) {
            const opt = outputOpts[i];
            // Muxer options: e.g. f=mp4, movflags=faststart
            if (
              /^(f|movflags|protocols|onfail|use_fifo|fifo_options|bsfs|select_streams|ignore_unknown_streams)=/.test(
                opt,
              )
            ) {
              muxerOpts.push(opt);
            } else if (/^-c(:[avds])?$/.test(opt)) {
              // Codec options: -c, -c:v, -c:a, etc.
              const nextVal = outputOpts[i + 1];
              if (nextVal && !nextVal.startsWith("-")) {
                // Insert stream specifier after type
                const optWithStream = opt.endsWith(":")
                  ? `${opt}${idx}`
                  : `${opt}:${idx}`;
                codecOpts.push(optWithStream, nextVal);
                i++; // skip value
              }
            } else {
              // Other options (e.g. -crf, -b:v, etc.)
              // These should also be stream-specific if needed
              const nextVal = outputOpts[i + 1];
              if (nextVal && !nextVal.startsWith("-")) {
                // Try to add stream specifier if possible
                if (/^-(crf|b:v|b:a|q:v|q:a|filter:v|filter:a)$/.test(opt)) {
                  codecOpts.push(`${opt}:${idx}`, nextVal);
                } else {
                  codecOpts.push(opt, nextVal);
                }
                i++;
              } else {
                codecOpts.push(opt);
              }
            }
          }
          muxerOptsList.push(muxerOpts);
          // Build tee output string
          let teeOutput = outputDest instanceof WriteStream ? "-" : outputDest;
          if (muxerOpts.length > 0) {
            teeOutput = `[${muxerOpts.join(",")}]${teeOutput}`;
          }
          // Quote the output path for FFmpeg tee muxer (especially for Windows)
          if (typeof teeOutput === "string" && !teeOutput.startsWith("-")) {
            teeOutput = `'${teeOutput}'`;
          }
          teeOutputs.push(teeOutput);
        });

        // Build -map options for each output stream
        const mapOpts: string[] = [];
        // For tee muxer, we only need one set of map options for all outputs
        mapOpts.push("-map", "0:v", "-map", "0:a");

        outputArgs = [
          ...parseOptions(outputOptions),
          ...codecOpts,
          ...mapOpts,
          "-f",
          "tee",
          teeOutputs.join("|"),
        ];
      }
    } else {
      // Standard multiple outputs
      for (const output of outputs) {
        let outputDest: string | WriteStream;
        let outputOpts: string[] = [];

        if (typeof output === "string" || output instanceof WriteStream) {
          outputDest = output;
        } else {
          outputDest = output.destination;
          outputOpts = output.options || [];
        }

        // Add output-specific options first
        if (outputOpts.length > 0) {
          outputArgs.push(...parseOptions(outputOpts));
        }

        // Add output destination
        const ffmpegOutput =
          outputDest instanceof WriteStream ? "-" : outputDest;
        outputArgs.push(ffmpegOutput);

        // Collect output streams for later use
        if (outputDest instanceof WriteStream) {
          outputStreams.push(outputDest);
        }
      }
    }

    if (this.hideBanner) {
      globalOptions.push("-hide_banner");
    }

    if (this.overwriteExisting) {
      globalOptions.push("-y");
    }

    const args = [
      ...parseOptions(globalOptions),
      ...parseOptions(inputOptions),
      ...inputArgs,
      ...parseOptions(outputOptions),
      ...outputArgs,
    ].filter((a) => !!a);

    // Set pipedOutput flag for stream handling
    const hasPipedOutput = outputs.some((output) => {
      if (typeof output === "string") {
        return output === "-";
      } else if (output instanceof WriteStream) {
        return true;
      } else {
        return (
          output.destination === "-" ||
          output.destination instanceof WriteStream
        );
      }
    });

    if (hasPipedOutput) {
      this.pipedOutput = true;
    } else {
      // Set currentFile to the first output file (for progress tracking)
      const firstOutput = outputs[0];
      if (firstOutput) {
        const outputDest =
          typeof firstOutput === "string"
            ? firstOutput
            : firstOutput instanceof WriteStream
              ? ""
              : firstOutput.destination;
        if (typeof outputDest === "string" && !outputDest.includes("%d")) {
          this.currentFile = outputDest;
          // Store the first output file for multiple output scenarios
          this.firstOutputFile = outputDest;
        }
      }
    }

    const joinedArgs: readonly string[] = args;
    debug("ffmpeg full command: %s %s", ffmpegBin, joinedArgs.join(" "));
    try {
      this.emit("start", joinedArgs);
      debug("bin: %s", ffmpegBin);
      debug("args: %o", joinedArgs);

      // Emit synthetic writing event for all outputs if using tee muxer and multiple outputs
      if (outputs.length > 1 && this.tee) {
        const writingEvents = outputs.map((output, idx) => {
          let file: string | undefined;
          if (typeof output === "string") file = output;
          else if (output instanceof WriteStream) file = undefined;
          else if (typeof output.destination === "string")
            file = output.destination;
          else file = undefined;
          return { file: file || "", outputIndex: idx };
        });
        this.emit("writing", writingEvents);
      }

      // Wait for all input streams to open
      for (const inputStream of inputStreams) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for input stream to open"));
          }, DEFAULT_STREAM_OPEN_TIMEOUT_MS);

          inputStream.once("open", () => {
            clearTimeout(timeout);
            resolve(undefined);
          });

          inputStream.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      // Wait for all output streams to open
      for (const outputStream of outputStreams) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timeout waiting for output stream to open"));
          }, DEFAULT_STREAM_OPEN_TIMEOUT_MS);

          outputStream.once("open", () => {
            clearTimeout(timeout);
            resolve(undefined);
          });

          outputStream.once("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      }

      // For multiple input streams, we need to handle them differently
      // For now, we'll use the first input stream as the main input
      const mainInput = inputStreams.length > 0 ? inputStreams[0] : undefined;
      // Don't pass WriteStreams directly to execa stdout - handle them through pipeline
      const mainOutput = undefined;

      debug("FFmpeg process starting");
      this.process = execa(ffmpegBin, joinedArgs, {
        cwd,
        input: mainInput,
        stdout: mainOutput,
        reject: false,
      });

      // Use pipeline for robust stream handling when output is a WriteStream
      if (this.process.stdout && outputStreams.length > 0) {
        debug("Setting up pipeline for outputStreams");

        // Check if we need a tee stream (multiple destinations)
        const needsTee =
          outputStreams.length > 1 ||
          (outputStreams.length === 1 && this._wantsStream);

        if (needsTee) {
          // Create a tee stream to handle multiple destinations
          const teeStream = new PassThrough();

          // Handle errors on the tee stream
          teeStream.on("error", (err) => {
            debug("Tee stream error: %o", sanitizeErrorForLog(err));
            // Don't emit this as an uncaught exception
          });

          // Pipe stdout to the tee stream first
          pipeline(this.process.stdout!, teeStream)
            .then(() => {
              debug("Main pipeline to tee stream finished");
            })
            .catch((err: Error) => {
              // Only log the error, don't treat it as uncaught
              debug(
                "Main pipeline to tee stream error (expected during cleanup): %o",
                sanitizeErrorForLog(err),
              );
            });

          // Use the first output stream for the main pipeline
          const firstOutputStream = outputStreams[0];

          // Handle errors on the output stream
          firstOutputStream.on("error", (err) => {
            debug("Output stream error: %o", sanitizeErrorForLog(err));
            // Don't emit this as an uncaught exception
          });

          pipeline(teeStream, firstOutputStream)
            .then(() => {
              debug("Pipeline for outputStreams finished");
            })
            .catch((err: Error) => {
              // Suppress expected stream cleanup errors
              const errorMessage = err.message || "";
              const isExpectedError =
                /premature close|write after end|cannot pipe|stream.*error|ERR_STREAM_PREMATURE_CLOSE|ERR_STREAM_WRITE_AFTER_END/i.test(
                  errorMessage,
                );

              if (isExpectedError) {
                debug("Suppressed expected pipeline error: %s", errorMessage);
                // Don't emit error for expected stream cleanup issues
                return;
              }

              debug("Pipeline error: %o", sanitizeErrorForLog(err));
              this.error = err;
              // Only emit error if there are listeners to prevent uncaught exceptions
              if (this.listenerCount("error") > 0) {
                this.emit("error", err);
              } else {
                debug(
                  "No error listeners, suppressing pipeline error to prevent uncaught exception",
                );
              }
            });

          // If toStream() was called, also pipe to the outputStream
          if (this._wantsStream) {
            debug("Setting up pipeline for toStream() outputStream");

            // Handle errors on the outputStream
            this.outputStream.on("error", (err) => {
              debug(
                "toStream outputStream error: %o",
                sanitizeErrorForLog(err),
              );
              // Don't emit this as an uncaught exception
            });

            pipeline(teeStream, this.outputStream)
              .then(() => {
                debug("Pipeline for toStream() outputStream finished");
              })
              .catch((err) => {
                // Suppress expected stream cleanup errors
                const errorMessage = err.message || "";
                const isExpectedError =
                  /premature close|write after end|cannot pipe|stream.*error|ERR_STREAM_PREMATURE_CLOSE|ERR_STREAM_WRITE_AFTER_END/i.test(
                    errorMessage,
                  );

                if (isExpectedError) {
                  debug(
                    "Suppressed expected pipeline error for toStream(): %s",
                    errorMessage,
                  );
                  // Don't emit error for expected stream cleanup issues
                  return;
                }

                debug(
                  "Pipeline error for toStream(): %o",
                  sanitizeErrorForLog(err),
                );
                this.error = err;
                // Only emit error if there are listeners to prevent uncaught exceptions
                if (this.listenerCount("error") > 0) {
                  this.emit("error", err);
                } else {
                  debug(
                    "No error listeners, suppressing pipeline error to prevent uncaught exception",
                  );
                }
              });
          }
        } else {
          // Single output stream - use direct pipeline without tee
          const outputStream = outputStreams[0];

          // Handle errors on the output stream
          outputStream.on("error", (err) => {
            debug("Output stream error: %o", sanitizeErrorForLog(err));
            // Don't emit this as an uncaught exception
          });

          pipeline(this.process.stdout!, outputStream)
            .then(() => {
              debug("Direct pipeline for outputStream finished");
            })
            .catch((err: Error) => {
              // Suppress expected stream cleanup errors
              const errorMessage = err.message || "";
              const isExpectedError =
                /premature close|write after end|cannot pipe|stream.*error|ERR_STREAM_PREMATURE_CLOSE|ERR_STREAM_WRITE_AFTER_END/i.test(
                  errorMessage,
                );

              if (isExpectedError) {
                debug("Suppressed expected pipeline error: %s", errorMessage);
                // Don't emit error for expected stream cleanup issues
                return;
              }

              debug("Pipeline error: %o", sanitizeErrorForLog(err));
              this.error = err;
              // Only emit error if there are listeners to prevent uncaught exceptions
              if (this.listenerCount("error") > 0) {
                this.emit("error", err);
              } else {
                debug(
                  "No error listeners, suppressing pipeline error to prevent uncaught exception",
                );
              }
            });
        }
      } else if (this._wantsStream && this.process.stdout) {
        // Only toStream() was called, no output streams
        debug("Setting up pipeline for toStream() outputStream only");

        // Handle errors on the outputStream
        this.outputStream.on("error", (err) => {
          debug("toStream outputStream error: %o", sanitizeErrorForLog(err));
          // Don't emit this as an uncaught exception
        });

        pipeline(this.process.stdout, this.outputStream)
          .then(() => {
            debug("Pipeline for toStream() outputStream finished");
          })
          .catch((err) => {
            // Suppress expected stream cleanup errors
            const errorMessage = err.message || "";
            const isExpectedError =
              /premature close|write after end|cannot pipe|stream.*error|ERR_STREAM_PREMATURE_CLOSE|ERR_STREAM_WRITE_AFTER_END/i.test(
                errorMessage,
              );

            if (isExpectedError) {
              debug(
                "Suppressed expected pipeline error for toStream(): %s",
                errorMessage,
              );
              // Don't emit error for expected stream cleanup issues
              return;
            }

            debug(
              "Pipeline error for toStream(): %o",
              sanitizeErrorForLog(err),
            );
            this.error = err;
            // Only emit error if there are listeners to prevent uncaught exceptions
            if (this.listenerCount("error") > 0) {
              this.emit("error", err);
            } else {
              debug(
                "No error listeners, suppressing pipeline error to prevent uncaught exception",
              );
            }
          });
      }

      this.running = true;
    } catch (err) {
      const e = err as Error;
      this.error = e;
      debug("error: %o", e);
      // Only emit error if there are listeners to prevent uncaught exceptions
      if (this.listenerCount("error") > 0) {
        this.emit("error", e);
      } else {
        debug(
          "No error listeners, suppressing run error to prevent uncaught exception",
        );
      }
      this.emit("exit", 1, e);
      this.running = false;
    }

    this.awaitStatus();
    this.parseOutput();
    this._clearProgressTimeout();
    return this.process;
  }

  /**
   * Parses FFmpeg stderr output to extract progress information, writing events,
   * and final file sizes. Emits appropriate events based on the parsed output.
   *
   * @private
   */
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
          if (this.outputs.length > 1) {
            this.outputs.forEach((output, idx) => {
              let file: string | undefined;
              if (typeof output === "string") file = output;
              else if (output instanceof WriteStream) file = undefined;
              else if (typeof output.destination === "string")
                file = output.destination;
              else file = undefined;
              const progressEvent: FFmpeggyProgressEvent = {
                ...progress,
                duration,
                percent:
                  duration && duration > 0 && progress.time
                    ? Math.min(
                        100,
                        Math.round((progress.time / duration) * 100 * 100) /
                          100,
                      )
                    : 0,
                outputIndex: idx,
                file,
              };
              this.emit("progress", progressEvent);
            });
          } else {
            let file: string | undefined;
            const output = this.outputs[0];
            if (typeof output === "string") file = output;
            else if (output instanceof WriteStream) file = undefined;
            else if (typeof output.destination === "string")
              file = output.destination;
            else file = undefined;
            const progressEvent: FFmpeggyProgressEvent = {
              ...progress,
              duration,
              percent:
                duration && duration > 0 && progress.time
                  ? Math.min(
                      100,
                      Math.round((progress.time / duration) * 100 * 100) / 100,
                    )
                  : 0,
              outputIndex: 0,
              file,
            };
            this.emit("progress", progressEvent);
          }
        }
        const writing = parseWriting(txt);
        if (writing) {
          // For multiple outputs, try to match file to outputIndex
          let writingEvents: { file: string; outputIndex: number }[] = [];
          if (this.outputs.length > 1) {
            writingEvents = this.outputs
              .map((output, idx) => {
                let file: string | undefined;
                if (typeof output === "string") file = output;
                else if (output instanceof WriteStream) file = undefined;
                else if (typeof output.destination === "string")
                  file = output.destination;
                else file = undefined;
                if (file && writing.includes(file)) {
                  return { file, outputIndex: idx };
                }
                return undefined;
              })
              .filter((v): v is { file: string; outputIndex: number } =>
                Boolean(v),
              );
            if (writingEvents.length > 0) {
              this.emit("writing", writingEvents);
            } else {
              this.emit(
                "writing",
                this.outputs.map((output, idx) => {
                  let file: string | undefined;
                  if (typeof output === "string") file = output;
                  else if (output instanceof WriteStream) file = undefined;
                  else if (typeof output.destination === "string")
                    file = output.destination;
                  else file = undefined;
                  return { file: file || "", outputIndex: idx };
                }),
              );
            }
          } else {
            this.emit("writing", { file: writing, outputIndex: 0 });
          }
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

  /**
   * Waits for the FFmpeg process to complete and handles cleanup.
   * Emits 'done' and 'exit' events when the process finishes.
   *
   * @private
   */
  private async awaitStatus() {
    if (this.process) {
      try {
        this.status = await this.process;
        // Get the exit code from the status, not from the process reference
        const code = this.status?.exitCode;

        if (code === 1) {
          console.error("FFmpeg failed:", this.log);
          // Extract concise error information from the log
          const conciseError = this.extractConciseError(this.log);
          this.error = new Error(
            `FFmpeg failed with exit code ${code}: ${conciseError}`,
          );
        } else {
          debug("done: %s", this.currentFile);
          // If using tee muxer and multiple outputs, emit done for all outputs
          if (this.outputs.length > 1 && this.tee) {
            const results = this.outputs.map((output, idx) => {
              let outputDest: string | undefined;
              if (typeof output === "string") outputDest = output;
              else if (output instanceof WriteStream) outputDest = undefined;
              else if (typeof output.destination === "string")
                outputDest = output.destination;
              else outputDest = undefined;
              return {
                file:
                  typeof outputDest === "string" && outputDest !== "-"
                    ? outputDest
                    : undefined,
                sizes: this.finalSizes,
                outputIndex: idx,
              };
            });
            this.emit("done", results);
          } else {
            this.emit(
              "done",
              this.finalSizes
                ? {
                    file: this.currentFile,
                    sizes: this.finalSizes,
                    outputIndex: 0,
                  }
                : { file: this.currentFile, outputIndex: 0 },
            );
          }
        }

        // Cleanup and emit exit event in next tick
        await this.cleanupAndEmitExit(code);
      } catch (error) {
        // Handle process errors
        this.error = error as Error;
        debug("process error in awaitStatus: %o", error);

        // Only emit error if there are listeners to prevent uncaught exceptions
        if (this.listenerCount("error") > 0) {
          this.emit("error", error as Error);
        } else {
          debug(
            "No error listeners, suppressing process error to prevent uncaught exception",
          );
        }

        // Cleanup and emit exit event in next tick
        await this.cleanupAndEmitExit(null);
      }
    }
  }

  /**
   * Cleans up the process state and emits the exit event.
   *
   * @param code - The exit code from the FFmpeg process
   * @private
   */
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

  /**
   * Stops the running FFmpeg process.
   *
   * @param signal - Signal to send to the process (default: 15 for SIGTERM)
   * @returns Promise that resolves when the process is stopped
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({ input: 'input.mp4', output: 'output.mp4' });
   * await ffmpeg.run();
   *
   * // Stop the process gracefully
   * await ffmpeg.stop();
   *
   * // Force kill the process
   * await ffmpeg.stop(9);
   * ```
   */
  public async stop(signal = 15): Promise<void> {
    // 2 is SIGINT, 9 is SIGKILL, 15 is SIGTERM
    if (this.running && this.process) {
      try {
        this.process.kill(signal);
        await this.process.finally();
      } catch (error) {
        this.error = error as Error;
        // Only emit error if there are listeners to prevent uncaught exceptions
        if (this.listenerCount("error") > 0) {
          this.emit("error", error as Error);
        } else {
          debug(
            "No error listeners, suppressing stop error to prevent uncaught exception",
          );
        }
        this.emit(
          "exit",
          typeof process.exitCode === "number" ? process.exitCode : null,
          this.error,
        );
      }
    }
    this.process = undefined;
    this.running = false;
  }

  /**
   * Waits for the FFmpeg process to complete and returns the result.
   *
   * This method waits for the current FFmpeg process to finish and returns
   * information about the completed operation, including the output file path
   * and final file sizes.
   *
   * @returns Promise that resolves to the processing result with file path and sizes
   * @throws Error if the process encounters an error
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({
   *   input: 'input.mp4',
   *   output: 'output.mp4'
   * });
   *
   * await ffmpeg.run();
   * const result = await ffmpeg.done();
   * console.log('Output file:', result.file);
   * console.log('File sizes:', result.sizes);
   * ```
   */
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

        // Close the PassThrough stream for piped outputs to prevent hanging
        if (this.pipedOutput && this.outputStream) {
          debug("done() method - closing PassThrough stream for piped output");
          this.outputStream.end();
        }
      }
    }

    // Check if there was an error and throw it
    if (this.error) {
      debug("done() method - throwing error: %o", this.error);
      throw this.error;
    }

    // Check if ALL outputs are piped/streams (not just any)
    const allOutputsArePiped = this.outputs.every((output) => {
      if (typeof output === "string") {
        return output === "-";
      } else if (output instanceof WriteStream) {
        return true;
      } else {
        return (
          output.destination === "-" ||
          output.destination instanceof WriteStream
        );
      }
    });

    // For piped output, file is undefined since we're writing to stdout
    if (allOutputsArePiped) {
      debug("done() method - all outputs are piped, returning undefined file");
      return { file: undefined, sizes: this.finalSizes };
    }

    // For multiple outputs, we need to determine the primary output file
    // Return the first file output, or undefined if all are streams
    if (this.outputs.length > 1) {
      const results = this.outputs.map((output, idx) => {
        let outputDest: string | WriteStream | undefined;
        if (typeof output === "string") {
          outputDest = output;
        } else if (output instanceof WriteStream) {
          outputDest = undefined;
        } else if (typeof output.destination === "string") {
          outputDest = output.destination;
        } else {
          outputDest = undefined;
        }
        return {
          file:
            typeof outputDest === "string" && outputDest !== "-"
              ? outputDest
              : undefined,
          sizes: this.finalSizes,
          outputIndex: idx,
        };
      });
      this.emit("done", results);
      return results[0];
    }

    // For single output, return the file path or undefined for streams
    const output = this.outputs[0];
    if (!output) {
      debug("done() method - no outputs, returning undefined file");
      return { file: undefined, sizes: this.finalSizes };
    }

    let outputDest: string | WriteStream;
    if (typeof output === "string") {
      outputDest = output;
    } else if (output instanceof WriteStream) {
      debug(
        "done() method - single output is stream, returning undefined file",
      );
      return { file: undefined, sizes: this.finalSizes };
    } else {
      outputDest = output.destination;
    }

    if (typeof outputDest === "string" && outputDest !== "-") {
      debug("done() method - single file output: %s", outputDest);
      return { file: outputDest, sizes: this.finalSizes };
    } else {
      debug(
        "done() method - single output is pipe or stream, returning undefined file",
      );
      return { file: undefined, sizes: this.finalSizes };
    }
  }

  /**
   * Waits for the FFmpeg process to exit and returns the exit information.
   *
   * @returns Promise that resolves to the exit code and any error
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({ input: 'input.mp4', output: 'output.mp4' });
   * await ffmpeg.run();
   * const { code, error } = await ffmpeg.exit();
   *
   * if (code === 0) {
   *   console.log('Conversion successful');
   * } else {
   *   console.error('Conversion failed:', error);
   * }
   * ```
   */
  public async exit(): Promise<{ code?: number | null; error?: Error }> {
    if (this.running && this.process) {
      // Wait for the process to complete
      await this.process;
    }

    // Return the current status
    return { code: this.status?.exitCode, error: this.error };
  }

  /**
   * Sets the working directory for FFmpeg operations.
   *
   * @param cwd - The working directory path
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setCwd('/path/to/working/directory')
   *   .setInput('input.mp4')
   *   .setOutput('output.mp4');
   * ```
   */
  public setCwd(cwd: string): FFmpeggy {
    this.cwd = cwd;
    return this;
  }

  /**
   * Sets whether to overwrite existing output files.
   *
   * @param overwriteExisting - Whether to overwrite existing files
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setOverwriteExisting(true)
   *   .setInput('input.mp4')
   *   .setOutput('output.mp4');
   * ```
   */
  public setOverwriteExisting(overwriteExisting: boolean): FFmpeggy {
    this.overwriteExisting = overwriteExisting;
    return this;
  }

  /**
   * Sets whether to pipe output to stdout.
   *
   * @param pipe - Whether to pipe output to stdout
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInput('input.mp4')
   *   .setPipe(true);
   *
   * // Output will be piped to stdout
   * const process = await ffmpeg.run();
   * ```
   */
  public setPipe(pipe: boolean): FFmpeggy {
    if (pipe) {
      this.output = "-";
      this.pipedOutput = true;
    } else {
      this.pipedOutput = false;
    }
    return this;
  }

  /**
   * Sets whether to hide the FFmpeg banner output.
   *
   * @param hideBanner - Whether to hide the banner
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setHideBanner(false) // Show banner
   *   .setInput('input.mp4')
   *   .setOutput('output.mp4');
   * ```
   */
  public setHideBanner(hideBanner: boolean): FFmpeggy {
    this.hideBanner = hideBanner;
    return this;
  }

  /**
   * Sets the input source.
   *
   * @param input - The input file path or stream
   * @returns This FFmpeggy instance for method chaining
   * @throws Error if multiple inputs are already configured
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInput('input.mp4')
   *   .setOutput('output.mp4');
   *
   * // Can also be used with multiple outputs
   * const ffmpeg = new FFmpeggy()
   *   .setInputs(['video.mp4', 'audio.mp3'])
   *   .setOutputs(['output1.mp4', 'output2.mp4']);
   * ```
   */
  public setInput(input: string | ReadStream): FFmpeggy {
    if (this.inputs.length > 1) {
      throw new Error(
        "Cannot use setInput() when multiple inputs are already configured. Use setInputs() or clearInputs() first.",
      );
    }
    this.inputs = [input];
    return this;
  }

  /**
   * Sets the output destination.
   *
   * @param output - The output file path or stream
   * @returns This FFmpeggy instance for method chaining
   * @throws Error if multiple outputs are already configured
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInput('input.mp4')
   *   .setOutput('output.mp4');
   * ```
   */
  public setOutput(output: string | WriteStream): FFmpeggy {
    if (this.outputs.length > 1) {
      throw new Error(
        "Cannot use setOutput() when multiple outputs are already configured. Use setOutputs() or clearOutputs() first.",
      );
    }
    // Use setOutputs to enforce type and runtime constraints
    this.setOutputs([output] as FFmpeggyOutputs);
    return this;
  }

  /**
   * Sets multiple input sources.
   *
   * @param inputs - Array of input files, streams, or input objects with options
   * @returns This FFmpeggy instance for method chaining
   * @throws Error if a single input is already configured
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInputs([
   *     'video.mp4',
   *     { source: 'audio.mp3', options: ['-itsoffset', '1.5'] }
   *   ])
   *   .setOutputs(['output1.mp4', 'output2.mp4']);
   *
   * // Can also be used with multiple outputs
   * const ffmpeg = new FFmpeggy()
   *   .setInputs(['video.mp4', 'audio.mp3'])
   *   .setOutputs(['output1.mp4', 'output2.mp4']);
   * ```
   */
  public setInputs(inputs: (string | ReadStream | FFmpeggyInput)[]): FFmpeggy {
    // Allow any valid inputs array
    this.inputs = [...inputs];
    return this;
  }

  /**
   * Adds an input source to the existing inputs.
   *
   * @param input - The input file, stream, or input object with options
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .addInput('video.mp4')
   *   .addInput({ source: 'audio.mp3', options: ['-itsoffset', '1.5'] })
   *   .setOutput('output.mp4');
   * ```
   */
  public addInput(input: string | ReadStream | FFmpeggyInput): FFmpeggy {
    this.inputs.push(input);
    return this;
  }

  /**
   * Sets multiple output destinations.
   *
   * @param outputs - Array of output files, streams, or output objects with options
   * @returns This FFmpeggy instance for method chaining
   * @throws Error if an unsupported combination is provided (see docs)
   *
   * Output constraints:
   * - All outputs must be files, or
   * - A single output may be a WriteStream, or
   * - For tee muxer, at most one output may be a WriteStream (and only as the last output).
   */
  public setOutputs(outputs: FFmpeggyOutputs): FFmpeggy {
    // Runtime check: only allow all files, or a single stream, or tee-compatible
    const streamOutputs = outputs.filter(
      (o): o is StreamOutput =>
        o instanceof WriteStream ||
        (typeof o === "object" &&
          "destination" in o &&
          o.destination instanceof WriteStream),
    );
    if (streamOutputs.length > 1) {
      throw new Error(
        "Multiple WriteStream outputs are not supported. Only one stream output is allowed (as the last output if using tee).",
      );
    }
    if (
      streamOutputs.length === 1 &&
      outputs.length > 1 &&
      outputs[outputs.length - 1] !== streamOutputs[0]
    ) {
      throw new Error(
        "If using a WriteStream with multiple outputs, it must be the last output (for tee muxer compatibility).",
      );
    }
    this.outputs = [...outputs];
    return this;
  }

  /**
   * Adds an output destination to the existing outputs.
   *
   * @param output - The output file, stream, or output object with options
   * @returns This FFmpeggy instance for method chaining
   * @throws Error if an unsupported combination is provided (see docs)
   */
  public addOutput(output: FileOutput | StreamOutput): FFmpeggy {
    // Use setOutputs to enforce constraints
    return this.setOutputs([...this.outputs, output] as FFmpeggyOutputs);
  }

  /**
   * Enables tee pseudo-muxer for multiple outputs.
   *
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInputs(['video.mp4', 'audio.mp3'])
   *   .setOutputs(['output1.mp4', 'output2.mp4'])
   *   .useTee();
   * ```
   */
  public useTee(): FFmpeggy {
    this.tee = true;
    return this;
  }

  /**
   * Clears all input sources.
   *
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInputs(['input1.mp4', 'input2.mp4'])
   *   .clearInputs()
   *   .addInput('new-input.mp4');
   * ```
   */
  public clearInputs(): FFmpeggy {
    this.inputs = [];
    return this;
  }

  /**
   * Clears all output destinations.
   *
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setOutputs(['output1.mp4', 'output2.mp4'])
   *   .clearOutputs()
   *   .addOutput('new-output.mp4');
   * ```
   */
  public clearOutputs(): FFmpeggy {
    this.outputs = [];
    return this;
  }

  /**
   * Gets the number of input sources.
   *
   * @returns The number of inputs
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInputs(['input1.mp4', 'input2.mp4']);
   * console.log(ffmpeg.getInputCount()); // 2
   * ```
   */
  public getInputCount(): number {
    return this.inputs.length;
  }

  /**
   * Gets the number of output destinations.
   *
   * @returns The number of outputs
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setOutputs(['output1.mp4', 'output2.mp4']);
   * console.log(ffmpeg.getOutputCount()); // 2
   * ```
   */
  public getOutputCount(): number {
    return this.outputs.length;
  }

  /**
   * Sets global FFmpeg options.
   *
   * @param opts - Array of global FFmpeg options
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInput('input.mp4')
   *   .setOutput('output.mp4')
   *   .setGlobalOptions(['-loglevel', 'info']);
   * ```
   */
  public setGlobalOptions(opts: string[]): FFmpeggy {
    this.globalOptions = [...this.globalOptions, ...opts];
    return this;
  }

  /**
   * Sets input-specific FFmpeg options.
   *
   * @param opts - Array of input-specific FFmpeg options
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInput('input.mp4')
   *   .setOutput('output.mp4')
   *   .setInputOptions(['-ss', '10', '-t', '30']); // Start at 10s, duration 30s
   * ```
   */
  public setInputOptions(opts: string[]): FFmpeggy {
    this.inputOptions = [...this.inputOptions, ...opts];
    return this;
  }

  /**
   * Sets output-specific FFmpeg options.
   *
   * @param opts - Array of output-specific FFmpeg options
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy()
   *   .setInput('input.mp4')
   *   .setOutput('output.mp4')
   *   .setOutputOptions(['-c:v', 'libx264', '-crf', '23']);
   * ```
   */
  public setOutputOptions(opts: string[]): FFmpeggy {
    this.outputOptions = [...this.outputOptions, ...opts];
    return this;
  }

  /**
   * Triggers automatic execution of the FFmpeg process.
   * This method will start the process if the FFmpeg binary is configured
   * and the process is not already running.
   *
   * @returns This FFmpeggy instance for method chaining
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({
   *   input: 'input.mp4',
   *   output: 'output.mp4'
   * });
   *
   * // Configure FFmpeg binary path
   * ffmpeg.ffmpegBin = '/usr/bin/ffmpeg';
   *
   * // Trigger execution
   * ffmpeg.triggerAutorun();
   * ```
   */
  public triggerAutorun(): FFmpeggy {
    this.shouldAutorun = true;
    if (this.ffmpegBin && !this.running) {
      this.run();
    }
    return this;
  }

  /**
   * Resets the FFmpeggy instance to its initial state.
   * This method stops any running process and clears all configuration.
   *
   * @returns Promise that resolves when the reset is complete
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({
   *   input: 'input.mp4',
   *   output: 'output.mp4'
   * });
   *
   * await ffmpeg.run();
   *
   * // Reset for new operation
   * await ffmpeg.reset();
   * ffmpeg.setInput('new-input.mp4').setOutput('new-output.mp4');
   * ```
   */
  public async reset(): Promise<void> {
    if (this.process) {
      await this.stop(15);
    }
    this.inputs = [];
    this.outputs = [];
    this.globalOptions = [];
    this.inputOptions = [];
    this.outputOptions = [];
    this.outputStream = new PassThrough();
    this._wantsStream = false;
    this.error = undefined;
    this.finalSizes = undefined;
    this.currentFile = undefined;
    this.firstOutputFile = undefined;
    this.shouldAutorun = false;
    Object.assign(this, FFmpeggy.DefaultConfig);
  }

  /**
   * Returns a PassThrough stream that will receive the FFmpeg output.
   * This method must be called before run() to enable streaming output.
   *
   * @returns A PassThrough stream that will receive the FFmpeg output
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({
   *   input: 'input.mp4',
   *   output: 'output.mp4'
   * });
   *
   * const outputStream = ffmpeg.toStream();
   * outputStream.pipe(process.stdout);
   *
   * await ffmpeg.run();
   * ```
   */
  public toStream(): PassThrough {
    this._wantsStream = true;
    return this.outputStream;
  }

  /**
   * Probes the first input file to get media information.
   *
   * @returns Promise that resolves to the FFprobe result
   * @throws Error if no input is specified or if the input is a stream
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({ input: 'input.mp4' });
   * const info = await ffmpeg.probe();
   * console.log('Duration:', info.format.duration);
   * console.log('Streams:', info.streams.length);
   * ```
   */
  public async probe(): Promise<FFprobeResult> {
    const { inputs } = this;
    if (inputs.length === 0) {
      throw new Error("No input file specified");
    }

    const firstInput = inputs[0];
    let inputPath: string;

    if (typeof firstInput === "string") {
      inputPath = firstInput;
    } else if (firstInput instanceof ReadStream) {
      throw new Error(
        "Probe can only accept strings. Use static FFmpeg.probe() directly.",
      );
    } else {
      if (typeof firstInput.source === "string") {
        inputPath = firstInput.source;
      } else {
        throw new Error(
          "Probe can only accept strings. Use static FFmpeg.probe() directly.",
        );
      }
    }

    const result = await FFmpeggy.probe(inputPath);
    return result;
  }

  /**
   * Probes a specific input file by index to get media information.
   *
   * @param index - The index of the input to probe (default: 0)
   * @returns Promise that resolves to the FFprobe result
   * @throws Error if the index is out of range or if the input is a stream
   *
   * @example
   * ```typescript
   * const ffmpeg = new FFmpeggy({
   *   inputs: ['video.mp4', 'audio.mp3']
   * });
   *
   * const videoInfo = await ffmpeg.probeInput(0);
   * const audioInfo = await ffmpeg.probeInput(1);
   * ```
   */
  public async probeInput(index: number = 0): Promise<FFprobeResult> {
    const { inputs } = this;
    if (index >= inputs.length) {
      throw new Error(
        `Input index ${index} out of range (${inputs.length} inputs)`,
      );
    }

    const input = inputs[index];
    let inputPath: string;

    if (typeof input === "string") {
      inputPath = input;
    } else if (input instanceof ReadStream) {
      throw new Error(
        "Probe can only accept strings. Use static FFmpeg.probe() directly.",
      );
    } else {
      if (typeof input.source === "string") {
        inputPath = input.source;
      } else {
        throw new Error(
          "Probe can only accept strings. Use static FFmpeg.probe() directly.",
        );
      }
    }

    const result = await FFmpeggy.probe(inputPath);
    return result;
  }

  /**
   * Static method to probe a file using FFprobe.
   *
   * @param filePath - The path to the file to probe
   * @returns Promise that resolves to the FFprobe result
   * @throws Error if FFprobe binary is missing or if probing fails
   *
   * @example
   * ```typescript
   * const info = await FFmpeggy.probe('input.mp4');
   * console.log('File info:', info.format);
   * console.log('Video stream:', info.streams.find(s => s.codec_type === 'video'));
   * ```
   */
  public static async probe(filePath: string): Promise<FFprobeResult> {
    const args = [...FFmpeggy.DefaultConfig.ffprobeArgs, filePath];
    try {
      const binPath = FFmpeggy.DefaultConfig.ffprobeBin;
      if (!binPath) {
        throw Error("Missing path to ffprobe binary");
      }
      const { stdout, exitCode } = await execa(
        FFmpeggy.DefaultConfig.ffprobeBin,
        args,
        {
          timeout: 30000, // 30 second timeout to prevent hanging
        },
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

  /**
   * Extracts concise error information from the FFmpeg log.
   *
   * @param log - The full FFmpeg log output
   * @param maxLines - Maximum number of lines to include (default: 3)
   * @param maxLength - Maximum length of the error message (default: 250)
   * @returns A concise error message
   * @private
   */
  private extractConciseError(
    log: string,
    maxLines = 3,
    maxLength = 250,
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

  private _setupProgressTimeout(): void {
    if (!this.timeout) return;
    this._lastProgressTime = Date.now();
    if (this._timeoutTimer) clearInterval(this._timeoutTimer);
    this._timeoutTimer = setInterval(
      () => {
        if (
          this._lastProgressTime &&
          Date.now() - this._lastProgressTime > this.timeout!
        ) {
          if (this._timeoutTimer) {
            clearInterval(this._timeoutTimer);
          }
          this._timeoutTimer = undefined;
          this._killFFmpegWithTimeoutError();
        }
      },
      Math.max(250, Math.min(this.timeout! / 2, 2000)),
    );
  }

  private _clearProgressTimeout(): void {
    if (this._timeoutTimer) {
      clearInterval(this._timeoutTimer);
      this._timeoutTimer = undefined;
    }
  }

  private _killFFmpegWithTimeoutError(): void {
    this._clearProgressTimeout();
    if (this.process) {
      this.process.kill("SIGKILL");
    }
    const err = new Error(
      `FFmpeg process timed out: no progress for ${this.timeout} ms`,
    );
    this.emit("error", err);
  }

  /**
   * Set the timeout (ms) for no progress events.
   * @param ms Timeout in milliseconds
   * @returns this
   */
  public setTimeout(ms: number): this {
    this.timeout = ms;
    return this;
  }
}

Object.setPrototypeOf(FFmpeggy.prototype, EventEmitter.prototype);
