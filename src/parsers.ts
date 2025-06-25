import {
  FFmpeggyProgress,
  FFmpeggyFinalSizes,
} from "./types/FFmpeggyProgress.js";
import { parseBitrate } from "./utils/parseBitrate.js";
import { parseSize } from "./utils/parseSize.js";
import { timerToSecs } from "./utils/timerToSecs.js";

const progressRxp =
  /(?:frame=\s*(?<frame>[\d]+)\s+)?(?:fps=\s*(?<fps>[\d.]+)\s+)?(?:q=(?<q>[0-9.-]+)\s+)?(L?)size=\s*(?<size>[0-9]+|N\/A)(?<sizeunit>kB|mB|b)?\s*(?:time=\s*(?<time>\d\d:\d\d:\d\d\.\d\d)\s*)?bitrate=\s*(?<bitrate>N\/A|[\d.]+)(?<bitrateunit>bits\/s|mbits\/s|kbits\/s)?.*(dup=(?<duplicates>\d+)\s*)?(drop=(?<dropped>\d+)\s*)?speed=\s*(?<speed>[\d.e+]+)x/;
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
  const durationStr = matches[1];
  let duration: number | undefined;

  if (durationStr) {
    const trimmedDuration = durationStr.trim();
    if (trimmedDuration !== "N/A") {
      duration = timerToSecs(trimmedDuration);
    }
  }

  return {
    duration,
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

export function parseFinalSizes(data: string): FFmpeggyFinalSizes | undefined {
  const result: FFmpeggyFinalSizes = {
    video: 0,
    audio: 0,
    subtitles: 0,
    otherStreams: 0,
    globalHeaders: 0,
    muxingOverhead: 0,
  };

  // Match each field individually with a global regex
  // This handles different field orders, missing fields, and extra fields
  const regex =
    /(video|audio|subtitle[s]?|other streams|global headers):\s*(\d+)(kB|MB|B)/g;
  let match;

  while ((match = regex.exec(data)) !== null) {
    const key = match[1].toLowerCase();
    const value = parseSize(Number(match[2]), match[3]);

    switch (key) {
      case "video":
        result.video = value;
        break;
      case "audio":
        result.audio = value;
        break;
      case "subtitle":
      case "subtitles":
        result.subtitles = value;
        break;
      case "other streams":
        result.otherStreams = value;
        break;
      case "global headers":
        result.globalHeaders = value;
        break;
    }
  }

  // Parse muxing overhead percentage if present
  const muxingRegex = /muxing overhead:\s*([\d.]+)%/;
  const muxingMatch = muxingRegex.exec(data);
  if (muxingMatch) {
    result.muxingOverhead = Number(muxingMatch[1]) / 100; // Convert percentage to decimal
  }

  // Only return if at least one size field was found or muxing overhead was parsed
  if (
    result.video ||
    result.audio ||
    result.subtitles ||
    result.otherStreams ||
    result.globalHeaders ||
    (result.muxingOverhead && result.muxingOverhead > 0)
  ) {
    return result;
  }

  return;
}
