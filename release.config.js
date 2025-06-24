const isDryRun = process.env.DRY_RUN === "true";

export default {
  branches: ["main"],
  dryRun: isDryRun,
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json"],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    // Conditionally include plugins based on the dry-run flag
    !isDryRun && [
      "@semantic-release/npm",
      {
        npmPublish: true,
        tarballDir: ".",
      },
    ],
    !isDryRun && [
      "@semantic-release/github",
      {
        assets: "ffmpeggy-*.tgz",
      },
    ],
  ].filter(Boolean),
};
