import type {
  FFmpeggyProgressEvent,
  FFmpeggyFinalSizes,
} from "./FFmpeggyProgress.js";
import type { FFprobeResult } from "./probeTypes.js";

/**
 * FFmpegEvents defines the event signatures for FFmpeggy.
 *
 * - 'progress': Emitted for each output index as a single event (not an array).
 *   The payload includes outputIndex and file.
 * - 'writing': Emitted when FFmpeg begins writing to a file. For multiple outputs, emits an array at the start (synthetic for tee muxer), otherwise emits per file.
 * - 'done': Emitted when processing completes. For multiple outputs, emits an array of results; for single output, emits a single result.
 */
export type FFmpegEvents = {
  /**
   * Emitted when an error occurs during processing.
   */
  error: (error: Error) => void;
  /**
   * Emitted when the FFmpeg process starts. Provides the arguments passed to FFmpeg.
   */
  start: (ffmpegArgs: readonly string[]) => void;
  /**
   * Emitted when processing completes. For multiple outputs, emits an array of results; for single output, emits a single result.
   * Each result includes: { file, sizes, outputIndex }
   */
  done: (
    result:
      | { file?: string; sizes?: FFmpeggyFinalSizes; outputIndex?: number }
      | Array<{
          file?: string;
          sizes?: FFmpeggyFinalSizes;
          outputIndex?: number;
        }>
  ) => void;
  /**
   * Emitted when the FFmpeg process exits.
   */
  exit: (code?: number | null, error?: Error) => void;
  /**
   * Emitted when media probing completes.
   */
  probe: (probeResult: FFprobeResult) => void;
  /**
   * Emitted for each output index as a single event (not an array).
   * The payload includes outputIndex and file.
   *
   * Example:
   *   ffmpeggy.on('progress', (progress) => {
   *     // progress.outputIndex, progress.file, progress.percent, ...
   *   });
   */
  progress: (progress: FFmpeggyProgressEvent) => void;
  /**
   * Emitted when FFmpeg begins writing to a file (useful for segmented/multi-output).
   * For multiple outputs, emits an array at the start (synthetic for tee muxer), otherwise emits per file.
   * Each payload: { file, outputIndex }
   */
  writing: (
    info:
      | { file: string; outputIndex: number }
      | Array<{ file: string; outputIndex: number }>
  ) => void;
};
