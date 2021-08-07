import { FFmpeggyProgress } from "./types/FFmpeggyProgress";
import { parseBitrate } from "./utils/parseBitrate";
import { parseSize } from "./utils/parseSize";
import { timerToSecs } from "./utils/timerToSecs";

const progressRxp =
  /(?:frame=\s*(?<frame>[\d]+)\s+)?(?:fps=\s*(?<fps>[\d.]+)\s+)?(?:q=(?<q>[0-9.-]+)\s+(L?)\s*)?size=\s*(?<size>[0-9]+)(?<sizeunit>kB|mB|b)?\s*time=\s*(?<time>\d\d:\d\d:\d\d\.\d\d)\s*bitrate=\s*(?<bitrate>N\/A|[\d.]+)(?<bitrateunit>bits\/s|mbits\/s|kbits\/s)?.*(dup=(?<duplicates>\d+)\s*)?(drop=(?<dropped>\d+)\s*)?speed=\s*(?<speed>[\d.e+]+)x/;
export function parseProgress(data: string): FFmpeggyProgress | undefined {
  const matches = progressRxp.exec(data);
  if (!matches || !matches.groups) {
    return;
  }
  const {
    frame,
    fps,
    q,
    size,
    sizeunit,
    time,
    bitrate,
    bitrateunit,
    duplicates,
    dropped,
    speed,
  } = matches.groups;

  return {
    frame: typeof frame !== "undefined" ? Number(frame) : undefined,
    fps: typeof frame !== "undefined" ? Number(fps) : undefined,
    q: typeof frame !== "undefined" ? Number(q) : undefined,
    size:
      typeof size !== "undefined" && sizeunit
        ? parseSize(Number(size) || 0, sizeunit)
        : 0,
    time: time ? timerToSecs(time) : undefined,
    bitrate:
      typeof bitrate !== "undefined" && bitrateunit
        ? parseBitrate(Number(bitrate), bitrateunit)
        : 0,
    duplicates:
      typeof duplicates !== "undefined" ? Number(duplicates) : undefined,
    dropped: typeof dropped !== "undefined" ? Number(dropped) : undefined,
    speed: typeof speed !== "undefined" ? Number(speed) : undefined,
  };
}

interface FFmpegInfo {
  duration: number;
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
    duration: timerToSecs(matches[1]),
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
