// Converts input bitrate to kbits/s
export function parseBitrate(bitrate, unit) {
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
