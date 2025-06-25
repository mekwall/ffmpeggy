# ffmpeggy

[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/mekwall/ffmpeggy/blob/main/LICENSE) [![npm](https://img.shields.io/npm/v/ffmpeggy.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/ffmpeggy) ![npm package size](https://img.shields.io/npm/l/ffmpeggy?style=flat-square) ![node](https://img.shields.io/node/v/ffmpeggy?style=flat-square&logo=node.js) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8+-blue?style=flat-square&logo=typescript) ![FFmpeg](https://img.shields.io/badge/FFmpeg-5.0+-green?style=flat-square&logo=ffmpeg) [![dependencies](https://img.shields.io/librariesio/github/mekwall/ffmpeggy.svg?style=flat-square)](https://github.com/mekwall/ffmpeggy) ![types](https://img.shields.io/npm/types/ffmpeggy.svg?style=flat-square&logo=typescript) [![coverage](https://img.shields.io/codecov/c/github/mekwall/ffmpeggy?style=flat-square)](https://codecov.io/github/mekwall/ffmpeggy?branch=main) ![GitHub last commit](https://img.shields.io/github/last-commit/mekwall/ffmpeggy?style=flat-square&logo=github)

A modern, feature-rich Node.js wrapper for [FFmpeg][ffmpeg] and [FFprobe][ffprobe] with comprehensive TypeScript support. FFmpeggy provides an intuitive API for complex media processing operations including multiple inputs/outputs, real-time progress tracking, stream handling, and advanced FFmpeg features like the tee pseudo-muxer for efficient multi-output encoding.

This is a hybrid package built in TypeScript that provides both CommonJS and ES modules with only a couple of dependencies.

## ✨ Features

- **🚀 Simple API**: Intuitive interface with method chaining
- **📡 Event-Driven**: Real-time progress updates and status events
- **🔄 Stream Support**: Native Node.js stream integration for input/output
- **⚡ TypeScript**: Full TypeScript support with comprehensive type definitions
- **🔍 Media Probing**: Built-in FFprobe integration for media analysis
- **🛡️ Error Handling**: Robust error handling with descriptive messages
- **⚙️ Flexible Configuration**: Support for all [FFmpeg options and arguments](https://ffmpeg.org/ffmpeg.html#Options)
- **📊 Progress Tracking**: Detailed progress events with frame, time, and bitrate info
- **🎯 Hybrid Package**: Works with both CommonJS and ES modules
- **🔗 Multiple Inputs/Outputs**: Support for complex FFmpeg operations with multiple sources and destinations
- **🎛️ Tee Muxer**: Automatic [tee pseudo-muxer](https://ffmpeg.org/ffmpeg-formats.html#tee-1) for efficient multiple outputs
- **🔧 Advanced Input/Output Options**: Per-input and per-output option configuration

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

// Single input/output
const ffmpeggy = new FFmpeggy({
  autorun: true,
  input: "input.mp4",
  output: "output.mkv",
  outputOptions: ["-c:v h264"],
  overwriteExisting: true,
});

// Multiple inputs/outputs
const ffmpeggy = new FFmpeggy({
  autorun: true,
  inputs: ["video.mp4", "audio.mp3"],
  outputs: [
    { destination: "output.mp4", options: ["-c:v", "libx264"] },
    { destination: "audio_only.mp3", options: ["-vn", "-c:a", "mp3"] },
  ],
  overwriteExisting: true,
});

// Single input with multiple outputs
const ffmpeggy = new FFmpeggy({
  autorun: true,
  input: "input.mp4",
  outputs: [
    { destination: "output_hd.mp4", options: ["-s", "1920x1080"] },
    { destination: "output_sd.mp4", options: ["-s", "640x480"] },
  ],
  overwriteExisting: true,
});

// Multiple inputs with single output
const ffmpeggy = new FFmpeggy({
  autorun: true,
  inputs: ["video.mp4", "audio.mp3"],
  output: "combined.mp4",
  overwriteExisting: true,
});

await ffmpeggy.done();
```

## 📚 API Reference

### Interfaces

#### `FFmpeggyInput`

```ts
interface FFmpeggyInput {
  source: string | ReadStream;
  options?: string[];
}
```

#### `FFmpeggyOutput`

```ts
interface FFmpeggyOutput {
  destination: string | WriteStream;
  options?: string[];
}
```

### Constructor Options

| Option              | Type                                          | Description                                | Default         |
| ------------------- | --------------------------------------------- | ------------------------------------------ | --------------- |
| `cwd`               | `string`                                      | Working directory for FFmpeg               | `process.cwd()` |
| `input`             | `string \| ReadStream`                        | Single input file path or readable stream  | `""`            |
| `output`            | `string \| WriteStream`                       | Single output file path or writable stream | `""`            |
| `inputs`            | `(string \| ReadStream \| FFmpeggyInput)[]`   | Array of inputs                            | `[]`            |
| `outputs`           | `(string \| WriteStream \| FFmpeggyOutput)[]` | Array of outputs                           | `[]`            |
| `pipe`              | `boolean`                                     | Enable pipe mode (outputs to stream)       | `false`         |
| `globalOptions`     | `string[]`                                    | FFmpeg global options                      | `["-stats"]`    |
| `inputOptions`      | `string[]`                                    | FFmpeg input options                       | `[]`            |
| `outputOptions`     | `string[]`                                    | FFmpeg output options                      | `[]`            |
| `overwriteExisting` | `boolean`                                     | Add `-y` flag to overwrite files           | `false`         |
| `hideBanner`        | `boolean`                                     | Add `-hide_banner` flag                    | `true`          |
| `autorun`           | `boolean`                                     | Automatically run FFmpeg after setup       | `false`         |
| `useTee`            | `boolean`                                     | Use tee pseudo-muxer for multiple outputs  | `false`         |
| `timeout`           | `number`                                      | Progress-based timeout in milliseconds     | `null`          |

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

### Multiple Inputs and Outputs

FFmpeggy supports complex operations with multiple inputs and outputs. The API provides two approaches for configuring inputs and outputs:

- **Single inputs/outputs**: Use `input`/`output` options or `setInput()`/`setOutput()` methods
- **Multiple inputs/outputs**: Use `inputs`/`outputs` options or `setInputs()`/`setOutputs()` methods

Both approaches are equally valid and provide the same functionality. Choose the approach that best fits your use case.

**⚠️ Validation Rules**

FFmpeggy enforces the following validation rules to prevent incompatible configurations:

- **❌ Cannot mix single and multiple inputs**: You cannot use both `input` and `inputs` options simultaneously
- **❌ Cannot mix single and multiple outputs**: You cannot use both `output` and `outputs` options simultaneously
- **✅ Can mix single input with multiple outputs**: Use `input` with `outputs` or `setInput()` with `setOutputs()`
- **✅ Can mix multiple inputs with single output**: Use `inputs` with `output` or `setInputs()` with `setOutput()`

**Valid Combinations:**

- Single input + Single output
- Single input + Multiple outputs
- Multiple inputs + Single output
- Multiple inputs + Multiple outputs

For more information about FFmpeg's multiple output capabilities, see the [FFmpeg wiki on creating multiple outputs](https://trac.ffmpeg.org/wiki/Creating%20multiple%20outputs).

#### Multiple Inputs

```ts
// Multiple file inputs
const ffmpeggy = new FFmpeggy()
  .setInputs(["video1.mp4", "video2.mp4", "audio.mp3"])
  .setOutput("combined.mp4");

// Mixed input types with options
const ffmpeggy = new FFmpeggy()
  .setInputs([
    "video.mp4",
    { source: createReadStream("audio.mp3"), options: ["-f", "mp3"] },
    { source: "subtitle.srt", options: ["-f", "srt"] },
  ])
  .setOutput("output.mp4");

// Inputs with specific options
const ffmpeggy = new FFmpeggy()
  .setInputs([
    { source: "video.mp4", options: ["-ss", "10"] }, // Start at 10 seconds
    { source: "audio.mp3", options: ["-ss", "5"] }, // Start at 5 seconds
  ])
  .setOutput("output.mp4");
```

#### Multiple Outputs

```ts
// Multiple file outputs with different settings
const ffmpeggy = new FFmpeggy().setInput("input.mp4").setOutputs([
  {
    destination: "output_hd.mp4",
    options: ["-s", "1920x1080", "-c:v", "libx264"],
  },
  {
    destination: "output_sd.mp4",
    options: ["-s", "640x480", "-c:v", "libx264"],
  },
  {
    destination: "audio_only.mp3",
    options: ["-vn", "-c:a", "mp3"],
  },
]);

// Mixed output types (file + stream)
const outputStream = createWriteStream("stream_output.mp3");
const ffmpeggy = new FFmpeggy().setInput("input.mp4").setOutputs([
  "output.mp4",
  {
    destination: outputStream,
    options: ["-f", "mp3", "-vn", "-c:a", "mp3"],
  },
]);
```

#### Tee Pseudo-Muxer

For efficient multiple outputs with the same codec settings, FFmpeggy supports the [FFmpeg tee pseudo-muxer](https://ffmpeg.org/ffmpeg-formats.html#tee-1). The tee muxer allows you to write the same encoded stream to multiple outputs simultaneously, which is more efficient than encoding multiple times.

**Enable Tee Muxer:**

```ts
// Using constructor option
const ffmpeggy = new FFmpeggy({
  input: "input.mp4",
  outputs: [
    { destination: "output1.mp4", options: ["-c:v", "libx264", "-c:a", "aac"] },
    { destination: "output2.mp4", options: ["-c:v", "libx264", "-c:a", "aac"] },
  ],
  tee: true, // Enable tee pseudo-muxer
});

// Using method chaining
const ffmpeggy = new FFmpeggy()
  .setInput("input.mp4")
  .setOutputs([
    { destination: "output1.mp4", options: ["-c:v", "libx264", "-c:a", "aac"] },
    { destination: "output2.mp4", options: ["-c:v", "libx264", "-c:a", "aac"] },
  ])
  .useTee(); // Enable tee pseudo-muxer
```

**⚠️ Tee Muxer Limitations**

The tee pseudo-muxer has important limitations that affect when it can be used. For detailed information, see the [official FFmpeg tee muxer documentation](https://ffmpeg.org/ffmpeg-formats.html#tee-1).

1. **Same Codec Settings**: All outputs must use identical codec options (e.g., `-c:v`, `-c:a`, `-crf`, `-b:v`, etc.)
2. **No Different Codecs**: You cannot use different video codecs (e.g., libx264 vs libx265) or different audio codecs
3. **No Different Quality Settings**: All outputs must have the same quality parameters
4. **Automatic Fallback**: FFmpeggy automatically detects incompatible scenarios and falls back to standard multiple outputs

**Examples of Compatible vs Incompatible:**

```ts
// ✅ Compatible - Same codec settings
.setOutputs([
  { destination: "hd.mp4", options: ["-c:v", "libx264", "-c:a", "aac"] },
  { destination: "sd.mp4", options: ["-c:v", "libx264", "-c:a", "aac"] }
])
.useTee();

// ❌ Incompatible - Different video codecs
.setOutputs([
  { destination: "h264.mp4", options: ["-c:v", "libx264"] },
  { destination: "h265.mkv", options: ["-c:v", "libx265"] }
])
.useTee(); // Will automatically fall back to standard multiple outputs

// ❌ Incompatible - Different quality settings
.setOutputs([
  { destination: "high.mp4", options: ["-c:v", "libx264", "-crf", "18"] },
  { destination: "low.mp4", options: ["-c:v", "libx264", "-crf", "28"] }
])
.useTee(); // Will automatically fall back to standard multiple outputs
```

When tee muxer is incompatible, FFmpeggy automatically falls back to standard multiple outputs, so your operation will still work correctly.

**Tee with Streams:**

```ts
// Tee muxer supports one WriteStream as the last output
const outputStream = createWriteStream("stream_output.mp4");
const ffmpeggy = new FFmpeggy()
  .setInput("input.mp4")
  .setOutputs([
    {
      destination: "file_output.mp4",
      options: ["-c:v", "libx264", "-c:a", "aac"],
    },
    { destination: outputStream, options: ["-c:v", "libx264", "-c:a", "aac"] }, // Stream must be last
  ])
  .useTee();
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

FFmpeggy includes built-in FFprobe integration for media analysis. For detailed information about FFprobe capabilities, see the [official FFprobe documentation](https://ffmpeg.org/ffprobe.html).

```ts
// Static method
const probeResult = await FFmpeggy.probe("input.mp4");

// Instance method
const ffmpeggy = new FFmpeggy({ input: "input.mp4" });
const probeResult = await ffmpeggy.probe();

// Probe specific input in multiple input scenario
const ffmpeggy = new FFmpeggy({
  inputs: ["video.mp4", "audio.mp3"],
});
const videoInfo = await ffmpeggy.probeInput(0); // Probe first input
const audioInfo = await ffmpeggy.probeInput(1); // Probe second input
```

The probe result includes detailed information about streams, format, and metadata.

### Stream Support

FFmpeggy supports Node.js streams for both input and output. For information about supported formats and stream handling, see the [FFmpeg formats documentation](https://ffmpeg.org/ffmpeg-formats.html).

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

### Complex Multiple Input/Output Operations

```ts
import { createReadStream, createWriteStream } from "fs";
import { FFmpeggy } from "ffmpeggy";

// Create multiple outputs with different processing
const audioStream = createWriteStream("audio.mp3");
const ffmpeggy = new FFmpeggy()
  .setInputs([
    "video.mp4",
    { source: createReadStream("background.mp3"), options: ["-f", "mp3"] },
  ])
  .setOutputs([
    {
      destination: "output_hd.mp4",
      options: ["-s", "1920x1080", "-c:v", "libx264", "-c:a", "aac"],
    },
    {
      destination: "output_sd.mp4",
      options: ["-s", "640x480", "-c:v", "libx264", "-c:a", "aac"],
    },
    {
      destination: audioStream,
      options: ["-vn", "-f", "mp3", "-c:a", "mp3"],
    },
  ]);

// Listen for events
ffmpeggy
  .on("start", (args) => {
    console.log("FFmpeg command:", args.join(" "));
  })
  .on("progress", (progress) => {
    console.log(`Progress: ${progress.percent?.toFixed(1)}%`);
  })
  .on("done", (file) => {
    console.log("Processing completed! Main output:", file);
  });

await ffmpeggy.run();
await ffmpeggy.done();
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

### Helper Methods

FFmpeggy provides several helper methods for managing inputs and outputs:

```ts
const ffmpeggy = new FFmpeggy();

// Input management
ffmpeggy
  .setInput("video.mp4")
  .addInput("audio.mp3")
  .addInput({ source: "subtitle.srt", options: ["-f", "srt"] });

console.log(ffmpeggy.getInputCount()); // 3

// Output management
ffmpeggy
  .setOutput("output.mp4")
  .addOutput({ destination: "audio.mp3", options: ["-vn", "-c:a", "mp3"] });

console.log(ffmpeggy.getOutputCount()); // 2

// Tee muxer control
ffmpeggy.useTee(); // Enable tee pseudo-muxer for multiple outputs

// Timeout control
ffmpeggy.setTimeout(30000); // Set 30-second progress timeout

// Clear and reset
ffmpeggy.clearInputs();
ffmpeggy.clearOutputs();
```

#### Advanced Helper Methods

```ts
const ffmpeggy = new FFmpeggy();

// Timeout management
ffmpeggy.setTimeout(60000); // Set 60-second progress timeout

// Tee muxer control
ffmpeggy.useTee(); // Enable tee pseudo-muxer for multiple outputs

// Process control
await ffmpeggy.stop(); // Stop running process
await ffmpeggy.reset(); // Reset instance to initial state

// Stream output
const outputStream = ffmpeggy.toStream(); // Get PassThrough stream for output

// Media probing
const info = await ffmpeggy.probe(); // Probe first input
const videoInfo = await ffmpeggy.probeInput(0); // Probe specific input by index
```

## 🐛 Debugging and Troubleshooting

FFmpeggy uses the [debug](https://github.com/debug-js/debug) library for comprehensive logging and troubleshooting. This allows you to see detailed internal operations, FFmpeg command construction, and process management.

### Enabling Debug Output

Set the `DEBUG` environment variable to enable debug output:

```bash
# Enable all FFmpeggy debug output
DEBUG=ffmpeggy node your-script.js

# Enable specific debug namespaces
DEBUG=ffmpeggy:* node your-script.js

# Enable debug output in your application
DEBUG=ffmpeggy yarn test:debug
```

### Debug Namespaces

FFmpeggy provides several debug namespaces for different aspects of operation:

- `ffmpeggy` - General FFmpeggy operations
- `ffmpeggy:args` - FFmpeg command line arguments
- `ffmpeggy:process` - Process management and lifecycle
- `ffmpeggy:streams` - Stream handling and pipeline operations
- `ffmpeggy:events` - Event emission and handling
- `ffmpeggy:timeout` - Progress timeout management

### Debug Output Examples

When debug is enabled, you'll see detailed information like:

```
ffmpeggy:args FFmpeg command: ffmpeg -i input.mp4 -c:v libx264 -c:a aac output.mp4
ffmpeggy:process Starting FFmpeg process with PID: 12345
ffmpeggy:events Emitting progress event: { frame: 100, fps: 25.0, time: 4.0 }
ffmpeggy:streams Setting up pipeline for output streams
ffmpeggy:process FFmpeg process completed with exit code: 0
```

### Troubleshooting Common Issues

#### FFmpeg Command Construction

To see exactly what FFmpeg command is being constructed:

```bash
DEBUG=ffmpeggy:args node your-script.js
```

This will show you the complete FFmpeg command line arguments, helping you verify that options are being passed correctly.

#### Process Management

To debug process lifecycle issues:

```bash
DEBUG=ffmpeggy:process node your-script.js
```

This shows process creation, execution, and termination details.

#### Stream Operations

To debug stream-related issues:

```bash
DEBUG=ffmpeggy:streams node your-script.js
```

This provides detailed information about stream setup, pipeline creation, and stream cleanup.

#### Event Handling

To debug event emission and handling:

```bash
DEBUG=ffmpeggy:events node your-script.js
```

This shows when events are emitted and what data they contain.

### Advanced Debug Configuration

You can configure debug output behavior using environment variables:

```bash
# Enable colors in debug output
DEBUG_COLORS=1 DEBUG=ffmpeggy node your-script.js

# Hide timestamps
DEBUG_HIDE_DATE=1 DEBUG=ffmpeggy node your-script.js

# Set object inspection depth
DEBUG_DEPTH=5 DEBUG=ffmpeggy node your-script.js
```

### Integration with Testing

The test suite includes debug output for troubleshooting test failures:

```bash
# Run tests with debug output
yarn test:debug

# Run specific test with debug
DEBUG=ffmpeggy yarn test:unit
```

### Browser Debugging

For browser-based applications, debug output can be controlled via localStorage:

```javascript
// Enable debug in browser console
localStorage.debug = "ffmpeggy:*";

// Refresh the page to see debug output
```

## 🤔 Why Another FFmpeg Wrapper?

FFmpeggy was created because existing solutions had limitations:

- **Maintenance**: Many existing wrappers are poorly maintained
- **TypeScript**: Lack of proper TypeScript support and type definitions
- **Complexity**: Overly complex APIs that hide FFmpeg's power
- **Streams**: Limited or no support for Node.js streams
- **Events**: Missing real-time progress and status events
- **Multiple I/O**: Limited support for complex multiple input/output operations

FFmpeggy aims to be:

- **Simple**: Intuitive API that doesn't hide [FFmpeg's capabilities](https://ffmpeg.org/ffmpeg.html)
- **Type-Safe**: Full TypeScript support with comprehensive types
- **Stream-Ready**: Native Node.js stream integration
- **Event-Driven**: Real-time progress and status updates
- **Maintained**: Actively maintained with regular updates
- **Powerful**: Support for complex FFmpeg operations with multiple inputs/outputs

## 📁 Sample Files

This project includes sample media files for testing purposes. Some of these files are derived from third-party sources and are used under their respective licenses:

### Big Buck Bunny

The following sample files are derived from the **Big Buck Bunny** project:

- `big_buck_bunny_h264_aac_320x180_2aud_2vid_ccby.mp4` - Multi-stream video with 2 video and 2 audio streams
- `big_buck_bunny_subtitles_en_subs_ccby.vtt` - English subtitles in VTT format

**License**: [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/)

**Source**: [Big Buck Bunny](https://peach.blender.org/) by the [Blender Foundation](https://www.blender.org/foundation/)

**Attribution**: © 2008, Blender Foundation / <www.bigbuckbunny.org>

These files are used for testing FFmpeggy's multi-stream handling capabilities and subtitle processing features. The original Big Buck Bunny project is an open-source animated short film created using Blender.

## 📄 License

MIT

[ffmpeg]: http://ffmpeg.org/
[ffprobe]: https://ffmpeg.org/ffprobe.html

## 🛠️ Build (for contributors)

This project uses [tsup](https://github.com/egoist/tsup) to build both CommonJS and ESModule outputs, as well as type declarations. The build output is in the `dist/` directory.

To build the project:

```sh
yarn build
```

This will clean the `dist/` directory and generate:

- `dist/index.cjs` (CommonJS)
- `dist/index.js` (ESM)
- `dist/index.d.ts` (TypeScript types)
