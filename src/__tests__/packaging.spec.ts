import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const ROOT = resolve(import.meta.dirname, "../..");
const EXPECTED_EXPORTS = ["FFmpeggy", "secsToTimer", "timerToSecs"];

// Runs a script in a fresh Node process from the package root, where
// `ffmpeggy` resolves to this package through its own `exports` map. This
// exercises the built output exactly as a consumer would load it.
async function runNode(...args: string[]): Promise<string[]> {
  const { stdout } = await execFileAsync(process.execPath, args, {
    cwd: ROOT,
  });
  return JSON.parse(stdout);
}

describe("built package", () => {
  beforeAll(() => {
    if (!existsSync(resolve(ROOT, "dist/index.js"))) {
      throw new Error("dist/ is missing, run `yarn build` first");
    }
  });

  it("can be imported as an ES module", async () => {
    const exports = await runNode(
      "--input-type=module",
      "-e",
      `import * as m from "ffmpeggy";
       console.log(JSON.stringify(Object.keys(m).sort()));`
    );
    expect(exports).toEqual(EXPECTED_EXPORTS);
  });

  it("can construct FFmpeggy after an ES module import", async () => {
    const [name] = await runNode(
      "--input-type=module",
      "-e",
      `import { FFmpeggy } from "ffmpeggy";
       console.log(JSON.stringify([new FFmpeggy().constructor.name]));`
    );
    expect(name).toBe("FFmpeggy");
  });

  // CommonJS consumers rely on require(esm), which is only available
  // without flags on newer Node versions.
  describe.skipIf(!process.features.require_module)("require()", () => {
    it("can be loaded from CommonJS", async () => {
      const exports = await runNode(
        "-e",
        `console.log(JSON.stringify(Object.keys(require("ffmpeggy")).sort()));`
      );
      expect(exports).toEqual(EXPECTED_EXPORTS);
    });

    it("can construct FFmpeggy after require()", async () => {
      const [name] = await runNode(
        "-e",
        `const { FFmpeggy } = require("ffmpeggy");
         console.log(JSON.stringify([new FFmpeggy().constructor.name]));`
      );
      expect(name).toBe("FFmpeggy");
    });
  });
});
