import type { ReadStream, WriteStream } from "fs";
import type { FFmpeggyInput } from "./FFmpeggyInput";
import type { FFmpeggyOutputs } from "./FFmpeggyOutput";

/**
 * Base configuration options for FFmpeggy operations.
 */
interface FFmpeggyBaseOptions {
  /** Working directory for FFmpeg operations */
  cwd?: string;
  /** Set to true to pipe output to stdout */
  pipe?: boolean;
  /** Global FFmpeg options */
  globalOptions?: string[];
  /** Input-specific FFmpeg options */
  inputOptions?: string[];
  /** Output-specific FFmpeg options */
  outputOptions?: string[];
  /** Whether to overwrite existing output files */
  overwriteExisting?: boolean;
  /** Whether to hide FFmpeg banner output */
  hideBanner?: boolean;
  /** Whether to automatically start processing */
  autorun?: boolean;
  /** Whether to use tee pseudo-muxer for multiple outputs */
  tee?: boolean;
  /**
   * Timeout in milliseconds for no progress. If set, FFmpeg will be killed if no progress event is received within this time.
   */
  timeout?: number;
}

/**
 * Configuration with single input and single output.
 */
interface FFmpeggySingleIOSingleOOOptions extends FFmpeggyBaseOptions {
  /** Single input file or stream */
  input?: string | ReadStream;
  /** Single output file or stream */
  output?: string | WriteStream;
  /** Array of input files, streams, or input objects with options - not allowed with single input */
  inputs?: never;
  /** Array of output files, streams, or output objects with options - not allowed with single output */
  outputs?: never;
}

/**
 * Configuration with single input and multiple outputs.
 */
interface FFmpeggySingleIOMultipleOOOptions extends FFmpeggyBaseOptions {
  /** Single input file or stream */
  input?: string | ReadStream;
  /** Single output file or stream - not allowed with multiple outputs */
  output?: never;
  /** Array of input files, streams, or input objects with options - not allowed with single input */
  inputs?: never;
  /** Array of output files, streams, or output objects with options */
  outputs?: FFmpeggyOutputs;
}

/**
 * Configuration with multiple inputs and single output.
 */
interface FFmpeggyMultipleIOSingleOOOptions extends FFmpeggyBaseOptions {
  /** Single input file or stream - not allowed with multiple inputs */
  input?: never;
  /** Single output file or stream */
  output?: string | WriteStream;
  /** Array of input files, streams, or input objects with options */
  inputs?: (string | ReadStream | FFmpeggyInput)[];
  /** Array of output files, streams, or output objects with options - not allowed with single output */
  outputs?: never;
}

/**
 * Configuration with multiple inputs and multiple outputs.
 */
interface FFmpeggyMultipleIOMultipleOOOptions extends FFmpeggyBaseOptions {
  /** Single input file or stream - not allowed with multiple inputs */
  input?: never;
  /** Single output file or stream - not allowed with multiple outputs */
  output?: never;
  /** Array of input files, streams, or input objects with options */
  inputs?: (string | ReadStream | FFmpeggyInput)[];
  /** Array of output files, streams, or output objects with options */
  outputs?: FFmpeggyOutputs;
}

/**
 * Configuration options for FFmpeggy operations.
 *
 * Note: You cannot mix single and multiple inputs (input + inputs) or single and multiple outputs (output + outputs).
 * However, you can mix single input with multiple outputs and vice versa.
 *
 * Valid combinations:
 * - Single input + Single output
 * - Single input + Multiple outputs
 * - Multiple inputs + Single output
 * - Multiple inputs + Multiple outputs
 */
export type FFmpeggyOptions =
  | FFmpeggySingleIOSingleOOOptions
  | FFmpeggySingleIOMultipleOOOptions
  | FFmpeggyMultipleIOSingleOOOptions
  | FFmpeggyMultipleIOMultipleOOOptions;
