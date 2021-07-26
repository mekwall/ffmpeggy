export interface FFmpegProgress {
  frame: number;
  fps: number;
  q: number;
  size: number;
  time: number;
  bitrate: number;
  duplicates: number;
  dropped: number;
  speed: number;
}
