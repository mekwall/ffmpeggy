"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFmpeggy = void 0;
const events_1 = __importDefault(require("events"));
const fs_1 = require("fs");
const process_1 = require("process");
const stream_1 = require("stream");
const debug_1 = __importDefault(require("debug"));
const execa_1 = __importDefault(require("execa"));
const parsers_1 = require("./parsers");
const debug = debug_1.default("ffmpeggy");
class FFmpeggy extends events_1.default {
    running = false;
    status;
    process;
    error;
    currentFile;
    input = "";
    outputOptions = [];
    inputOptions = [];
    globalOptions = ["-stats"];
    // set from DefaultConfig in constructor
    ffmpegBin;
    ffprobeBin;
    cwd;
    output;
    overwriteExisting;
    hideBanner;
    static DefaultConfig = {
        cwd: process.cwd(),
        output: "",
        overwriteExisting: false,
        hideBanner: true,
        ffmpegBin: "",
        ffprobeBin: "",
        ffprobeArgs: [
            "-hide_banner",
            "-show_format",
            "-show_streams",
            "-print_format",
            "json",
            "-loglevel",
            "quiet",
        ],
    };
    log = "";
    pipedOutput = false;
    outputStream = new stream_1.PassThrough();
    constructor(opts = {}) {
        super();
        Object.assign(this, FFmpeggy.DefaultConfig);
        if (opts.cwd) {
            this.cwd = opts.cwd;
        }
        if (opts.input) {
            this.input = opts.input;
        }
        if (opts.output) {
            this.output = opts.output;
        }
        if (opts.pipe) {
            this.output = "-";
        }
        if (opts.globalOptions) {
            this.globalOptions = opts.globalOptions;
        }
        if (opts.inputOptions) {
            this.inputOptions = opts.inputOptions;
        }
        if (opts.outputOptions) {
            this.outputOptions = opts.outputOptions;
        }
        if (opts.autorun) {
            this.run();
        }
    }
    async run() {
        // Return any existing process
        if (this.process) {
            debug("returning existing process");
            return this.process;
        }
        const { cwd, input, output, ffmpegBin, globalOptions, inputOptions, outputOptions, } = this;
        if (!ffmpegBin) {
            throw Error("Missing path to ffmpeg binary");
        }
        if (!input) {
            throw new Error("No input specified");
        }
        if (!output) {
            throw new Error("No output specified");
        }
        const ffmpegInput = input instanceof fs_1.ReadStream ? "pipe:" : input;
        const ffmpegOutput = output instanceof fs_1.WriteStream ? "pipe:" : output;
        if (this.hideBanner) {
            globalOptions.push("-hide_banner");
        }
        if (this.overwriteExisting) {
            globalOptions.push("-y");
        }
        const args = [
            ...globalOptions.join(" ").split(" "),
            ...inputOptions.join(" ").split(" "),
            ...["-i", ffmpegInput],
            ...outputOptions.join(" ").split(" "),
            ffmpegOutput,
        ].filter((a) => !!a);
        if (ffmpegOutput.startsWith("pipe:") || output === "-") {
            this.pipedOutput = true;
        }
        else if (!ffmpegOutput.includes("%d")) {
            this.currentFile = ffmpegOutput;
        }
        const joinedArgs = args;
        try {
            this.emit("start", joinedArgs);
            debug("bin: %s", ffmpegBin);
            debug("args: %o", joinedArgs);
            if (input instanceof fs_1.ReadStream) {
                // We need to wait for the input stream to open before we can pass it
                // More info: https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_options_stdio
                await new Promise((resolve) => {
                    input.on("open", resolve);
                });
            }
            if (output instanceof fs_1.WriteStream) {
                // We need to wait for the output stream to open before we can pass it
                // More info:https://nodejs.org/dist/latest/docs/api/child_process.html#child_process_options_stdio
                await new Promise((resolve) => {
                    output.on("open", resolve);
                });
            }
            this.process = execa_1.default(ffmpegBin, joinedArgs, {
                cwd,
                input: input instanceof fs_1.ReadStream ? input : undefined,
                stdout: output instanceof fs_1.WriteStream ? output : undefined,
            });
            // if (this.process.stdin && input instanceof ReadStream) {
            //   input.pipe(this.process.stdin);
            // }
            if (this.process.stdout && output instanceof fs_1.WriteStream) {
                this.process.stdout.pipe(output);
            }
            if (this.pipedOutput) {
                this.process.stdout?.pipe(this.outputStream);
            }
            this.running = true;
        }
        catch (e) {
            this.error = e;
            debug("error: %o", e);
            this.emit("error", e);
            this.emit("exit", 1, e);
            this.running = false;
        }
        this.awaitStatus();
        this.parseOutput();
        return this.process;
    }
    async parseOutput() {
        // ffmpeg uses stdout for piping and stderr for messages
        const output = this.process?.stderr;
        if (output) {
            let duration = 0;
            output.on("data", (data) => {
                const txt = data.toString();
                debug(txt);
                if (!duration) {
                    const info = parsers_1.parseInfo(txt);
                    if (info) {
                        debug("info: %o", info);
                        duration = info.duration;
                    }
                }
                const progress = parsers_1.parseProgress(txt);
                if (progress) {
                    const progressEvent = {
                        ...progress,
                        duration,
                        percent: Math.min(100, progress.time
                            ? Math.round((progress.time / duration) * 100 * 100) / 100
                            : 0),
                    };
                    debug("progress: %o", progressEvent);
                    this.emit("progress", progressEvent);
                }
                const writing = parsers_1.parseWriting(txt);
                if (writing) {
                    if (this.currentFile && !writing.includes("%d")) {
                        debug("done: %o", this.currentFile);
                        this.emit("done", this.currentFile);
                    }
                    this.currentFile = writing;
                    debug("writing: %o", writing);
                    this.emit("writing", writing);
                }
                this.log += txt;
            });
        }
    }
    async awaitStatus() {
        if (this.process) {
            const status = await this.process;
            const code = this.process.exitCode;
            if (code === 1) {
                console.error("FFmpeg failed:", this.log);
            }
            else {
                debug("done: %s", this.currentFile);
                this.emit("done", this.currentFile);
            }
            process_1.nextTick(() => {
                // Wait until next tick to emit the exit event
                // This is to ensure that the done event is emitted
                // before the exit event
                this.status = status;
                this.process = undefined;
                this.running = false;
                debug("exit: %o %o", code, this.error);
                this.emit("exit", code, this.error);
            });
        }
    }
    async stop(signal = 15) {
        // 2 is SIGINT, 9 is SIGKILL, 15 is SIGTERM
        if (this.running && this.process) {
            try {
                this.process.kill(signal);
                await this.process.finally();
            }
            catch (e) {
                this.emit("exit", process.exitCode, this.error);
            }
        }
        this.process = undefined;
        this.running = false;
    }
    async done() {
        if (this.running) {
            await this.process;
        }
    }
    setOverwriteExisting(overwriteExisting) {
        this.overwriteExisting = overwriteExisting;
        return this;
    }
    setCwd(cwd) {
        this.cwd = cwd;
        return this;
    }
    setInput(input) {
        this.input = input;
        return this;
    }
    setOutput(output) {
        this.output = output;
        return this;
    }
    setGlobalOptions(opts) {
        this.globalOptions = [...this.globalOptions, ...opts];
        return this;
    }
    setInputOptions(opts) {
        this.inputOptions = [...this.inputOptions, ...opts];
        return this;
    }
    setOutputOptions(opts) {
        this.outputOptions = [...this.outputOptions, ...opts];
        return this;
    }
    async reset() {
        if (this.process) {
            await this.stop(15);
        }
        this.input = "";
        this.globalOptions = [];
        this.inputOptions = [];
        this.outputOptions = [];
        this.outputStream = new stream_1.PassThrough();
        this.error = undefined;
        Object.assign(this, FFmpeggy.DefaultConfig);
    }
    toStream() {
        return this.outputStream;
    }
    async probe() {
        const { input } = this;
        if (!input) {
            throw new Error("No input file specified");
        }
        if (typeof input !== "string") {
            throw new Error("Probe can only accept strings. Use static FFmpeg.probe() directly.");
        }
        const result = await FFmpeggy.probe(input);
        return result;
    }
    static async probe(filePath) {
        const args = [...FFmpeggy.DefaultConfig.ffprobeArgs, filePath];
        try {
            const binPath = FFmpeggy.DefaultConfig.ffprobeBin;
            if (!binPath) {
                throw Error("Missing path to ffprobe binary");
            }
            const { stdout, exitCode } = await execa_1.default(FFmpeggy.DefaultConfig.ffprobeBin, args);
            if (exitCode === 1) {
                throw Error("Failed to probe");
            }
            try {
                return JSON.parse(stdout);
            }
            catch {
                throw Error("Failed to parse ffprobe output");
            }
        }
        catch (e) {
            throw Error("Failed to probe");
        }
    }
}
exports.FFmpeggy = FFmpeggy;
