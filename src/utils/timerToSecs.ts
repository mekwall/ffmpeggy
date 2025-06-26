/**
 * Converts a time string in the format "HH:MM:SS.MS" to a number of seconds.
 *
 * @param input - A time string in the format "HH:MM:SS.MS".
 * @returns The number of seconds represented by the input time string, rounded to two decimal places.
 * @throws Error if the input is not a valid time string.
 */
export function timerToSecs(input: string): number {
  if (!input || typeof input !== "string") {
    throw new Error("Invalid input: must be a non-empty string");
  }

  const trimmedInput = input.trim();
  if (trimmedInput === "N/A" || trimmedInput === "") {
    throw new Error('Invalid time string: cannot parse "N/A" or empty string');
  }

  const timer = trimmedInput.split(":");
  if (timer.length !== 3) {
    throw new Error(
      `Invalid time format: expected "HH:MM:SS.MS", got "${input}"`,
    );
  }

  const hours = +timer[0];
  const mins = +timer[1];
  const secs = parseFloat(timer[2]);

  if (isNaN(hours) || isNaN(mins) || isNaN(secs)) {
    throw new Error(`Invalid time values: cannot parse "${input}"`);
  }

  return Math.round((hours * 3600 + mins * 60 + secs) * 100) / 100;
}
