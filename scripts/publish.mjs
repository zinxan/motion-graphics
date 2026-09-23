// Publish every workspace package to npm in dependency order.
// Usage: node scripts/publish.mjs [--dry-run]
// Requires `npm login` as the owner of the @matildeene scope.
import { execSync } from "node:child_process";

const order = ["core", "graphics", "text", "player", "renderer", "cli", "mcp"];
const dryRun = process.argv.includes("--dry-run") ? " --dry-run" : "";

execSync("npm run check", { stdio: "inherit" });

for (const name of order) {
  execSync(`npm publish --workspace packages/${name} --access public${dryRun}`, { stdio: "inherit" });
}
