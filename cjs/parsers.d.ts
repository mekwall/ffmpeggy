import { FFmpeggyProgress } from "./types/FFmpeggyProgress";
export declare function parseProgress(data: string): FFmpeggyProgress | undefined;
interface FFmpegInfo {
    duration: number;
    start: number;
    bitrate: number;
}
export declare function parseInfo(data: string): FFmpegInfo | undefined;
export declare function parseWriting(data: string): string | undefined;
export {};
//# sourceMappingURL=parsers.d.ts.map