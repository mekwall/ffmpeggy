import { defineConfig } from "vitest/config";

// Shared exclude patterns for all projects
const sharedExclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/cypress/**",
  "**/.{idea,git,cache,output,temp}/**",
  "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
];

export default defineConfig({
  test: {
    exclude: sharedExclude,
    // Add global timeout to prevent infinite hanging
    testTimeout: 30000,
    // Use threads pool for better performance and to prevent hanging
    pool: "threads",
    // Add hanging process detection
    reporters: process.env.GITHUB_ACTIONS
      ? ["verbose", "hanging-process", "junit"]
      : ["verbose", "hanging-process"],
    // Add hook timeout for setup/teardown
    hookTimeout: 30000,
    // Add retry logic for flaky tests
    retry: 1,
    // Add pool options for better stability
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1,
      },
    },
    // JUnit reporter configuration (only in CI)
    ...(process.env.GITHUB_ACTIONS && {
      outputFile: {
        junit: "test-results.xml",
      },
    }),
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,js}"],
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
    projects: [
      {
        test: {
          name: "unit",
          include: ["**/*.unit.test.ts", "**/*.spec.ts"],
          exclude: [
            ...sharedExclude,
            "**/*.event.test.ts",
            "**/*.async.test.ts",
          ],
        },
      },
      {
        test: {
          name: "events",
          include: ["**/*.event.test.ts"],
          exclude: [
            ...sharedExclude,
            "**/*.unit.test.ts",
            "**/*.async.test.ts",
          ],
        },
      },
      {
        test: {
          name: "async",
          include: ["**/*.async.test.ts"],
          exclude: [
            ...sharedExclude,
            "**/*.unit.test.ts",
            "**/*.event.test.ts",
          ],
          // Longer timeout for async tests that involve file operations
          testTimeout: 60000,
          hookTimeout: 60000,
        },
      },
    ],
  },
});
