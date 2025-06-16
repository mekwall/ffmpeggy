import { describe, expect, it } from "vitest";
import { timerToSecs } from "../timerToSecs";

describe("secsToTimer", () => {
  it("should convert HH:MM:SS.MS to seconds", () => {
    const fourHours = 4 * 60 * 60;
    const fortyTwoMinutes = 42 * 60;
    const expectedResult = fourHours + fortyTwoMinutes + 21.64;
    const input = "04:42:21.64";
    expect(timerToSecs(input)).toBe(expectedResult);
  });
});
