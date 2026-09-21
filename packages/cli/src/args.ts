import type { RenderFormatId } from "@zxn/motion-renderer";

export type RenderCommand = Readonly<{
  kind: "render";
  entry: string;
  filmId: string;
  output: string;
  format: RenderFormatId;
  propsPath?: string;
  /** A stylesheet loaded beside the film, for Tailwind-styled films. */
  cssPath?: string;
  /**
   * The application root that the `@/` alias points at, so a film using
   * `@zxn/ui` can reach the components the kit re-exports.
   */
  appRoot?: string;
  /** Video files answering `<Footage asset="…">`, by asset id. */
  footage: Readonly<Record<string, string>>;
  force: boolean;
}>;

export type CliCommand = RenderCommand | Readonly<{ kind: "help" }>;

const usage = `ZXN Motion CLI

Usage:
  zxn-motion render <entry.tsx> <film-id> <output.mp4|output.mov|output.webm> [options]

Options:
  --props <file.json>  Merge JSON properties into the film defaults
  --css <file.css>     Load a stylesheet beside the film
  --app-root <dir>     Resolve the @/ alias, for films that use @zxn/ui
  --footage <id=file>  Supply a video for <Footage asset="id" />; repeatable
  --force              Replace an existing output file
  --help               Show this help

The entry module must export a \`films\` array created with defineFilm().`;

export function helpText(): string {
  return usage;
}

export function parseArgs(args: readonly string[]): CliCommand {
  if (args.length === 0 || args.includes("--help")) return { kind: "help" };
  if (args[0] !== "render") throw new Error(`Unknown command: ${args[0] ?? ""}`);

  const positionals: string[] = [];
  let propsPath: string | undefined;
  let cssPath: string | undefined;
  let appRoot: string | undefined;
  const footage: Record<string, string> = {};
  let force = false;
  const valueOptions = new Map<string, (value: string) => void>([
    ["--props", (value) => { propsPath = value; }],
    ["--css", (value) => { cssPath = value; }],
    ["--app-root", (value) => { appRoot = value; }],
    ["--footage", (value) => {
      const separator = value.indexOf("=");
      if (separator <= 0) throw new Error("--footage expects <asset-id>=<file>.");
      footage[value.slice(0, separator)] = value.slice(separator + 1);
    }],
  ]);

  for (let index = 1; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--force") {
      force = true;
      continue;
    }
    const takesValue = argument === undefined ? undefined : valueOptions.get(argument);
    if (takesValue) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument ?? ""} requires a path.`);
      takesValue(value);
      index += 1;
      continue;
    }
    if (argument?.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    if (argument) positionals.push(argument);
  }

  if (positionals.length !== 3) {
    throw new Error("render requires an entry, film ID, and output path.");
  }

  const [entry, filmId, output] = positionals;
  if (!entry || !filmId || !output) throw new Error("Render arguments cannot be empty.");
  const extension = output.toLowerCase().split(".").at(-1);
  const format = extension === "mp4" ? "mp4-h264"
    : extension === "mov" ? "mov-h264"
      : extension === "webm" ? "webm-vp9" : undefined;
  if (!format) throw new Error("Output must use the .mp4, .mov, or .webm extension.");
  return { kind: "render", entry, filmId, output, format, propsPath, cssPath, appRoot, footage, force };
}
