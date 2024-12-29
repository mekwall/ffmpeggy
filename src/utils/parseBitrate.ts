/**
 * Converts the given bitrate value to kilobits per second (kbps) based on the provided unit.
 *
 * @param bitrate The bitrate value to be converted.
 * @param unit The unit of the given bitrate value. Supported units are "b/s", "bit/s", "bits/s", "kb/s", "kbit/s", "kbits/s", "mb/s", "mbit/s", and "mbits/s".
 * @returns The bitrate value converted to kbps.
 * @throws Error if the provided unit is not recognized.
 */
export function parseBitrate(bitrate: number, unit: string): number {
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
