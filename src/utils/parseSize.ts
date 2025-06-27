/**
 * Parses a size value with a unit and returns the size in bytes.
 *
 * @param size - The size value to parse.
 * @param unit - The unit of the size value, e.g. "B", "KB", "MB".
 * @returns The size in bytes.
 * @throws {Error} If the unit is unknown.
 */
export function parseSize(size: number, unit: string): number {
  switch (unit.toLowerCase()) {
    case "b": {
      return size;
    }
    case "kb": {
      return size * 1024;
    }
    case "mb": {
      return size * 1024 * 1024;
    }
    default: {
      throw new Error("Unknown unit");
    }
  }
}
