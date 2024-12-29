/**
 * Converts a number of seconds to a formatted timer string in the format "HH:MM:SS.MS".
 *
 * @param seconds - The number of seconds to convert.
 * @returns A formatted timer string.
 */
export function secsToTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = Math.floor(seconds - m * 60 - h * 3600);
  const ms = seconds % 1;
  return (
    h.toString().padStart(2, "0") +
    ":" +
    m.toString().padStart(2, "0") +
    ":" +
    s.toString().padStart(2, "0") +
    "." +
    Math.round(ms * 100)
  );
}
