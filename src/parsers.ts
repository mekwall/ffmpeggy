import { FFmpegProgress } from "./types/FFmpegProgress";
import { parseBitrate } from "./utils/parseBitrate";
import { parseSize } from "./utils/parseSize";
import { timerToSecs } from "./utils/timerToSecs";

const progressRxp =
  /frame=\s*(?<frame>[\d]+)\s+fps=\s*(?<fps>[\d.]+)\s+q=(?<q>[0-9.-]+)\s+(L?)\s*size=\s*(?<size>[0-9]+)(?<sizeunit>kB|mB|b)?\s*time=\s*(?<time>\d\d:\d\d:\d\d\.\d\d)\s*bitrate=\s*(?<bitrate>N\/A|[\d.]+)(?<bitrateunit>bits\/s|mbits\/s|kbits\/s)?.*(dup=(?<duplicates>\d+)\s*)?(drop=(?<dropped>\d+)\s*)?speed=\s*(?<speed>[\d.e+]+)x/;
export function parseProgress(data: string): FFmpegProgress | undefined {
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
    frame: Number(frame),
    fps: Number(fps),
    q: Number(q),
    size: size && sizeunit ? parseSize(Number(size) || 0, sizeunit) : 0,
    time: timerToSecs(time),
    bitrate: bitrate && bitrateunit ? parseBitrate(Number(bitrate), bitrateunit): 0,
    duplicates: Number(duplicates || 0),
    dropped: Number(dropped || 0),
    speed: Number(speed),
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
