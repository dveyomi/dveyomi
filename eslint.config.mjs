import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Every word a person reads comes from src/i18n/messages, so the app can be shown in other languages.
  {
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    ignores: ["src/app/design/**", "**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        { noStrings: false, ignoreProps: true, allowedStrings: ["Personal Finance OS", "·", "–", "—", "%", "/", "+", "−", "×", "…", ":", "(", ")", ",", ".", "?", "!"] },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
