// Detect CI environment
const isCI = process.env.GITHUB_ACTIONS || process.env.CI;

// Shared timeout configuration for both testHelpers and vitest config
export const TEST_TIMEOUTS = {
  // Test timeouts
  UNIT_TEST: 30000,
  INTEGRATION_TEST: 60000,
  HOOK: isCI ? 60000 : 30000, // Double hook timeout in CI
  INTEGRATION_HOOK: isCI ? 120000 : 60000, // Double integration hook timeout in CI

  // Operation timeouts
  TEST_OPERATION: 60000, // 60 seconds for most test operations
  PROBE_OPERATION: 30000, // 30 seconds for probe operations
  HOOK_OPERATION: 60000, // 60 seconds for cleanup hooks in CI environments

  // Cleanup timeouts
  CLEANUP: {
    WAIT_TIME: isCI ? 2000 : 500,
    FILE_DELETION_RETRIES: isCI ? 3 : 1,
    DIR_DELETION_RETRIES: isCI ? 3 : 1,
    RETRY_DELAY_BASE: 1000, // Base delay for retries in milliseconds
  },
} as const;
