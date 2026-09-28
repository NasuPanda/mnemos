import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const HEX = "/#[0-9a-fA-F]{3,8}\\b/";

export default defineConfig([
  globalIgnores([
    "dist",
    ".wrangler",
    "worker-configuration.d.ts",
    "playwright-report",
    "test-results",
    "coverage",
  ]),
  {
    files: ["**/*.{ts,tsx,js}"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [reactHooks.configs.flat["recommended-latest"], reactRefresh.configs.vite],
  },
  // AGENTS.md: colours come from tokens only, and nothing uses shadcn's destructive variant.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${HEX}]`,
          message: "No raw hex colours in the app: use a token from src/styles/tokens.css.",
        },
        {
          selector: `TemplateElement[value.raw=${HEX}]`,
          message: "No raw hex colours in the app: use a token from src/styles/tokens.css.",
        },
        {
          selector: "JSXAttribute[name.name='variant'][value.value='destructive']",
          message: 'No variant="destructive": delete is a secondary button with a trash icon.',
        },
        {
          selector: "Property[key.name='destructive']",
          message: "shadcn's destructive variants are removed in Mnemos.",
        },
      ],
    },
  },
  prettier,
]);
