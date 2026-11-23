import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees are whole checkouts of this repo living inside it, so linting from the
    // root walks into their build output and node_modules and reports thousands of
    // problems that belong to neither tree. The patterns above are anchored to the
    // config's own directory, so they do not catch a nested `.next`. Each worktree
    // lints itself when you run the script from inside it.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
