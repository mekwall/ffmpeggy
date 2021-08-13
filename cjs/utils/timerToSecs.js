"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timerToSecs = void 0;
// Convert HH:MM:SS.MS to seconds
function timerToSecs(input) {
    const timer = input.split(":");
    const hours = +timer[0];
    const mins = +timer[1];
    const secs = parseFloat(timer[2]);
    return Math.round((hours * 3600 + mins * 60 + secs) * 100) / 100;
}
exports.timerToSecs = timerToSecs;
