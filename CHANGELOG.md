## [3.1.3](https://github.com/mekwall/ffmpeggy/compare/v3.1.2...v3.1.3) (2025-06-24)


### Bug Fixes

* handle progress percentage when duration is not available ([#712](https://github.com/mekwall/ffmpeggy/issues/712)) ([a75a272](https://github.com/mekwall/ffmpeggy/commit/a75a272174ee1da808213c9ff39af192157208ac)), closes [#26](https://github.com/mekwall/ffmpeggy/issues/26)

## [3.1.2](https://github.com/mekwall/ffmpeggy/compare/v3.1.1...v3.1.2) (2025-06-24)


### Bug Fixes

* **parsers:** handle N/A duration values to prevent NaN ([#711](https://github.com/mekwall/ffmpeggy/issues/711)) ([934ecb8](https://github.com/mekwall/ffmpeggy/commit/934ecb8d115ff4b735a40f09dd9d8b222d1effba))

## [3.1.1](https://github.com/mekwall/ffmpeggy/compare/v3.1.0...v3.1.1) (2025-06-24)


### Bug Fixes

* improve event/streaming ops and error handling ([#710](https://github.com/mekwall/ffmpeggy/issues/710)) ([56a6eec](https://github.com/mekwall/ffmpeggy/commit/56a6eeca58b1b195a15aabca553192f86c1169d5))

# [3.1.0](https://github.com/mekwall/ffmpeggy/compare/v3.0.5...v3.1.0) (2025-06-20)


### Bug Fixes

* resolve race condition in FFmpeggy stream handling ([#698](https://github.com/mekwall/ffmpeggy/issues/698)) ([37ce348](https://github.com/mekwall/ffmpeggy/commit/37ce3489c2edfcfb8aad78743b3f26894bbb9c23))


### Features

* emit final sizes in done event ([#699](https://github.com/mekwall/ffmpeggy/issues/699)) ([793bceb](https://github.com/mekwall/ffmpeggy/commit/793bceb75420f24394d4c8540d76749b83e17ad8))

## [3.0.5](https://github.com/mekwall/ffmpeggy/compare/v3.0.4...v3.0.5) (2025-02-24)


### Bug Fixes

* **deps:** bump @octokit/plugin-paginate-rest from 11.3.6 to 11.4.2 ([#584](https://github.com/mekwall/ffmpeggy/issues/584)) ([28b1a44](https://github.com/mekwall/ffmpeggy/commit/28b1a44fe6995be957c17488eff1b780a3281b9b))
* **deps:** bump @octokit/request from 9.1.4 to 9.2.2 ([#582](https://github.com/mekwall/ffmpeggy/issues/582)) ([c847d96](https://github.com/mekwall/ffmpeggy/commit/c847d96a98d444f36fed4b60b2f39e8585fe5160))
* **deps:** bump @octokit/request-error from 6.1.6 to 6.1.7 ([#581](https://github.com/mekwall/ffmpeggy/issues/581)) ([ada2671](https://github.com/mekwall/ffmpeggy/commit/ada26714e17f7386257cbc21e844332895454ff6))

## [3.0.4](https://github.com/mekwall/ffmpeggy/compare/v3.0.3...v3.0.4) (2025-01-04)


### Bug Fixes

* preserve options with quoted strings ([#565](https://github.com/mekwall/ffmpeggy/issues/565)) ([c6be64c](https://github.com/mekwall/ffmpeggy/commit/c6be64cf478a87ff492cfa5980988baa85e82457))

## [3.0.3](https://github.com/mekwall/ffmpeggy/compare/v3.0.2...v3.0.3) (2024-12-29)


### Bug Fixes

* **deps:** bump cross-spawn from 6.0.5 to 6.0.6 ([#555](https://github.com/mekwall/ffmpeggy/issues/555)) ([03ffb1f](https://github.com/mekwall/ffmpeggy/commit/03ffb1f4caf62d8b88b4cac16cae70b24ac25952))
* **deps:** bump debug from 4.3.4 to 4.4.0 ([#563](https://github.com/mekwall/ffmpeggy/issues/563)) ([9d80876](https://github.com/mekwall/ffmpeggy/commit/9d808762eddeb0a9ca51b2bce1a1018a20ab120c))

## [3.0.2](https://github.com/mekwall/ffmpeggy/compare/v3.0.1...v3.0.2) (2024-09-20)

### Bug Fixes

- **deps:** bump braces from 3.0.2 to 3.0.3 ([#500](https://github.com/mekwall/ffmpeggy/issues/500)) ([6d863b4](https://github.com/mekwall/ffmpeggy/commit/6d863b4c5f3f1e8714518e12bbd7b7b550a0937f))
- **deps:** bump ejs from 3.1.8 to 3.1.10 ([#487](https://github.com/mekwall/ffmpeggy/issues/487)) ([7d2a5be](https://github.com/mekwall/ffmpeggy/commit/7d2a5beb44eb2f0fd332ff0ca7168506f52bdb8f))
- **deps:** bump micromatch from 4.0.5 to 4.0.8 ([#520](https://github.com/mekwall/ffmpeggy/issues/520)) ([0693f7e](https://github.com/mekwall/ffmpeggy/commit/0693f7e518635080d4bdac7a24c3c16dcf8463ea))
- **deps:** bump tar from 6.1.11 to 6.2.1 ([#482](https://github.com/mekwall/ffmpeggy/issues/482)) ([f2ea79a](https://github.com/mekwall/ffmpeggy/commit/f2ea79a9c2534c119180544d60e34522fbd6e3a5))

## [3.0.1](https://github.com/mekwall/ffmpeggy/compare/v3.0.0...v3.0.1) (2024-04-29)

### Bug Fixes

- **deps:** bump ip from 1.1.8 to 1.1.9 ([#480](https://github.com/mekwall/ffmpeggy/issues/480)) ([f71774d](https://github.com/mekwall/ffmpeggy/commit/f71774d46f19888f5a120cec981922abba8a639f))

# [3.0.0](https://github.com/mekwall/ffmpeggy/compare/v2.1.8...v3.0.0) (2023-11-02)

### Bug Fixes

- **deps:** bump @babel/traverse from 7.22.5 to 7.23.2 ([#444](https://github.com/mekwall/ffmpeggy/issues/444)) ([880f957](https://github.com/mekwall/ffmpeggy/commit/880f9572796893e19dc19324b50a282ff3d23a7d))

### chore

- **yarn/node/ci:** upgrade yarn, node and update ci workflows ([#449](https://github.com/mekwall/ffmpeggy/issues/449)) ([5071888](https://github.com/mekwall/ffmpeggy/commit/5071888002580ca19fa22e8ba940fb6ad06e204a))

### BREAKING CHANGES

- **yarn/node/ci:** Package no longer supports node v16 or earlier. It will probably work but will no longer be officially supported.

## [2.1.8](https://github.com/mekwall/ffmpeggy/compare/v2.1.7...v2.1.8) (2023-07-14)

### Bug Fixes

- **deps:** bump semver from 5.7.1 to 5.7.2 ([#405](https://github.com/mekwall/ffmpeggy/issues/405)) ([7d9209b](https://github.com/mekwall/ffmpeggy/commit/7d9209bd417dc868d9533ead3d421eb7b299bdb1))

## [2.1.7](https://github.com/mekwall/ffmpeggy/compare/v2.1.6...v2.1.7) (2023-04-11)

### Bug Fixes

- **deps:** bump http-cache-semantics from 4.1.0 to 4.1.1 ([#298](https://github.com/mekwall/ffmpeggy/issues/298)) ([edbd22c](https://github.com/mekwall/ffmpeggy/commit/edbd22c0dbc78dc65de31ab3c80c7429c2d7738d))
- **deps:** bump json5 from 1.0.1 to 1.0.2 ([#293](https://github.com/mekwall/ffmpeggy/issues/293)) ([f5eae42](https://github.com/mekwall/ffmpeggy/commit/f5eae428c523a3e5b0f78c527f82b5e9062e3563))
- duration is NaN ([a925a97](https://github.com/mekwall/ffmpeggy/commit/a925a97546b9ac6e619f48c345b96b5dead3a836))

## [2.1.6](https://github.com/mekwall/ffmpeggy/compare/v2.1.5...v2.1.6) (2022-06-04)

### Bug Fixes

- **deps:** bump npm from 8.10.0 to 8.12.0 ([b00f049](https://github.com/mekwall/ffmpeggy/commit/b00f049ed8a545d3040ba009f6cf6ceac9f7eee7))

## [2.1.5](https://github.com/mekwall/ffmpeggy/compare/v2.1.4...v2.1.5) (2022-05-21)

### Bug Fixes

- **deps:** upgrade all the deps ([eb1f8cb](https://github.com/mekwall/ffmpeggy/commit/eb1f8cbe5bf917416918e8122e114572b1970006))
- error in catch is unknown since TypeScript 4.4 ([096258f](https://github.com/mekwall/ffmpeggy/commit/096258f35dd7f3659a2f1a41acf0ce02f1b93cbe))
- **FFmpeggy:** interface not compatible with TypedEmitter ([30112c5](https://github.com/mekwall/ffmpeggy/commit/30112c5b33ef80c8732661893ee7476926072049))

## [2.1.4](https://github.com/mekwall/ffmpeggy/compare/v2.1.3...v2.1.4) (2022-05-21)

### Bug Fixes

- **deps:** bump node-fetch from 2.6.1 to 2.6.7 ([34f8679](https://github.com/mekwall/ffmpeggy/commit/34f86796212498a1499fbd8a23b09ba22060ab96))
- **deps:** bump trim-off-newlines from 1.0.1 to 1.0.3 ([a37a416](https://github.com/mekwall/ffmpeggy/commit/a37a416c6be2ec8af40fc3bcf7311aa935680ae1))

## [2.1.3](https://github.com/mekwall/ffmpeggy/compare/v2.1.2...v2.1.3) (2021-08-14)

### Bug Fixes

- add missing option setters ([b919182](https://github.com/mekwall/ffmpeggy/commit/b919182da87e413951aef8b708cd271542c3b1e9))
- **parsers:** returning 0 when it should be undefined ([bc0c995](https://github.com/mekwall/ffmpeggy/commit/bc0c995cc736ece9164aa0d0736e6a74d742b591))

## [2.1.2](https://github.com/mekwall/ffmpeggy/compare/v2.1.1...v2.1.2) (2021-08-13)

### Bug Fixes

- semantic-release ([36c42a1](https://github.com/mekwall/ffmpeggy/commit/36c42a1cd6835c7d36c4797bef94fce9a6f7b92b))
