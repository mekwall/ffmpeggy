/** @type {import('eslint').Linter.Config} */
const config = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
    "plugin:import/recommended",
    "plugin:import/typescript",
  ],
  plugins: ["unused-imports"],
  env: {
    node: true,
    commonjs: true,
    browser: false,
    es6: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: {
      modules: true,
    },
  },
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts"],
    },
  },
  rules: {
    "no-empty": "warn",
    "import/no-unresolved": "error",
    "import/order": [
      "warn",
      {
        "newlines-between": "never",
        groups: [
          "builtin",
          "external",
          "internal",
          "object",
          "parent",
          "sibling",
          "index",
        ],
        alphabetize: {
          order: "asc",
        },
      },
    ],
    "unused-imports/no-unused-imports": "warn",
    "unused-imports/no-unused-vars": "off",
    "@typescript-eslint/explicit-member-accessibility": ["warn"],
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  },
  overrides: [
    {
      files: ["*.js"],
      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};

module.exports = config;
