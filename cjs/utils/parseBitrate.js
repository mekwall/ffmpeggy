"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBitrate = void 0;
// Converts input bitrate to kbits/s
function parseBitrate(bitrate, unit) {
    switch (unit.toLowerCase()) {
        case "b/s":
        case "bit/s":
        case "bits/s":
            return bitrate / 1000;
        case "kb/s":
        case "kbit/s":
        case "kbits/s":
            return bitrate;
        case "mb/s":
        case "mbit/s":
        case "mbits/s":
            return bitrate * 1000;
        default:
            throw Error("Unknown unit");
    }
}
exports.parseBitrate = parseBitrate;
