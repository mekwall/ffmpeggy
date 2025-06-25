import { describe, expect, it } from "vitest";
import { secsToTimer } from "#/utils/secsToTimer.js";

describe("secsToTimer", () => {
  it("should convert seconds to HH:MM:SS.MS", () => {
    const fourHours = 4 * 60 * 60;
    const fortyTwoMinutes = 42 * 60;
    const output = secsToTimer(fourHours + fortyTwoMinutes + 21.64);
    expect(output).toBe("04:42:21.64");
  });
});
