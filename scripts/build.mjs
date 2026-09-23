import { copyFile, cp, mkdir, readdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { build } from "esbuild";

// In dependency order: everything builds on core, and the CLI on the renderer.
const packages = ["core", "graphics", "text", "player", "renderer", "cli", "mcp"];

const runTypeScript = (packageName) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ["node_modules/typescript/bin/tsc", "-p", `packages/${packageName}/tsconfig.build.json`], { stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`TypeScript failed while building ${packageName}.`)));
});

for (const packageName of packages) {
  await rm(`packages/${packageName}/dist`, { force: true, recursive: true });
  await runTypeScript(packageName);
  await copyFile("LICENSE", `packages/${packageName}/LICENSE`);
}

await copyFile("packages/player/src/player.css", "packages/player/dist/player.css");

await build({
  entryPoints: ["packages/cli/src/electron-runner.ts"],
  outfile: "packages/cli/dist/electron-runner.mjs",
  bundle: true, platform: "node", format: "esm", packages: "external", sourcemap: true,
});
await mkdir("packages/cli/dist/runner", { recursive: true });
await copyFile("packages/cli/runner/package.json", "packages/cli/dist/runner/package.json");

// The MCP server answers from the same docs and examples the site publishes; they travel with the package.
await rm("packages/mcp/content", { force: true, recursive: true });
await cp("docs", "packages/mcp/content/docs", { recursive: true });
await mkdir("packages/mcp/content/examples/recipes", { recursive: true });
for (const file of await readdir("examples/recipes")) {
  if (file.endsWith(".test.tsx") || file === "index.ts") continue;
  await copyFile(`examples/recipes/${file}`, `packages/mcp/content/examples/${file}`);
  await copyFile(`examples/recipes/${file}`, `packages/mcp/content/examples/recipes/${file}`);
}
for (const file of await readdir("examples")) {
  if (!file.endsWith(".tsx")) continue;
  await copyFile(`examples/${file}`, `packages/mcp/content/examples/${file}`);
}
