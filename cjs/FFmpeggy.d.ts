/// <reference types="node" />
import { ReadStream, WriteStream } from "fs";
import { PassThrough } from "stream";
import execa from "execa";
import TypedEmitter from "typed-emitter";
import { FFmpeggyProgress } from "./types/FFmpeggyProgress";
import { FFprobeResult } from "./types/probeTypes";
export interface FFmpeggyOptions {
    cwd?: string;
    input?: string | ReadStream;
    output?: string | WriteStream;
    pipe?: boolean;
    globalOptions?: string[];
    inputOptions?: string[];
    outputOptions?: string[];
    autorun?: boolean;
    overwriteExisting?: boolean;
    hideBanner?: boolean;
}
export declare type FFmpeggyProgressEvent = FFmpeggyProgress & {
    duration?: number;
    percent?: number;
};
interface FFmpegEvents {
    start: (ffmpegArgs: readonly string[]) => void;
    error: (error: Error) => void;
    done: (file?: string) => void;
    exit: (code?: number | null, error?: Error) => void;
    probe: (probeResult: FFprobeResult) => void;
    progress: (progress: FFmpeggyProgressEvent) => void;
    writing: (file: string) => void;
}
declare const FFmpeggy_base: new () => TypedEmitter<FFmpegEvents>;
export declare class FFmpeggy extends FFmpeggy_base {
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
    hideBanner: boolean;
    static DefaultConfig: {
        cwd: string;
        output: string;
        overwriteExisting: boolean;
        hideBanner: boolean;
        ffmpegBin: string;
        ffprobeBin: string;
        ffprobeArgs: string[];
    };
    log: string;
    private pipedOutput;
    private outputStream;
    constructor(opts?: FFmpeggyOptions);
    run(): Promise<execa.ExecaChildProcess<string> | undefined>;
    private parseOutput;
    private awaitStatus;
    stop(signal?: number): Promise<void>;
    done(): Promise<void>;
    setOverwriteExisting(overwriteExisting: boolean): FFmpeggy;
    setCwd(cwd: string): FFmpeggy;
    setInput(input: string): FFmpeggy;
    setOutput(output: string): FFmpeggy;
    setGlobalOptions(opts: string[]): FFmpeggy;
    setInputOptions(opts: string[]): FFmpeggy;
    setOutputOptions(opts: string[]): FFmpeggy;
    reset(): Promise<void>;
    toStream(): PassThrough;
    probe(): Promise<FFprobeResult>;
    static probe(filePath: string): Promise<FFprobeResult>;
}
export {};
//# sourceMappingURL=FFmpeggy.d.ts.map