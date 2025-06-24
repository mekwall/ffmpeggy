# ffmpeggy

[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/mekwall/ffmpeggy/blob/main/LICENSE) [![npm](https://img.shields.io/npm/v/ffmpeggy.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/ffmpeggy) ![npm package size](https://img.shields.io/npm/l/ffmpeggy?style=flat-square) ![node](https://img.shields.io/node/v/ffmpeggy?style=flat-square&logo=node.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue?style=flat-square&logo=typescript) ![FFmpeg](https://img.shields.io/badge/FFmpeg-5.0+-green?style=flat-square&logo=ffmpeg) [![dependencies](https://img.shields.io/librariesio/github/mekwall/ffmpeggy.svg?style=flat-square)](https://github.com/mekwall/ffmpeggy) ![types](https://img.shields.io/npm/types/ffmpeggy.svg?style=flat-square&logo=typescript) [![coverage](https://img.shields.io/codecov/c/github/mekwall/ffmpeggy?style=flat-square)](https://codecov.io/github/mekwall/ffmpeggy?branch=main) ![GitHub last commit](https://img.shields.io/github/last-commit/mekwall/ffmpeggy?style=flat-square&logo=github)

A minimal yet powerful wrapper for [FFmpeg][ffmpeg] and [FFprobe][ffprobe]. Has built-in support for Node.js streams and events that can provide you with a detailed progress report.

This is a hybrid package built in TypeScript that provides both CommonJS and ES modules with only a couple of dependencies.

## ✨ Features

- **🚀 Simple API**: Intuitive interface with method chaining
- **📡 Event-Driven**: Real-time progress updates and status events
- **🔄 Stream Support**: Native Node.js stream integration for input/output
- **⚡ TypeScript**: Full TypeScript support with comprehensive type definitions
- **🔍 Media Probing**: Built-in FFprobe integration for media analysis
- **🛡️ Error Handling**: Robust error handling with descriptive messages
- **⚙️ Flexible Configuration**: Support for all FFmpeg options and arguments
- **📊 Progress Tracking**: Detailed progress events with frame, time, and bitrate info
- **🎯 Hybrid Package**: Works with both CommonJS and ES modules

## 📦 Installation

```sh
npm install --save ffmpeggy
```

**or**

```sh
yarn add ffmpeggy
```

### Installing FFmpeg and FFprobe Binaries

If you don't want to provide your own binaries, you can use the following packages that provide binaries for both ffmpeg and ffprobe:

```sh
npm install --save ffmpeg-static ffprobe-static
```

**or**

```sh
yarn add ffmpeg-static ffprobe-static
```

You can then configure FFmpeggy to use these binaries:

```ts
import ffmpegBin from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";

FFmpeggy.DefaultConfig = {
  ...FFmpeggy.DefaultConfig,
  ffprobeBin,
  ffmpegBin,
};
```

## 🚀 Quick Start

### Basic Usage

```ts
import { FFmpeggy } from "ffmpeggy";

const ffmpeggy = new FFmpeggy();
try {
  ffmpeggy
    .setInput("input.mp4")
    .setOutput("output.mkv")
    .setOutputOptions(["-c:v h264"])
    .run();

  await ffmpeggy.done();
  console.log("Conversion completed!");
} catch (error) {
  console.error("Conversion failed:", error);
}
```

### With Constructor Options

```ts
import { FFmpeggy } from "ffmpeggy";

const ffmpeggy = new FFmpeggy({
  autorun: true,
  input: "input.mp4",
  output: "output.mkv",
  outputOptions: ["-c:v h264"],
  overwriteExisting: true,
});

await ffmpeggy.done();
```

## 📚 API Reference

### Constructor Options

| Option              | Type                    | Description                          | Default         |
| ------------------- | ----------------------- | ------------------------------------ | --------------- |
| `cwd`               | `string`                | Working directory for FFmpeg         | `process.cwd()` |
| `input`             | `string \| ReadStream`  | Input file path or readable stream   | `""`            |
| `output`            | `string \| WriteStream` | Output file path or writable stream  | `""`            |
| `pipe`              | `boolean`               | Enable pipe mode (outputs to stream) | `false`         |
| `globalOptions`     | `string[]`              | FFmpeg global options                | `["-stats"]`    |
| `inputOptions`      | `string[]`              | FFmpeg input options                 | `[]`            |
| `outputOptions`     | `string[]`              | FFmpeg output options                | `[]`            |
| `overwriteExisting` | `boolean`               | Add `-y` flag to overwrite files     | `false`         |
| `hideBanner`        | `boolean`               | Add `-hide_banner` flag              | `true`          |
| `autorun`           | `boolean`               | Automatically run FFmpeg after setup | `false`         |

### Method Chaining

FFmpeggy supports method chaining for fluent configuration:

```ts
const ffmpeggy = new FFmpeggy()
  .setInput("input.mp4")
  .setOutput("output.mkv")
  .setOutputOptions(["-c:v h264", "-c:a aac"])
  .setOverwriteExisting(true)
  .setHideBanner(true);
```

### Events

FFmpeggy extends EventEmitter and provides the following events:

#### `start` - `(ffmpegArgs: readonly string[]) => void`

Fires when the FFmpeg process starts. Provides the arguments passed to FFmpeg.

#### `progress` - `(progress: FFmpeggyProgressEvent) => void`

Fires during processing with detailed progress information:

```ts
interface FFmpeggyProgressEvent {
  frame?: number; // Current frame number
  fps?: number; // Current processing framerate
  q?: number; // Quality scale (usually 0)
  size?: number; // Current output size in KB
  time?: number; // Current processing time in seconds
  bitrate?: number; // Current bitrate
  duplicates?: number; // Duplicate frames
  dropped?: number; // Dropped frames
  speed?: number; // Processing speed multiplier
  duration?: number; // Total duration (calculated)
  percent?: number; // Progress percentage (calculated)
}
```

#### `done` - `(file?: string, sizes?: FFmpeggyFinalSizes) => void`

Fires when processing completes successfully:

```ts
interface FFmpeggyFinalSizes {
  video?: number; // Video stream size in bytes
  audio?: number; // Audio stream size in bytes
  subtitles?: number; // Subtitle stream size in bytes
  otherStreams?: number; // Other stream types size in bytes
  globalHeaders?: number; // Global headers size in bytes
  muxingOverhead?: number; // Muxing overhead as decimal
}
```

#### `error` - `(error: Error) => void`

Fires when an error occurs during processing.

#### `exit` - `(code?: number \| null, error?: Error) => void`

Fires when the FFmpeg process exits.

#### `writing` - `(fileName: string) => void`

Fires when FFmpeg begins writing to a file (useful for segmented output).

#### `probe` - `(probeResult: FFprobeResult) => void`

Fires when media probing completes.

### Media Probing

FFmpeggy includes built-in FFprobe integration for media analysis:

```ts
// Static method
const probeResult = await FFmpeggy.probe("input.mp4");

// Instance method
const ffmpeggy = new FFmpeggy({ input: "input.mp4" });
const probeResult = await ffmpeggy.probe();
```

The probe result includes detailed information about streams, format, and metadata.

### Stream Support

FFmpeggy supports Node.js streams for both input and output:

```ts
import { createReadStream, createWriteStream } from "fs";
import { FFmpeggy } from "ffmpeggy";

// Input stream
const ffmpeggy = new FFmpeggy({
  input: createReadStream("input.mp4"),
  inputOptions: ["-f mp4"], // Format hint for streams
  output: createWriteStream("output.mkv"),
  outputOptions: ["-f matroska", "-c:v h264"],
});

// Output stream
const ffmpeggy = new FFmpeggy({
  input: "input.mp4",
  pipe: true, // Enable pipe mode
});

const outputStream = ffmpeggy.toStream();
outputStream.pipe(createWriteStream("output.mkv"));
```

### Utility Functions

FFmpeggy exports utility functions for time conversion:

```ts
import { secsToTimer, timerToSecs } from "ffmpeggy";

// Convert seconds to HH:MM:SS.MS format
const timer = secsToTimer(3661.5); // "01:01:01.50"

// Convert HH:MM:SS.MS format to seconds
const seconds = timerToSecs("01:01:01.50"); // 3661.5
```

## 🔧 Advanced Usage

### Event-Driven Processing

```ts
import { FFmpeggy } from "ffmpeggy";

const ffmpeggy = new FFmpeggy({
  autorun: true,
  input: "input.mp4",
  output: "output.mkv",
  outputOptions: ["-c:v h264"],
});

ffmpeggy
  .on("start", (args) => {
    console.log("FFmpeg started with args:", args);
  })
  .on("progress", (progress) => {
    console.log(`${progress.percent?.toFixed(1)}% - ${progress.time}s`);
  })
  .on("error", (error) => {
    console.error("Processing error:", error.message);
  })
  .on("done", (file, sizes) => {
    console.log("Processing completed!");
    if (sizes) {
      console.log(`Video: ${sizes.video} bytes`);
      console.log(`Audio: ${sizes.audio} bytes`);
      console.log(
        `Muxing overhead: ${(sizes.muxingOverhead * 100).toFixed(3)}%`
      );
    }
  });
```

### Process Control

```ts
const ffmpeggy = new FFmpeggy({
  autorun: true,
  input: "input.mp4",
  output: "output.mkv",
});

// Stop processing
await ffmpeggy.stop();

// Reset instance
await ffmpeggy.reset();

// Wait for completion
const result = await ffmpeggy.done();
console.log("Output file:", result.file);
```

### Error Handling

FFmpeggy provides comprehensive error handling:

```ts
try {
  const ffmpeggy = new FFmpeggy({
    input: "nonexistent.mp4",
    output: "output.mkv",
  });

  await ffmpeggy.run();
  await ffmpeggy.done();
} catch (error) {
  console.error("Error:", error.message);
  // Error messages are concise and descriptive
}
```

## 🤔 Why Another FFmpeg Wrapper?

FFmpeggy was created because existing solutions had limitations:

- **Maintenance**: Many existing wrappers are poorly maintained
- **TypeScript**: Lack of proper TypeScript support and type definitions
- **Complexity**: Overly complex APIs that hide FFmpeg's power
- **Streams**: Limited or no support for Node.js streams
- **Events**: Missing real-time progress and status events

FFmpeggy aims to be:

- **Simple**: Intuitive API that doesn't hide FFmpeg's capabilities
- **Type-Safe**: Full TypeScript support with comprehensive types
- **Stream-Ready**: Native Node.js stream integration
- **Event-Driven**: Real-time progress and status updates
- **Maintained**: Actively maintained with regular updates

## 📄 License

MIT

[ffmpeg]: http://ffmpeg.org/
[ffprobe]: https://ffmpeg.org/ffprobe.html
