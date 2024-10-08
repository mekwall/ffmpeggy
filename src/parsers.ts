import { FFmpeggyProgress } from "./types/FFmpeggyProgress";
import { parseBitrate } from "./utils/parseBitrate";
import { parseSize } from "./utils/parseSize";
import { timerToSecs } from "./utils/timerToSecs";

const progressRxp =
  /(?:frame=\s*(?<frame>[\d]+)\s+)?(?:fps=\s*(?<fps>[\d.]+)\s+)?(?:q=(?<q>[0-9.-]+)\s+)?(L?)size=\s*(?<size>[0-9]+|N\/A)(?<sizeunit>kB|mB|b)?\s*time=\s*(?<time>\d\d:\d\d:\d\d\.\d\d)\s*bitrate=\s*(?<bitrate>N\/A|[\d.]+)(?<bitrateunit>bits\/s|mbits\/s|kbits\/s)?.*(dup=(?<duplicates>\d+)\s*)?(drop=(?<dropped>\d+)\s*)?speed=\s*(?<speed>[\d.e+]+)x/;
export function parseProgress(data: string): FFmpeggyProgress | undefined {
  const matches = progressRxp.exec(data);
  if (!matches || !matches.groups) {
    return;
  }
  const v = matches.groups;

  const frame = typeof v.frame !== "undefined" ? Number(v.frame) : undefined;
  const fps = typeof v.fps !== "undefined" ? Number(v.fps) : undefined;
  const q = typeof v.q !== "undefined" ? Number(v.q) : undefined;
  const size =
    typeof v.size !== "undefined" && v.sizeunit
      ? parseSize(Number(v.size) || 0, v.sizeunit)
      : undefined;
  const time = v.time ? timerToSecs(v.time) : undefined;
  const bitrate =
    typeof v.bitrate !== "undefined" && v.bitrateunit
      ? parseBitrate(Number(v.bitrate), v.bitrateunit)
      : undefined;
  const duplicates =
    typeof v.duplicates !== "undefined" ? Number(v.duplicates) : undefined;
  const dropped =
    typeof v.dropped !== "undefined" ? Number(v.dropped) : undefined;
  const speed = typeof v.speed !== "undefined" ? Number(v.speed) : undefined;

  return {
    frame,
    fps,
    q,
    size,
    time,
    bitrate,
    duplicates,
    dropped,
    speed,
  };
}

interface FFmpegInfo {
  duration?: number;
  start: number;
  bitrate: number;
}

const infoRxp =
  /Duration: ([^,]+), start: ([^,]+), bitrate: ([^ ]+) (b\s|kb\/s|mb\s)/;
export function parseInfo(data: string): FFmpegInfo | undefined {
  const matches = infoRxp.exec(data);
  if (!matches) {
    return;
  }
  return {
    duration: matches[1] ? timerToSecs(matches[1]) : undefined,
    start: Number(matches[2]),
    bitrate: parseBitrate(Number(matches[3]), matches[4]),
  };
}

const writingRxp = /Opening '(.+)' for writing/;
export function parseWriting(data: string): string | undefined {
  const matches = writingRxp.exec(data);
  if (!matches) {
    return;
  }
  return matches[1];
}
