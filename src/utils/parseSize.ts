// Converts input size to bytes
export function parseSize(size: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case "b":
      return size;
    case "kb":
      return size * 1024;
    case "mb":
      return size * 1024 * 1024;
    default:
      throw Error("Unknown unit");
  }
}
