import { describe, expect, it } from "vitest";
import { timerToSecs } from "#/utils/timerToSecs";

describe("timerToSecs", () => {
  it("should convert HH:MM:SS.MS to seconds", () => {
    const fourHours = 4 * 60 * 60;
    const fortyTwoMinutes = 42 * 60;
    const expectedResult = fourHours + fortyTwoMinutes + 21.64;
    const input = "04:42:21.64";
    expect(timerToSecs(input)).toBe(expectedResult);
  });

  it("should handle zero values", () => {
    expect(timerToSecs("00:00:00.00")).toBe(0);
    expect(timerToSecs("00:00:01.00")).toBe(1);
    expect(timerToSecs("00:01:00.00")).toBe(60);
    expect(timerToSecs("01:00:00.00")).toBe(3600);
  });

  it("should handle decimal seconds", () => {
    expect(timerToSecs("00:00:00.50")).toBe(0.5);
    expect(timerToSecs("00:00:01.25")).toBe(1.25);
    expect(timerToSecs("00:01:30.75")).toBe(90.75);
  });

  it("should handle large values", () => {
    expect(timerToSecs("23:59:59.99")).toBe(86399.99);
    expect(timerToSecs("99:59:59.99")).toBe(359999.99);
  });

  it("should throw error for N/A input", () => {
    expect(() => timerToSecs("N/A")).toThrow(
      'Invalid time string: cannot parse "N/A" or empty string',
    );
  });

  it("should throw error for empty string", () => {
    expect(() => timerToSecs("")).toThrow(
      "Invalid input: must be a non-empty string",
    );
    expect(() => timerToSecs("   ")).toThrow(
      'Invalid time string: cannot parse "N/A" or empty string',
    );
  });

  it("should throw error for null/undefined input", () => {
    expect(() => timerToSecs(null as unknown as string)).toThrow(
      "Invalid input: must be a non-empty string",
    );
    expect(() => timerToSecs(undefined as unknown as string)).toThrow(
      "Invalid input: must be a non-empty string",
    );
  });

  it("should throw error for invalid format", () => {
    expect(() => timerToSecs("12:34")).toThrow(
      'Invalid time format: expected "HH:MM:SS.MS", got "12:34"',
    );
    expect(() => timerToSecs("12:34:56:78")).toThrow(
      'Invalid time format: expected "HH:MM:SS.MS", got "12:34:56:78"',
    );
    expect(() => timerToSecs("invalid")).toThrow(
      'Invalid time format: expected "HH:MM:SS.MS", got "invalid"',
    );
  });

  it("should throw error for non-numeric values", () => {
    expect(() => timerToSecs("aa:bb:cc.dd")).toThrow(
      'Invalid time values: cannot parse "aa:bb:cc.dd"',
    );
    expect(() => timerToSecs("12:bb:cc.dd")).toThrow(
      'Invalid time values: cannot parse "12:bb:cc.dd"',
    );
    expect(() => timerToSecs("12:34:cc.dd")).toThrow(
      'Invalid time values: cannot parse "12:34:cc.dd"',
    );
  });

  it("should handle whitespace", () => {
    expect(timerToSecs("  04:42:21.64  ")).toBe(16941.64);
  });
});
