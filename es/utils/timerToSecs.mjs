// Convert HH:MM:SS.MS to seconds
export function timerToSecs(input) {
    const timer = input.split(":");
    const hours = +timer[0];
    const mins = +timer[1];
    const secs = parseFloat(timer[2]);
    return Math.round((hours * 3600 + mins * 60 + secs) * 100) / 100;
}
