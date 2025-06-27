import path from "node:path";

import { defineConfig } from "vitest/config";

import { TEST_TIMEOUTS, isCI } from "#/__tests__/utils/testTimeouts";

// Thread pool configuration
const THREAD_POOL = {
  MAX_THREADS: isCI ? 2 : 4,
  MIN_THREADS: 1,
} as const;

// Shared exclude patterns for all projects
const sharedExclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/cypress/**",
  "**/.{idea,git,cache,output,temp}/**",
  "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
];

export default defineConfig({
  resolve: {
    alias: {
      "#": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["**/*.test.ts", "**/*.spec.ts"],
    exclude: sharedExclude,
    // Add global timeout to prevent infinite hanging
    testTimeout: TEST_TIMEOUTS.UNIT_TEST,
    // Use threads pool for better performance and to prevent hanging
    pool: "threads",
    // Add hanging process detection
    reporters: isCI
      ? ["verbose", "hanging-process", "junit"]
      : ["verbose", "hanging-process"],
    // Add hook timeout for setup/teardown
    hookTimeout: TEST_TIMEOUTS.HOOK,
    // Add retry logic for flaky tests
    retry: 1,
    // Add pool options for better stability
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: THREAD_POOL.MAX_THREADS,
        minThreads: THREAD_POOL.MIN_THREADS,
      },
    },
    // JUnit reporter configuration (only in CI)
    ...(isCI && {
      outputFile: {
        junit: "test-results.xml",
      },
    }),
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: [
        ...sharedExclude,
        "**/*.d.ts",
        "**/__tests__/**",
        "**/coverage/**",
        "**/vitest.config.*",
        "src/index.ts",
        "src/types/**",
      ],
      // Set coverage thresholds
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    // Add environment variables to suppress verbose output
    env: {
      NODE_ENV: "test",
      // Suppress verbose stream error output
      DEBUG: process.env.DEBUG || "",
    },
    projects: [
      {
        test: {
          name: "unit",
          include: [
            "**/*.unit.test.ts",
            "**/integration/FFmpeggy.timeout.integration.test.ts",
          ],
          exclude: [...sharedExclude, "**/integration/**"],
          pool: "threads",
          testTimeout: TEST_TIMEOUTS.UNIT_TEST,
          hookTimeout: TEST_TIMEOUTS.HOOK,
        },
      },
      {
        test: {
          name: "async:integration",
          include: ["**/integration/FFmpeggy.async.integration.test.ts"],
          exclude: [...sharedExclude],
          pool: "threads",
          poolOptions: {
            threads: {
              isolate: true,
              singleThread: true,
            },
          },
          testTimeout: TEST_TIMEOUTS.INTEGRATION_TEST,
          hookTimeout: TEST_TIMEOUTS.INTEGRATION_HOOK,
        },
      },
      {
        test: {
          name: "multi:integration",
          include: ["**/integration/FFmpeggy.multi.integration.test.ts"],
          exclude: [...sharedExclude],
          pool: "threads",
          poolOptions: {
            threads: {
              isolate: true,
              singleThread: true,
            },
          },
          testTimeout: TEST_TIMEOUTS.INTEGRATION_TEST,
          hookTimeout: TEST_TIMEOUTS.INTEGRATION_HOOK,
        },
      },
      {
        test: {
          name: "events:integration",
          include: ["**/integration/FFmpeggy.events.integration.test.ts"],
          exclude: [...sharedExclude],
          pool: "threads",
          poolOptions: {
            threads: {
              isolate: true,
              singleThread: true,
            },
          },
          testTimeout: TEST_TIMEOUTS.INTEGRATION_TEST,
          hookTimeout: TEST_TIMEOUTS.INTEGRATION_HOOK,
        },
      },
      {
        test: {
          name: "probe:integration",
          include: ["**/integration/FFmpeggy.probe.integration.test.ts"],
          exclude: [...sharedExclude],
          pool: "threads",
          poolOptions: {
            threads: {
              isolate: true,
              singleThread: true,
            },
          },
          testTimeout: TEST_TIMEOUTS.INTEGRATION_TEST,
          hookTimeout: TEST_TIMEOUTS.INTEGRATION_HOOK,
        },
      },
      {
        test: {
          name: "cjs:integration",
          include: ["**/integration/requireCommonJSModule.integration.test.ts"],
          exclude: [...sharedExclude],
          pool: "threads",
          testTimeout: TEST_TIMEOUTS.INTEGRATION_TEST,
          hookTimeout: TEST_TIMEOUTS.INTEGRATION_HOOK,
        },
      },
      {
        test: {
          name: "integration",
          include: ["**/integration/**/*.integration.test.ts"],
          exclude: [
            ...sharedExclude,
            "**/integration/FFmpeggy.async.integration.test.ts",
            "**/integration/FFmpeggy.multi.integration.test.ts",
            "**/integration/FFmpeggy.events.integration.test.ts",
            "**/integration/FFmpeggy.probe.integration.test.ts",
            "**/integration/FFmpeggy.timeout.integration.test.ts",
            "**/integration/requireCommonJSModule.integration.test.ts",
          ],
          pool: "threads",
          testTimeout: TEST_TIMEOUTS.INTEGRATION_TEST,
          hookTimeout: TEST_TIMEOUTS.INTEGRATION_HOOK,
        },
      },
    ],
  },
});
