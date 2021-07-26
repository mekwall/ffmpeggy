# ffmpeggy

[![license](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](https://github.com/mekwall/ffmpeggy/blob/main/LICENSE) [![npm](https://img.shields.io/npm/v/ffmpeggy.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/ffmpeggy) [![dependencies](https://img.shields.io/librariesio/github/mekwall/ffmpeggy.svg?style=flat-square)](https://github.com/mekwall/ffmpeggy) ![types](https://img.shields.io/npm/types/ffmpeggy.svg?style=flat-square&logo=typescript) [![coverage](https://img.shields.io/codecov/c/github/mekwall/ffmpeggy?style=flat-square)](https://codecov.io/github/mekwall/ffmpeggy?branch=main) [![quality](https://img.shields.io/lgtm/grade/javascript/github/mekwall/ffmpeggy?style=flat-square)](https://lgtm.com/projects/g/mekwall/ffmpeggy/?mode=list)

A minimal yet powerful wrapper for [FFmpeg][ffmpeg] and [FFprobe][ffprobe]. Has built-in support for Node.js streams and events that can provide you a detailed progress report.

This is a hybrid package built in TypeScript that provides both CommonJS and ES modules with only a couple of dependencies.

## Installation

```bash
$ npm install --save ffmpeggy
$ yarn add ffmpeggy
```

### Installing `ffmpeg` and `ffprobe` binaries

If you don't want to provide your own binaries, I recommend you to install these optional packages that includes binaries for all platforms:

```bash
$ npm install --save @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
$ yarn add @ffmpeg-installer/ffmpeg @ffprobe-installer/ffprobe
```

You can then change the default config to use those binaries like this:

```ts
import { path as ffmpegBin } from "@ffmpeg-installer/ffmpeg";
import { path as ffprobeBin } from "@ffprobe-installer/ffprobe";

FFmpeg.DefaultConfig = {
  ...FFmpeg.DefaultConfig,
  ffprobeBin,
  ffmpegBin,
};
```

## Basic usage

ffmpeggy comes with an intuitive api that allows you to work with it in your preferred way.

### Using with async/await

The most simple way to use ffmpeggy is with async/await.

```ts
import { FFmpeg } from "ffmpeggy";

async function main() {
  const ffmpeg = new FFmpeg();
  try {
    ffmpeg
      .setInput("file.mp4")
      .setOutput("file.mkv")
      .setOutputOptions(["-c:v h264"])
      .run();

    await ffmpeg.done();
    console.log(`Done =)`);
  } catch {
    console.error(`Something went wrong =(`);
  }
}
```

### Using event handlers

To make use of all the bells and whistles of ffmpeggy you can hook into the events that are transmitted. All the events are fully typed!

```ts
import { FFmpeg } from "ffmpeggy";

new FFmpeg({
    autorun: true,
    input: "file.mp4",
    output: "file.mkv",
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
  .on("done", (outputFile) => {
    console.log(`Done =)`);
  });
```

### Using with Node.js streams

You can provide streams directly to both input and output.

> NOTE: ffmpeg uses filenames to detect a format and since a stream doesn't have a filename you need to explicitly add that option for each stream.

```ts
import { FFmpeg } from "ffmpeggy";

new FFmpeg({
  autorun: true,
  input: createReadStream("input.mkv"),
  inputOptions: ["-f matroska"],
  output: createWriteStream("output.mkv"),
  outputOptions: ["-f matroska", "-c:v h264"],
});
```

You can also use the `.toStream()` method to get a stream that you can pipe.

```ts
import { FFmpeg } from "ffmpeggy";

const ffmpeg = new FFmpeg({
  autorun: true,
  pipe: true, // shorthand for output set to pipe:0
  input: createReadStream("file.mp4"),
  outputOptions: ["-c:v h264"],
});

const stream = ffmpeg.toStream();
stream.pipe(createWriteStream("file.mkv"));
```

### Probing

You can call the static `FFmpeg.probe()` method, which returns a promise:

```ts
import { FFmpeg } from "ffmpeggy";

const probeResults = await FFmpeg.probe("file.mkv");
```

Or you can call `.probe()` on an instance that will then run a probe on provided `input`:

```ts
import { FFmpeg } from "ffmpeggy";

const ffmpeg = new FFmpeg({
  input: "input.mkv"
});

const probeResults = await ffmpeg.probe();
```

## Available options

| Name            | Value                      | Description                                           | Default      |
| --------------- | -------------------------- | ----------------------------------------------------- | ------------ |
| `cwd`           | `string`                   | The working directory that ffmpeg will use            | Current cwd  |
| `input`         | `string \| ReadableStream` | Input path or readable stream                         | Empty string |
| `output`        | `string \| WritableStream` | Output path or writable stream                        | Empty string |
| `pipe`          | `boolean`                  | If output should be piped or not                      | Empty string |
| `globalOptions` | `string[]`                 | An array of ffmpeg global options                     | Empty array  |
| `inputOptions`  | `string[]`                 | An array of ffmpeg input options                      | Empty array  |
| `outputOptions` | `string[]`                 | An array of ffmpeg output options                     | Empty array  |
| `autorun`       | `boolean`                  | Will call `run()` in the constructor if set to `true` | `false`      |

## Available events

#### `start` - `(ffmpegArgs: readonly string[]) => void`

Fires when the ffmpeg process have been started. The `ffmpegArgs` argument contains an array with the arguments that was passed to the ffmpeg process.

#### `error` - `(error: Error) => void`

Fires when there was an error while running the ffmpeg process.

#### `done` - `(file?: string) => void`

Fires when the ffmpeg process have successfully completed.

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

## Why another ffmpeg wrapper?

Because I wasn't happy with the ones that already exists. Most of them are badly maintained and/or lacking TypeScript typings. I started coding on this a while back for another project and decided it deserved it's own package.

## How does ffmpeggy compare from fluent-ffmpeg?

They strive to solve different problems. Whereas ffmpeggy aims to be lean and simple, fluent-ffmpeg aims to provide an exhaustive and human readable API. I personally don't that kind of an API, but I might revisit it at a later stage, but an extended API will most likely end up in a separate package to keep this one as lean as possible.

## License

MIT

[ffmpeg]: http://ffmpeg.org/
[ffprobe]: https://ffmpeg.org/ffprobe.html
