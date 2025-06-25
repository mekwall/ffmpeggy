import type { ReadStream } from "fs";

/**
 * Input configuration for FFmpeg operations.
 */
export interface FFmpeggyInput {
  /** Input source (file path or readable stream) */
  source: string | ReadStream;
  /** Optional FFmpeg input options */
  options?: string[];
}
