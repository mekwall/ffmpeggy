import { WriteStream } from "node:fs";

/**
 * File output: a string path or an object with a string destination.
 */
export type FileOutput = string | { destination: string; options?: string[] };

/**
 * Stream output: a WriteStream or an object with a WriteStream destination.
 */
export type StreamOutput =
  | WriteStream
  | { destination: WriteStream; options?: string[] };

/**
 * FFmpeggyOutputs allows:
 * - All file outputs (array of FileOutput)
 * - A single stream output (array of one StreamOutput)
 * - For tee muxer: multiple FileOutputs, with at most one StreamOutput as the last output
 *
 * Note: TypeScript cannot fully enforce the tee muxer rule at compile time, so runtime checks are still required.
 */
export type FFmpeggyOutputs =
  | FileOutput[]
  | [StreamOutput]
  | [...FileOutput[], StreamOutput];
