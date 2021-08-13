// Convert seconds to HH:MM:SS.MS
export function secsToTimer(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor(seconds / 60) % 60;
    const s = Math.floor(seconds - m * 60 - h * 3600);
    const ms = seconds % 1;
    return (h.toString().padStart(2, "0") +
        ":" +
        m.toString().padStart(2, "0") +
        ":" +
        s.toString().padStart(2, "0") +
        "." +
        Math.round(ms * 100));
}
