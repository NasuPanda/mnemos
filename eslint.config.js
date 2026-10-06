import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const HEX = "/#[0-9a-fA-F]{3,8}\\b/";

// AGENTS.md: colours come from tokens only, and nothing uses shadcn's destructive variant.
const APP_SYNTAX = [
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
];

// AGENTS.md: src/core has no clock; "today" is always passed in as a YYYY-MM-DD string.
const NO_CLOCK = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "src/core has no clock: take today as a YYYY-MM-DD parameter.",
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: "src/core has no clock: take today as a YYYY-MM-DD parameter.",
  },
  {
    selector: "MemberExpression[object.name='performance'][property.name='now']",
    message: "src/core has no clock: take today as a YYYY-MM-DD parameter.",
  },
];

// AGENTS.md: src/core is pure TypeScript with no React, no database and no app code.
const CORE_IMPORTS = [
  {
    regex: "^(react|react-dom|hono|drizzle-orm|jose|radix-ui|cn|cloudflare:.*)(/|$)",
    message: "src/core is pure TypeScript: no React, no database, no runtime APIs.",
  },
  { regex: "^@/", message: "src/core imports only from src/core." },
];

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
  {
    // shadcn components export their cva variants next to the component.
    files: ["src/components/ui/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", ...APP_SYNTAX] },
  },
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...APP_SYNTAX, ...NO_CLOCK],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...CORE_IMPORTS,
            { regex: "^\\.\\./", message: "src/core imports only from src/core." },
          ],
        },
      ],
    },
  },
  {
    // Test helpers one folder down may reach the modules beside them, but not outside src/core.
    files: ["src/core/*/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...CORE_IMPORTS,
            { regex: "^\\.\\./\\.\\./", message: "src/core imports only from src/core." },
          ],
        },
      ],
    },
  },
  prettier,
]);
