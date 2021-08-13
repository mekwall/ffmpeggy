/// <reference types="node" />
import { ReadStream, WriteStream } from "fs";
import { PassThrough } from "stream";
import execa from "execa";
import TypedEmitter from "typed-emitter";
import { FFmpegProgress } from "./types/FFmpegProgress";
import { FFprobeResult } from "./types/probeTypes";
export interface FFMpegOptions {
    cwd?: string;
    input?: string | ReadStream;
    output?: string | WriteStream;
    pipe?: boolean;
    globalOptions?: string[];
    inputOptions?: string[];
    outputOptions?: string[];
    autorun?: boolean;
}
declare type FFmpegProgressEvent = FFmpegProgress & {
    duration?: number;
    progress?: number;
};
interface FFmpegEvents {
    start: (ffmpegArgs: readonly string[]) => void;
    error: (error: Error) => void;
    done: (file?: string) => void;
    exit: (code?: number | null, error?: Error) => void;
    probe: (probeResult: FFprobeResult) => void;
    progress: (progress: FFmpegProgressEvent) => void;
    writing: (file: string) => void;
}
declare const FFmpeg_base: new () => TypedEmitter<FFmpegEvents>;
export declare class FFmpeg extends FFmpeg_base {
    running: boolean;
    status?: execa.ExecaReturnValue;
    process?: execa.ExecaChildProcess;
    error?: Error;
    currentFile?: string;
    input: string | ReadStream;
    outputOptions: string[];
    inputOptions: string[];
    globalOptions: string[];
    ffmpegBin: string;
    ffprobeBin: string;
    cwd: string;
    output: string | WriteStream;
    overwriteExisting: boolean;
    static DefaultConfig: {
        cwd: string;
        output: string;
        overwriteExisting: boolean;
        ffmpegBin: string;
        ffprobeBin: string;
        ffprobeArgs: string[];
    };
    private log;
    private pipedOutput;
    private outputStream;
    constructor(opts?: FFMpegOptions);
    run(): Promise<execa.ExecaChildProcess<string> | undefined>;
    private parseOutput;
    private awaitStatus;
    stop(signal?: number): Promise<void>;
    done(): Promise<void>;
    setOverwriteExisting(overwriteExisting: boolean): FFmpeg;
    setCwd(cwd: string): FFmpeg;
    setInput(input: string): FFmpeg;
    setOutput(output: string): FFmpeg;
    setGlobalOptions(opts: string[]): FFmpeg;
    setInputOptions(opts: string[]): FFmpeg;
    setOutputOptions(opts: string[]): FFmpeg;
    reset(): Promise<void>;
    toStream(): PassThrough;
    probe(): Promise<FFprobeResult>;
    static probe(filePath: string): Promise<FFprobeResult>;
}
export {};
//# sourceMappingURL=FFmpeg.d.ts.map