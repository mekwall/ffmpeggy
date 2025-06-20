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

export interface FFmpeggyFinalSizes {
  video?: number; // Size in bytes
  audio?: number; // Size in bytes
  subtitles?: number; // Size in bytes
  otherStreams?: number; // Size in bytes
  globalHeaders?: number; // Size in bytes
  muxingOverhead?: number; // Percentage as decimal (e.g., 0.414726)
}
