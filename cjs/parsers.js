"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWriting = exports.parseInfo = exports.parseProgress = void 0;
const parseBitrate_1 = require("./utils/parseBitrate");
const parseSize_1 = require("./utils/parseSize");
const timerToSecs_1 = require("./utils/timerToSecs");
const progressRxp = /(?:frame=\s*(?<frame>[\d]+)\s+)?(?:fps=\s*(?<fps>[\d.]+)\s+)?(?:q=(?<q>[0-9.-]+)\s+)?(L?)size=\s*(?<size>[0-9]+|N\/A)(?<sizeunit>kB|mB|b)?\s*time=\s*(?<time>\d\d:\d\d:\d\d\.\d\d)\s*bitrate=\s*(?<bitrate>N\/A|[\d.]+)(?<bitrateunit>bits\/s|mbits\/s|kbits\/s)?.*(dup=(?<duplicates>\d+)\s*)?(drop=(?<dropped>\d+)\s*)?speed=\s*(?<speed>[\d.e+]+)x/;
function parseProgress(data) {
    const matches = progressRxp.exec(data);
    if (!matches || !matches.groups) {
        return;
    }
    const v = matches.groups;
    const frame = typeof v.frame !== "undefined" ? Number(v.frame) : undefined;
    const fps = typeof v.fps !== "undefined" ? Number(v.fps) : undefined;
    const q = typeof v.q !== "undefined" ? Number(v.q) : undefined;
    const size = typeof v.size !== "undefined" && v.sizeunit
        ? parseSize_1.parseSize(Number(v.size) || 0, v.sizeunit)
        : v.size === "N/A"
            ? undefined
            : 0;
    const time = v.time ? timerToSecs_1.timerToSecs(v.time) : undefined;
    const bitrate = typeof v.bitrate !== "undefined" && v.bitrateunit
        ? parseBitrate_1.parseBitrate(Number(v.bitrate), v.bitrateunit)
        : v.bitrate === "N/A"
            ? undefined
            : 0;
    const duplicates = typeof v.duplicates !== "undefined" ? Number(v.duplicates) : undefined;
    const dropped = typeof v.dropped !== "undefined" ? Number(v.dropped) : undefined;
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
exports.parseProgress = parseProgress;
const infoRxp = /Duration: ([^,]+), start: ([^,]+), bitrate: ([^ ]+) (b\s|kb\/s|mb\s)/;
function parseInfo(data) {
    const matches = infoRxp.exec(data);
    if (!matches) {
        return;
    }
    return {
        duration: timerToSecs_1.timerToSecs(matches[1]),
        start: Number(matches[2]),
        bitrate: parseBitrate_1.parseBitrate(Number(matches[3]), matches[4]),
    };
}
exports.parseInfo = parseInfo;
const writingRxp = /Opening '(.+)' for writing/;
function parseWriting(data) {
    const matches = writingRxp.exec(data);
    if (!matches) {
        return;
    }
    return matches[1];
}
exports.parseWriting = parseWriting;
