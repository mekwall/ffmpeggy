import { resolve as resolvePath } from "path";
import { execa } from "@esm2cjs/execa";

export async function waitFiles(
  rawFiles: string[],
  timeout = 10000,
  checkInterval = 1000,
): Promise<void> {
  const files = rawFiles.map((f) => resolvePath(f));
  const startTime = Date.now();

  const isWindows = process.platform === "win32";

  async function isFileOpenByFFmpeg(file: string): Promise<boolean> {
    try {
      if (isWindows) {
        // On Windows, use PowerShell to filter processes with the name "ffmpeg"
        const { stdout } = await execa(
          "powershell",
          [
            "-Command",
            `Get-Process -Name ffmpeg | ForEach-Object { $_.Modules } | Where-Object { $_.FileName -eq '${file}' }`,
          ],
          { reject: false },
        );
        return stdout.trim().length > 0; // Non-empty output means the file is open by ffmpeg
      } else {
        // On Unix-like systems, use lsof to check for files open by "ffmpeg"
        const { stdout } = await execa("lsof", ["-t", file], { reject: false });
        const pids = stdout.trim().split("\n").filter(Boolean); // Get all process IDs using the file

        // Check if any PID corresponds to an ffmpeg process
        const { stdout: psOutput } = await execa(
          "ps",
          ["-p", pids.join(","), "-o", "comm="],
          { reject: false },
        );
        return psOutput
          .trim()
          .split("\n")
          .map((cmd) => cmd.trim())
          .some((cmd) => cmd.includes("ffmpeg"));
      }
    } catch {
      // On error (e.g., file not found), assume the file is not open by ffmpeg
      return false;
    }
  }

  async function waitForFile(file: string): Promise<void> {
    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error(
          `Timeout: File "${file}" did not close within ${timeout}ms`,
        );
      }

      const openByFFmpeg = await isFileOpenByFFmpeg(file);
      if (!openByFFmpeg) {
        return; // File is no longer open by ffmpeg
      }

      await new Promise((res) => setTimeout(res, checkInterval));
    }
  }

  await Promise.all(files.map((file) => waitForFile(file)));
}
