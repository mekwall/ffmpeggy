/**
 * Converts a time string in the format "HH:MM:SS.MS" to a number of seconds.
 *
 * @param input - A time string in the format "HH:MM:SS.MS".
 * @returns The number of seconds represented by the input time string, rounded to two decimal places.
 */
export function timerToSecs(input: string): number {
  const timer = input.split(":");
  const hours = +timer[0];
  const mins = +timer[1];
  const secs = parseFloat(timer[2]);
  return Math.round((hours * 3600 + mins * 60 + secs) * 100) / 100;
}
