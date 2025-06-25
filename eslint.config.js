import eslint from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".yarn/**", "dist/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    files: ["*.{cjs,js,ts}"],
    languageOptions: {
      ecmaVersion: 2020,
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
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  {
    files: ["**/*.test.js", "**/*.spec.ts", "**/*.test.cjs"],
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
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  }
);
