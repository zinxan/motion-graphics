import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { JsonObject } from "@matildeene/motion-core";
import { helpText, parseArgs } from "./args.js";
import { buildRenderSite } from "./project-builder.js";

const require = createRequire(import.meta.url);

async function pathExists(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

async function loadProps(path: string | undefined): Promise<JsonObject> {
  if (!path) return {};
  const parsed = JSON.parse(await readFile(resolve(path), "utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError("The props file must contain a JSON object.");
  }
  return parsed as JsonObject;
}

async function launchElectron(site: string, output: string, replace: boolean, memoryLimitMiB: number): Promise<void> {
  const electronBinary = require("electron") as unknown;
  if (typeof electronBinary !== "string") throw new Error("The Electron executable is unavailable.");
  const runner = fileURLToPath(new URL("./runner", import.meta.url));
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(electronBinary, [runner, site, output, replace ? "replace" : "create", String(memoryLimitMiB)], {
      env: environment,
      stdio: "inherit",
    });
    let cancelled = false;
    let escalation: ReturnType<typeof setTimeout> | undefined;
    const cancel = (): void => {
      cancelled = true;
      child.kill("SIGTERM");
      escalation ??= setTimeout(() => child.kill("SIGKILL"), 5000);
    };
    const cleanup = (): void => {
      process.off("SIGINT", cancel);
      process.off("SIGTERM", cancel);
      if (escalation) clearTimeout(escalation);
    };
    process.on("SIGINT", cancel);
    process.on("SIGTERM", cancel);
    child.once("error", (error) => { cleanup(); reject(error); });
    child.once("exit", (code, signal) => {
      cleanup();
      if (code === 0 && !cancelled) {
        resolvePromise();
        return;
      }
      reject(new Error(signal ? `Renderer stopped by ${signal}.` : `Renderer exited with code ${code ?? 1}.`));
    });
  });
}

export async function runCli(args: readonly string[]): Promise<void> {
  const command = parseArgs(args);
  if (command.kind === "help") {
    console.info(helpText());
    return;
  }

  const entryPath = resolve(command.entry);
  const outputPath = resolve(command.output);
  if (!(await pathExists(entryPath))) throw new Error(`Film entry not found: ${entryPath}`);
  if (await pathExists(outputPath)) {
    if (!command.force) throw new Error(`Output already exists: ${outputPath}. Pass --force to replace it.`);
  }

  const props = await loadProps(command.propsPath);
  const temporaryDirectory = await mkdtemp(`${tmpdir()}/zxn-motion-`);
  try {
    console.info(`Bundling ${command.filmId}…`);
    const site = await buildRenderSite({
      directory: temporaryDirectory,
      entryPath,
      filmId: command.filmId,
      format: command.format,
      props,
      stylesheet: command.cssPath === undefined ? undefined : await readFile(resolve(command.cssPath), "utf8"),
      alias: command.appRoot === undefined ? undefined : { "@/": `${resolve(command.appRoot)}/` },
      footage: Object.fromEntries(Object.entries(command.footage).map(([id, file]) => [id, resolve(file)])),
    });
    console.info(`Rendering ${command.filmId}…`);
    await launchElectron(site, outputPath, command.force, command.memoryLimitMiB);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}
