# Contributing to FFmpeggy

Thank you for your interest in contributing to FFmpeggy! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

- Use the GitHub issue tracker to report bugs
- Include detailed steps to reproduce the issue
- Include expected and actual behavior
- Include relevant logs and error messages
- Include your environment details (OS, Node.js version, etc.)

### Suggesting Features

- Use the GitHub issue tracker to suggest features
- Provide a clear description of the feature
- Explain why this feature would be useful
- If possible, provide examples of how it would work

### Pull Requests

1. Fork the repository
2. Create a new branch for your feature/fix
3. Make your changes
4. Write or update tests as needed
5. Ensure all tests pass
6. Update documentation if necessary
7. Submit a pull request

### Development Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/mekwall/ffmpeggy.git
   cd ffmpeggy
   ```

2. Install dependencies:

   ```bash
   yarn install
   ```

3. Run tests:

   ```bash
   yarn test
   ```

### Requirements

- **Node.js**: >= 18.0.0
- **TypeScript**: 5.8+
- **FFmpeg**: 5.0+ (must be installed separately or via `ffmpeg-static`)

### Build System

This project uses [tsup](https://github.com/egoist/tsup) for building, which provides fast TypeScript compilation and supports both CommonJS and ES modules. The build process generates:

- **CommonJS**: `./dist/index.cjs` and related files
- **ES Modules**: `./dist/index.js` (or `index.mjs` if configured)
- **Type Definitions**: Comprehensive TypeScript definitions in `./dist/`

### Code Style

- Follow the existing code style
- Use ESLint for code linting
- Write meaningful commit messages
- Keep changes focused and atomic

### Testing

This project uses [Vitest](https://vitest.dev/) for testing with a sophisticated project structure that separates unit tests from integration tests for optimal performance and reliability.

#### Test Organization

The test suite is organized into multiple Vitest projects for optimal performance:

##### **Unit Tests** (`unit` project)

- **Purpose**: Test core functionality, validation logic, and utility functions without FFmpeg execution
- **Location**: `src/__tests__/`
- **Examples**:
  - `FFmpeggy.core.unit.test.ts` - Core functionality, constructor, setters
  - `FFmpeggy.validation.unit.test.ts` - Input/output validation logic
  - `parsers.unit.test.ts` - Utility parsing functions
- **Characteristics**:
  - Fast execution (no FFmpeg processes)
  - Can run in parallel
  - Test isolated functionality
  - No file I/O or external dependencies

##### **Integration Tests** (Multiple projects)

- **Purpose**: Test actual FFmpeg execution, file I/O, streaming, and real-world scenarios
- **Location**: `src/__tests__/integration/`
- **Projects**:
  - `async:integration` - Async/await patterns with FFmpeg
  - `events:integration` - Event emission and handling
  - `multi:integration` - Multiple input/output scenarios
  - `probe:integration` - Media probing functionality
  - `integration` - General integration tests
- **Characteristics**:
  - Slower execution (involves FFmpeg processes)
  - Run sequentially to avoid conflicts
  - Test real FFmpeg integration
  - Include file I/O and streaming operations

#### Running Tests

```bash
# Run all tests
yarn test

# Run only unit tests (fast, parallel execution)
yarn test:unit

# Run only integration tests (slower, sequential execution)
yarn test:integration

# Run specific integration test types
yarn test:async      # Async/await patterns
yarn test:events     # Event handling
yarn test:multi      # Multiple input/output scenarios
yarn test:probe      # Media probing functionality

# Development and debugging
yarn test:watch      # Watch mode for development
yarn test:debug      # Debug mode with ffmpeggy debug output
yarn test:coverage   # Run tests with coverage report

```

#### Writing Tests

When writing tests, follow these guidelines:

##### **Choose the Right Test Type**

- **Use Unit Tests for**:

  - Configuration and constructor tests
  - Validation logic
  - Utility functions (parsers, formatters)
  - Error handling without FFmpeg execution
  - Setter/getter methods
  - Core class functionality

- **Use Integration Tests for**:
  - Actual FFmpeg process execution
  - File input/output operations
  - Streaming functionality
  - Event emission and handling
  - Timeout scenarios
  - Multi-input/output scenarios
  - Real-world usage patterns

##### **Test Naming Conventions**

- Use descriptive test names that explain what is being tested
- Follow the pattern: `"should [expected behavior] when [condition]"`
- Examples:
  - ✅ `"should initialize with default values"`
  - ✅ `"should emit done event when copying video file"`
  - ❌ `"should copy bunny2.mp4 to temp file using events"`

##### **Test Organization Best Practices**

Based on [Jest organization guidelines](https://medium.com/@jeff_long/organizing-tests-in-jest-17fc431ff850):

1. **Group related tests** using `describe()` blocks
2. **Test one thing per test** - avoid testing multiple behaviors in a single test
3. **Use descriptive test names** that explain the expected behavior
4. **Avoid test duplication** - don't repeat the same test in multiple files
5. **Organize by functionality**, not by file types

##### **Integration Test Considerations**

Following [FFmpeg FATE testing principles](https://trac.ffmpeg.org/wiki/FATE/AddingATest):

1. **Use appropriate timeouts** - Integration tests need longer timeouts (60s default)
2. **Clean up resources** - Ensure temporary files are removed after tests
3. **Test realistic scenarios** - Use actual media files and real FFmpeg operations
4. **Handle async operations properly** - Use proper async/await patterns
5. **Test error conditions** - Include tests for FFmpeg failures and timeouts

#### Test File Structure

```text
src/__tests__/
├── *.unit.test.ts              # Unit tests (fast, parallel)
├── integration/                # Integration tests (slower, sequential)
│   ├── FFmpeggy.async.integration.test.ts
│   ├── FFmpeggy.events.integration.test.ts
│   ├── FFmpeggy.multi.integration.test.ts
│   ├── FFmpeggy.probe.integration.test.ts
│   ├── FFmpeggy.timeout.integration.test.ts
│   └── requireCommonJSModule.integration.test.ts
├── samples/                    # Test media files
└── utils/                      # Test utilities
    ├── testHelpers.ts          # Common test setup and helper functions
    └── waitFiles.ts            # File system utilities for tests
```

#### Test Utilities

The project provides several test utilities in `src/__tests__/utils/`:

- `testHelpers.ts` - Common test setup and helper functions
- `waitFiles.ts` - File system utilities for tests
- `FFmpeggyTestHelpers` - FFmpeggy-specific test helpers

### Debugging and Development

FFmpeggy uses the [debug](https://github.com/debug-js/debug) library for comprehensive logging during development and troubleshooting. This is essential for understanding internal operations and debugging issues.

#### Debug Namespaces

The project uses several debug namespaces:

- `ffmpeggy` - General FFmpeggy operations
- `ffmpeggy:args` - FFmpeg command line arguments construction
- `ffmpeggy:process` - Process management and lifecycle
- `ffmpeggy:streams` - Stream handling and pipeline operations
- `ffmpeggy:events` - Event emission and handling
- `ffmpeggy:timeout` - Progress timeout management

#### Development Debugging

During development, enable debug output to see detailed operations:

```bash
# Enable all FFmpeggy debug output
DEBUG=ffmpeggy yarn test:debug

# Enable specific namespaces for focused debugging
DEBUG=ffmpeggy:args,ffmpeggy:process yarn test:debug

# Debug specific test files
DEBUG=ffmpeggy yarn test:unit
```

#### Debug Output Examples

When debugging, you'll see detailed information like:

```log
ffmpeggy:args FFmpeg command: ffmpeg -i input.mp4 -c:v libx264 -c:a aac output.mp4
ffmpeggy:process Starting FFmpeg process with PID: 12345
ffmpeggy:events Emitting progress event: { frame: 100, fps: 25.0, time: 4.0 }
ffmpeggy:streams Setting up pipeline for output streams
ffmpeggy:process FFmpeg process completed with exit code: 0
```

#### Debug Configuration

Configure debug output behavior using environment variables:

```bash
# Enable colors in debug output
DEBUG_COLORS=1 DEBUG=ffmpeggy yarn test:debug

# Hide timestamps for cleaner output
DEBUG_HIDE_DATE=1 DEBUG=ffmpeggy yarn test:debug

# Set object inspection depth
DEBUG_DEPTH=5 DEBUG=ffmpeggy yarn test:debug
```

#### Troubleshooting Test Failures

When tests fail, debug output can help identify the issue:

```bash
# Debug integration test failures
DEBUG=ffmpeggy yarn test:integration

# Debug specific test project
DEBUG=ffmpeggy yarn test:async

# Debug with full FFmpeg output
DEBUG=ffmpeggy,ffmpeggy:args yarn test:debug
```

### FFmpeg Output Limitations

**FFmpeg and FFmpeggy Output Constraints**

- You can specify multiple file outputs.
- You can specify a single WriteStream output (for piping to Node.js).
- You can use the tee muxer to output to multiple files and at most one WriteStream (the stream must be the last output).
- **You cannot use more than one WriteStream output in a single command.**

This is a limitation of FFmpeg itself, not just this library. See [FFmpeg documentation](https://trac.ffmpeg.org/wiki/Creating%20multiple%20outputs) for more details.

#### Examples

```ts
// Multiple file outputs (supported)
.setOutputs([
  { destination: "file1.mp4", options: [...] },
  { destination: "file2.mkv", options: [...] }
]);

// Single WriteStream output (supported)
.setOutputs([
  { destination: myWriteStream, options: [...] }
]);

// Tee muxer: file + WriteStream (supported, stream must be last)
.setOutputs([
  { destination: "file1.mp4", options: [...] },
  { destination: myWriteStream, options: [...] }
]).useTee();

// Multiple WriteStreams (NOT supported)
.setOutputs([
  { destination: myWriteStream1, options: [...] },
  { destination: myWriteStream2, options: [...] }
]); // ❌ Will throw at runtime
```

**If you violate these constraints, FFmpeggy will throw an error at runtime.**

For more details, see the [FFmpeg documentation](https://trac.ffmpeg.org/wiki/Creating%20multiple%20outputs).

#### Progress-Based Timeout

FFmpeggy supports a progress-based timeout mechanism that will kill the FFmpeg process if no progress events are received within a specified time period. This is useful for detecting stalled or hanging FFmpeg processes.

**Enable Timeout:**

```ts
// Using constructor option
const ffmpeggy = new FFmpeggy({
  input: "input.mp4",
  output: "output.mp4",
  timeout: 30000, // 30 seconds
});

// Using method chaining
const ffmpeggy = new FFmpeggy()
  .setInput("input.mp4")
  .setOutput("output.mp4")
  .setTimeout(30000); // 30 seconds

// Listen for timeout errors
ffmpeggy.on("error", (error) => {
  if (error.message.includes("timed out")) {
    console.log("FFmpeg process timed out - no progress received");
  }
});

await ffmpeggy.run();
```

**Timeout Behavior:**

- The timeout is based on progress events from FFmpeg
- If no progress event is received within the timeout period, the FFmpeg process is killed
- A timeout error is emitted via the `error` event
- The timeout is automatically reset on each progress event
- Default interval checks every 250ms to 2 seconds (depending on timeout value)

**Best Practices:**

- Set timeout values appropriate for your input file size and processing complexity
- For large files, use longer timeouts (30-60 seconds)
- For streaming operations, use shorter timeouts (5-15 seconds)
- Always handle timeout errors in your error event listeners

### Documentation

- Update README.md if necessary
- Add JSDoc comments for new functions
- Update CHANGELOG.md for significant changes

## Getting Help

If you need help or have questions:

- Open an issue
- Check existing documentation
- Review existing issues and pull requests

Thank you for contributing to FFmpeggy!
