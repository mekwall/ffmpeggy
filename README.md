# ffmpeggy

[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/mekwall/ffmpeggy/blob/main/LICENSE) [![npm](https://img.shields.io/npm/v/ffmpeggy.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/ffmpeggy) [![dependencies](https://img.shields.io/librariesio/github/mekwall/ffmpeggy.svg?style=flat-square)](https://github.com/mekwall/ffmpeggy) ![types](https://img.shields.io/npm/types/ffmpeggy.svg?style=flat-square&logo=typescript) [![coverage](https://img.shields.io/codecov/c/github/mekwall/ffmpeggy?style=flat-square)](https://codecov.io/github/mekwall/ffmpeggy?branch=main)

A minimal yet powerful wrapper for [FFmpeg][ffmpeg] and [FFprobe][ffprobe]. Has built-in support for Node.js streams and events that can provide you a detailed progress report.

This is a hybrid package built in TypeScript that provides both CommonJS and ES modules with only a couple of dependencies.

## Installation

```sh
npm install --save ffmpeggy
```

**or**

```sh
yarn add ffmpeggy
```

### Installing `ffmpeg` and `ffprobe` binaries

If you don't want to provide your own binaries, you can use the following packages that provides binaries for both ffmpeg and ffprobe:

```sh
npm install --save ffmpeg-static ffprobe-static
```

**or**

```sh
yarn add ffmpeg-static ffprobe-static
```

You can then change the default config to use the binaries like this:

```ts
import ffmpegBin from "ffmpeg-static";
import { path as ffprobeBin } from "ffprobe-static";

FFmpeggy.DefaultConfig = {
  ...FFmpeggy.DefaultConfig,
  ffprobeBin,
  ffmpegBin,
};
```

## Basic usage

ffmpeggy comes with an intuitive api that allows you to work with it in your preferred way.

### TypeScript Types

If you're using TypeScript, you can import the types for better type safety:

```ts
import { FFmpeggy, FFmpeggyFinalSizes } from "ffmpeggy";
```

### Using with async/await

The most simple way to use ffmpeggy is with async/await.

```ts
import { FFmpeggy } from "ffmpeggy";

async function main() {
  const ffmpeggy = new FFmpeggy();
  try {
    ffmpeggy
      .setInput("input.mp4")
      .setOutput("output.mkv")
      .setOutputOptions(["-c:v h264"])
      .run();

    // Listen for the done event to get final sizes
    ffmpeggy.on("done", (file, sizes) => {
      if (sizes) {
        console.log(`Video: ${sizes.video} bytes, Audio: ${sizes.audio} bytes`);
      }
    });

    await ffmpeggy.done();
    console.log(`Done =)`);
  } catch {
    console.error(`Something went wrong =(`);
  }
}
```

### Using event handlers

To make use of all the bells and whistles of ffmpeggy you can hook into the events that are transmitted. All the events are fully typed!

```ts
import { FFmpeggy } from "ffmpeggy";

new FFmpeggy({
  autorun: true,
  input: "input.mp4",
  output: "output.mkv",
  outputOptions: ["-c:v h264"],
})
  .on("start", (args) => {
    console.log(`ffmpeg was started with these args:`, args);
  })
  .on("progress", (event) => {
    console.log(`${event.progress}%`);
  })
  .on("error", (error) => {
    console.error(`Something went wrong =(`, error);
  })
  .on("done", (outputFile, sizes) => {
    console.log(`Done =)`);
    if (sizes) {
      console.log(`Video size: ${sizes.video} bytes`);
      console.log(`Audio size: ${sizes.audio} bytes`);
      console.log(
        `Muxing overhead: ${(sizes.muxingOverhead * 100).toFixed(3)}%`
      );
    }
  });
```

### Using with Node.js streams

You can provide streams directly to both input and output.

> **Note:** ffmpeg uses filenames to detect a format and since a stream doesn't have a filename you need to explicitly add that option for each stream.

> **Note:** If you provide a Node.js stream as input or output, `FFmpeggy` will wait for the stream to open before starting FFmpeg. If the stream emits an error or fails to open, the operation will fail with a descriptive error.

```ts
import { FFmpeggy } from "ffmpeggy";

new FFmpeggy({
  autorun: true,
  input: createReadStream("input.mkv"),
  inputOptions: ["-f matroska"],
  output: createWriteStream("output.mkv"),
  outputOptions: ["-f matroska", "-c:v h264"],
});
```

You can also use the `.toStream()` method to get a stream that you can pipe.

```ts
import { FFmpeggy } from "ffmpeggy";

const ffmpeggy = new FFmpeggy({
  autorun: true,
  pipe: true, // shorthand for output set to pipe:0
  input: createReadStream("input.mp4"),
  outputOptions: ["-c:v h264"],
});

const stream = ffmpeggy.toStream();
stream.pipe(createWriteStream("output.mkv"));
```

### Error Handling

FFmpeggy provides robust error handling:

- If FFmpeg fails to start, or if an input/output stream emits an error, the `error` event will be emitted and the returned promise will reject.
- All errors are surfaced in a consistent and descriptive way, making it easier to debug issues with streams or FFmpeg itself.
- Stream timeouts and errors are properly handled with clear error messages.
- All events are reliably emitted, even in error scenarios or when streams fail to open.

### Probing

You can call the static `FFmpeg.probe()` method, which returns a promise:

```ts
import { FFmpeggy } from "ffmpeggy";

const probeResults = await FFmpeggy.probe("input.mkv");
```

Or you can call `.probe()` on an instance that will then run a probe on provided `input`:

```ts
import { FFmpeggy } from "ffmpeggy";

const ffmpeggy = new FFmpeg({
  input: "input.mkv",
});

const probeResults = await ffmpeggy.probe();
```

## Available options

| Name                | Value                      | Description                                           | Default      |
| ------------------- | -------------------------- | ----------------------------------------------------- | ------------ |
| `cwd`               | `string`                   | The working directory that ffmpeg will use            | Current cwd  |
| `input`             | `string \| ReadableStream` | Input path or readable stream                         | Empty string |
| `output`            | `string \| WritableStream` | Output path or writable stream                        | Empty string |
| `pipe`              | `boolean`                  | If output should be piped or not                      | Empty string |
| `globalOptions`     | `string[]`                 | An array of ffmpeg global options                     | Empty array  |
| `inputOptions`      | `string[]`                 | An array of ffmpeg input options                      | Empty array  |
| `outputOptions`     | `string[]`                 | An array of ffmpeg output options                     | Empty array  |
| `autorun`           | `boolean`                  | Will call `run()` in the constructor if set to `true` | `false`      |
| `overwriteExisting` | `boolean`                  | Shorthand to add `-y` to global options               | `false`      |
| `hideBanner`        | `boolean`                  | Shorthand to add `-hide_banner` to global options     | `true`       |
| `ffmpegBin`         | `string`                   | Path to the ffmpeg binary                             | `""`         |
| `ffprobeBin`        | `string`                   | Path to the ffprobe binary                            | `""`         |

## Available events

#### `start` - `(ffmpegArgs: readonly string[]) => void`

Fires when the ffmpeg process have been started. The `ffmpegArgs` argument contains an array with the arguments that was passed to the ffmpeg process.

#### `error` - `(error: Error) => void`

Fires when there was an error while running the ffmpeg process.

#### `done` - `(file?: string, sizes?: FFmpeggyFinalSizes) => void`

Fires when the ffmpeg process have successfully completed. The `sizes` parameter contains information about the final sizes of different stream types in the output file:

- `video`: Size of video stream in bytes
- `audio`: Size of audio stream in bytes
- `subtitles`: Size of subtitle streams in bytes
- `otherStreams`: Size of other stream types in bytes
- `globalHeaders`: Size of global headers in bytes
- `muxingOverhead`: Muxing overhead as a decimal (e.g., 0.00414726 for 0.414726%)

> Note: Some fields may be 0 or undefined if the corresponding stream type is not present in the output file.

> Note: Final sizes are only available when FFmpeg outputs this information at the end of processing. For some operations (like simple copying), FFmpeg may not provide detailed size breakdowns.

#### `exit` - `(code?: number | null, error?: Error) => void`

Fires when the ffmpeg process have exited.

#### `probe` - `(probeResult: FFprobeResult) => void`

Fires when the ffprobe process have returned its result.

#### `progress` - `(progress: FFmpegProgressEvent) => void`

Fires when ffmpeg is outputting it's progress. Most of the properties in `FFmpegProgressEvent` are provided by ffmpeg's output, except `duration` and `percent`:

- `frame`: The current frame (i.e. total frames that have been processed)
- `fps`: Framerate at which FFmpeg is currently processing
- `size`: The current size of the output in kilobytes
- `time`: The time of the current frame in seconds
- `bitrate`: The current throughput at which FFmpeg is processing
- `duration`: The duration of the output in seconds
- `percent`: An estimation of the progress percentage
- `q`: The current quality scale (qscale). This is rarely used and is often just set to 0.

> Note: If the operation is fast enough ffmpeg might not output a progress report that includes all the values so you need to handle that accordingly. This usually only happens when you copy directly from an input to an output without changing anything.

#### `writing` - `(fileName: string) => void`

Fires when ffmpeg reports that it has begun writing to a file. This can be used to track which fragment ffmpeg is currently writing to or when it updates a playlist.

> Note: ffmpeg may finish before outputting this event for every file so you need to handle that accordingly. Expect it to have successfully written every segment if it exits with error code 0.

## Why another ffmpeg wrapper?

Because I wasn't happy with the ones that already exists. Most of them are badly maintained, and/or lacking TypeScript typings or are too complex for my taste. I started coding on this a while back for another project and it's been working really well so figured it deserved it's own package.

## How does ffmpeggy compare to fluent-ffmpeg?

They strive to solve different problems. Whereas ffmpeggy aims to be lean and simple, fluent-ffmpeg aims to provide an exhaustive and human readable API. I personally don't need all of that but I might revisit it at a later stage. But an extended API will most likely end up in a separate package to keep this one as lean as possible.

## License

MIT

[ffmpeg]: http://ffmpeg.org/
[ffprobe]: https://ffmpeg.org/ffprobe.html
