import { describe, it, expect, vi } from "vitest";
import { FFmpeggy } from "#/FFmpeggy.js";
import type { ExecaChildProcess } from "@esm2cjs/execa";

// Unit test for progress-based timeout logic

describe("FFmpeggy:timeout", () => {
  it("should emit an error if no progress is received within the timeout", async () => {
    vi.useFakeTimers();
    const timeoutMs = 100;
    const ffmpeggy = new FFmpeggy({ timeout: timeoutMs });

    // Set a dummy process with a kill method
    ffmpeggy.process = {
      kill: vi.fn(),
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      stdio: [],
      pid: 1234,
      exitCode: undefined,
      signalCode: undefined,
      connected: false,
      killed: false,
      spawnfile: "",
      spawnargs: [],
      addListener: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      prependListener: vi.fn(),
      prependOnceListener: vi.fn(),
      removeAllListeners: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
      unref: vi.fn(),
      ref: vi.fn(),
    } as unknown as ExecaChildProcess;

    // Spy on the error event
    const errorHandler = vi.fn();
    ffmpeggy.on("error", errorHandler);

    // Start the timeout logic
    ffmpeggy["_setupProgressTimeout"]();

    // Fast-forward until all timers have been executed
    vi.runAllTimers();

    // The error handler should have been called
    expect(errorHandler).toHaveBeenCalled();
    const errorArgument = errorHandler.mock.calls[0][0];
    expect(errorArgument).toBeInstanceOf(Error);
    expect(errorArgument.message).toMatch(/timed out/i);
    vi.useRealTimers();
  });

  it("should clear the timeout if progress is received", async () => {
    vi.useFakeTimers();
    const timeoutMs = 100;
    const ffmpeggy = new FFmpeggy({ timeout: timeoutMs });

    // Set a dummy process with a kill method
    ffmpeggy.process = {
      kill: vi.fn(),
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      stdio: [],
      pid: 1234,
      exitCode: undefined,
      signalCode: undefined,
      connected: false,
      killed: false,
      spawnfile: "",
      spawnargs: [],
      addListener: vi.fn(),
      emit: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      prependListener: vi.fn(),
      prependOnceListener: vi.fn(),
      removeAllListeners: vi.fn(),
      removeListener: vi.fn(),
      send: vi.fn(),
      disconnect: vi.fn(),
      unref: vi.fn(),
      ref: vi.fn(),
    } as unknown as ExecaChildProcess;

    const errorHandler = vi.fn();
    ffmpeggy.on("error", errorHandler);

    // Start the timeout
    ffmpeggy["_setupProgressTimeout"]();

    // Clear the timeout immediately (simulating a progress event)
    ffmpeggy["_clearProgressTimeout"]();

    // Run all timers - should not trigger an error since timeout was cleared
    vi.runAllTimers();

    // The error handler should NOT have been called
    expect(errorHandler).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
