import eslint from "@eslint/js";
import importAliasPlugin from "@limegrass/eslint-plugin-import-alias";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import prettierPlugin from "eslint-plugin-prettier";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import vitestPlugin from "eslint-plugin-vitest";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".yarn/**", "dist/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginUnicorn.configs.recommended,
  {
    rules: {
      // We don't like this convention
      "unicorn/filename-case": "off",
      // TODO: Consider using EventTarget instead of EventEmitter for better browser compatibility
      "unicorn/prefer-event-target": "warn",
    },
  },
  {
    files: ["*.{cjs,js,ts}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          modules: true,
        },
      },
      globals: {
        module: "readonly",
        exports: "readonly",
        require: "readonly",
        process: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      import: importPlugin,
      "unused-imports": unusedImportsPlugin,
      vitest: vitestPlugin,
      "@limegrass/import-alias": importAliasPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts"],
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
        alias: {
          map: [["#", "./src"]],
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
      },
    },
    rules: {
      "no-empty": "warn",
      "import/no-unresolved": "error",
      "import/extensions": [
        "warn",
        "ignorePackages",
        {
          js: "never",
          ts: "never",
        },
      ],
      "@limegrass/import-alias/import-alias": "warn",
      "import/order": [
        "warn",
        {
          "newlines-between": "always",
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          pathGroups: [
            {
              pattern: "#/**",
              group: "internal",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["internal"],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": "off",
      "@typescript-eslint/explicit-member-accessibility": ["warn"],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "prettier/prettier": "warn",
    },
  },
  {
    files: ["**/*.test.js", "**/*.spec.ts", "**/*.test.cjs", "**/*.test.ts"],
    languageOptions: {
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        process: "readonly",
        require: "readonly",
        vi: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
  },
  prettierConfig,
);
