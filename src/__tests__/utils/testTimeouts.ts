// Detect CI environment
const isCI = process.env.GITHUB_ACTIONS || process.env.CI;

// Detect Windows platform for specific handling
const isWindows = process.platform === "win32";

// Shared timeout configuration for both testHelpers and vitest config
export const TEST_TIMEOUTS = {
  // Test timeouts
  UNIT_TEST: 30_000,
  INTEGRATION_TEST: isCI ? 120_000 : 60_000, // Double integration timeout in CI
  HOOK: isCI ? 60_000 : 30_000, // Double hook timeout in CI
  INTEGRATION_HOOK: isCI ? 180_000 : 60_000, // Triple integration hook timeout in CI

  // Operation timeouts
  TEST_OPERATION: isCI ? 120_000 : 60_000, // Double test operation timeout in CI
  PROBE_OPERATION: 30_000, // 30 seconds for probe operations
  HOOK_OPERATION: isCI ? 120_000 : 60_000, // Double hook operation timeout in CI

  // Cleanup timeouts - more aggressive on Windows due to EBUSY errors
  CLEANUP: {
    WAIT_TIME: isCI ? 5000 : isWindows ? 1000 : 500, // Shorter wait on Windows
    FILE_DELETION_RETRIES: isCI ? 5 : isWindows ? 4 : 1, // Fewer retries on Windows
    DIR_DELETION_RETRIES: isCI ? 5 : isWindows ? 4 : 1, // Fewer retries on Windows
    RETRY_DELAY_BASE: isCI ? 2000 : isWindows ? 800 : 1000, // Shorter base delay on Windows
  },
} as const;

// Export the CI detection constant for use in other files
export { isCI, isWindows };
