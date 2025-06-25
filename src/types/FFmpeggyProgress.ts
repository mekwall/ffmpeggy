export interface FFmpeggyProgress {
  frame?: number;
  fps?: number;
  q?: number;
  size?: number;
  time?: number;
  bitrate?: number;
  duplicates?: number;
  dropped?: number;
  speed?: number;
}

/**
 * Progress event for a specific output (or input/output pair).
 * - outputIndex: index of the output in the outputs array
 * - file: output file name or stream description
 */
export type FFmpeggyProgressEvent = FFmpeggyProgress & {
  duration?: number;
  percent?: number;
  outputIndex?: number;
  file?: string;
};

/**
 * Final sizes for a specific output (or input/output pair).
 * - outputIndex: index of the output in the outputs array
 * - file: output file name or stream description
 */
export interface FFmpeggyFinalSizes {
  video?: number; // Size in bytes
  audio?: number; // Size in bytes
  subtitles?: number; // Size in bytes
  otherStreams?: number; // Size in bytes
  globalHeaders?: number; // Size in bytes
  muxingOverhead?: number; // Percentage as decimal (e.g., 0.414726)
  outputIndex?: number;
  file?: string;
}
