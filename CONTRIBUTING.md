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

### Code Style

- Follow the existing code style
- Use ESLint for code linting
- Write meaningful commit messages
- Keep changes focused and atomic

### Testing

This project uses [Vitest](https://vitest.dev/) for testing with multiple projects that separates different types of tests:

#### Test Types

- **Unit Tests** (`*.spec.ts`): Basic functionality tests, configuration tests, and error handling
- **Event Tests** (`*.event.test.ts`): Tests that verify event emission and handling
- **Async Tests** (`*.async.test.ts`): Tests that use async/await patterns with the `done()` method

#### Running Tests

```bash
# Run all tests
yarn test

# Run specific test types
yarn test:unit      # Run only unit tests
yarn test:events    # Run only event-based tests
yarn test:async     # Run only async-based tests

# Watch mode
yarn test:watch

# Debug mode with ffmpeggy debug output
yarn test:debug

# Run tests with coverage
yarn test:coverage
```

#### Test Organization

The test separation allows for:

- **Faster feedback**: Run only the test type you're working on
- **Better isolation**: Event tests and async tests don't interfere with each other
- **Different timeouts**: Event tests can have longer timeouts for complex scenarios
- **Clearer test intent**: Each file focuses on a specific testing pattern

#### Writing Tests

- Write tests for new features
- Ensure all tests pass before submitting a PR
- Update tests when fixing bugs
- Use the appropriate test type for your changes:
  - Use unit tests for configuration, error handling, and utility functions
  - Use event tests for testing event emission and handling
  - Use async tests for testing async/await patterns

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
