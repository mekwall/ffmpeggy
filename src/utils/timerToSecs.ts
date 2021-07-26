// Convert HH:MM:SS.MS to seconds
export function timerToSecs(input: string): number {
  const timer = input.split(":");
  const hours = +timer[0];
  const mins = +timer[1];
  const secs = parseFloat(timer[2]);
  return hours * 3600 + mins * 60 + secs;
}
