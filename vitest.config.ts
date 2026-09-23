import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (name: string): string => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

// Tests run against each package's source, so a fresh clone can test without building first.
export default defineConfig({
  resolve: {
    alias: {
      "@matildeene/motion-core": source("core"),
      "@matildeene/motion-graphics": source("graphics"),
      "@matildeene/motion-text": source("text"),
      "@matildeene/motion-player": source("player"),
      "@matildeene/motion-renderer": source("renderer"),
      "@matildeene/motion-mcp": source("mcp"),
    },
  },
  test: { globals: true, include: ["packages/**/*.test.{ts,tsx}", "examples/**/*.test.{ts,tsx}"] },
});
