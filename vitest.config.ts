import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const source = (name: string): string => fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

// Tests run against each package's source, so a fresh clone can test without building first.
export default defineConfig({
  resolve: {
    alias: {
      "@zxn/motion-core": source("core"),
      "@zxn/motion-graphics": source("graphics"),
      "@zxn/motion-text": source("text"),
      "@zxn/motion-player": source("player"),
      "@zxn/motion-renderer": source("renderer"),
    },
  },
  test: { globals: true, include: ["packages/**/*.test.{ts,tsx}"] },
});
