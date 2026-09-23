import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

const nodePackages = ["core", "graphics", "text", "player", "renderer", "cli", "mcp"];

for (const name of nodePackages) {
  const packageName = `@matildeene/motion-${name}`;
  const module = await import(packageName);
  assert.ok(Object.keys(module).length > 0, `${packageName} has no runtime exports`);
}

const player = await build({
  entryPoints: ["@matildeene/motion-player", "@matildeene/motion-player/player.css"],
  bundle: true,
  platform: "browser",
  format: "esm",
  write: false,
  outdir: "out",
  logLevel: "silent",
});

assert.ok(player.outputFiles?.some((file) => file.path.endsWith("motion-player.js")), "The player did not bundle");
assert.ok(player.outputFiles?.some((file) => file.path.endsWith("player.css")), "The player's CSS was not bundled");

const help = execFileSync(process.execPath, ["packages/cli/dist/bin.js", "--help"], { encoding: "utf8" });
assert.match(help, /Usage:\s+zxn-motion render/);

console.log("Built package entry points, browser player, and CLI verified.");
