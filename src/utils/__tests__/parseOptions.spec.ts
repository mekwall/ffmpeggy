import { describe, expect, it } from "vitest";
import { parseOptions } from "../parseOptions";

describe("parseOptions", () => {
  it("should parse simple string array", () => {
    const input = ["one two", "three"];
    const expected = ["one", "two", "three"];
    expect(parseOptions(input)).toEqual(expected);
  });

  it("should handle empty array", () => {
    expect(parseOptions([])).toEqual([]);
  });

  it("should parse quoted strings correctly", () => {
    const input = ['"hello world"', '"goodbye world"'];
    const expected = ['"hello world"', '"goodbye world"'];
    expect(parseOptions(input)).toEqual(expected);
  });

  it("should handle mixed quoted and unquoted strings", () => {
    const input = ['simple "quoted value" unquoted'];
    const expected = ["simple", '"quoted value"', "unquoted"];
    expect(parseOptions(input)).toEqual(expected);
  });

  it("should handle empty strings", () => {
    const input = [""];
    expect(parseOptions(input)).toEqual([]);
  });

  it("should handle multiple spaces between options", () => {
    const input = ["one    two     three"];
    const expected = ["one", "two", "three"];
    expect(parseOptions(input)).toEqual(expected);
  });

  it("should preserve quoted strings with spaces", () => {
    const input = ['"this is one" "this    is    two"', "'this is three'"];
    const expected = [
      '"this is one"',
      '"this    is    two"',
      "'this is three'",
    ];
    expect(parseOptions(input)).toEqual(expected);
  });
});
