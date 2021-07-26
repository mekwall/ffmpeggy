import { parseSize } from "../parseSize";

describe("sizeUnits", () => {
  it("should convert kB to bytes", () => {
    expect(parseSize(1, "kB")).toBe(1024);
  });

  it("should convert MB to bytes", () => {
    expect(parseSize(1, "mB")).toBe(1048576);
  });

  it("shouldn't do anything", () => {
    expect(parseSize(1, "b")).toBe(1);
  });

  it("should throw exception", () => {
    expect(() => parseSize(1, "z")).toThrow(new Error("Unknown unit"));
  });
});
