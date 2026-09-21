import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import type { JsonObject } from "@zxn/motion-core";
import type { RenderFormatId } from "@zxn/motion-renderer";

const documentHtml = (stylesheet: boolean): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:" />
    <title>ZXN Motion Render</title>
    ${stylesheet ? '<link rel="stylesheet" href="/film.css" />' : ""}
  </head>
  <body><script type="module" src="/render.js"></script></body>
</html>`;

/*
 * A frame provider backed by the files the caller supplied.
 *
 * The editor answers a film's footage requests from the project's own decoder.
 * Out here there is no project, so the renderer decodes the file itself with
 * mediabunny — the same library it encodes with — and hands back the canvas
 * for whichever instant the film asked for. Each source is opened once and its
 * sink kept, because a render walks a film's frames in order and reopening the
 * file per frame would dominate the render.
 */
function footageProviderSource(footage: Readonly<Record<string, string>>): string {
  // Messages use single quotes so the generated source needs no escaping.
  return `import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";

const footageUrls = ${JSON.stringify(footage)};
const sinks = new Map();

function sinkFor(assetId) {
  let pending = sinks.get(assetId);
  if (!pending) {
    pending = (async () => {
      const url = footageUrls[assetId];
      if (!url) {
        throw new Error('Footage ' + assetId + ' was not supplied. Pass --footage ' + assetId + '=<file>.');
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error('Footage ' + assetId + ' could not be read.');
      const input = new Input({ source: new BlobSource(await response.blob()), formats: ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      if (!track) throw new Error('Footage ' + assetId + ' has no video track.');
      return new CanvasSink(track, { poolSize: 2 });
    })();
    sinks.set(assetId, pending);
  }
  return pending;
}

globalThis.zxnFootage = {
  frameAt: async ({ assetId, seconds }) => {
    const sink = await sinkFor(assetId);
    const result = await sink.getCanvas(Math.max(0, seconds));
    if (!result) return undefined;
    return result.canvas ?? result;
  },
};
`;
}

function browserEntry(entryPath: string, filmId: string, format: RenderFormatId, props: JsonObject): string {
  return `import "./footage-provider.js";
import { describeFilm } from "@zxn/motion-core";
import { renderFilm } from "@zxn/motion-renderer";
import * as userEntry from ${JSON.stringify(entryPath)};

async function render() {
  if (!Array.isArray(userEntry.films)) {
    throw new TypeError("The film entry must export a films array.");
  }
  const filmId = ${JSON.stringify(filmId)};
  const film = userEntry.films.find((candidate) => candidate?.id === filmId);
  if (!film) {
    const ids = userEntry.films.map((candidate) => candidate?.id).filter(Boolean).join(", ");
    throw new Error(\`Unknown film \"\${filmId}\". Available films: \${ids || "none"}.\`);
  }
  const descriptor = describeFilm(film);
  const reportEvery = Math.max(1, Math.floor(descriptor.frames / 20));
  const bytes = await renderFilm({
    film: descriptor,
    format: ${JSON.stringify(format)},
    inputProps: ${JSON.stringify(props)},
    onProgress: ({ frame, totalFrames }) => {
      if (frame === totalFrames || frame % reportEvery === 0) {
        console.info(\`ZXN_PROGRESS \${frame}/\${totalFrames}\`);
      }
    },
  });
  const response = await fetch("/__result", { method: "POST", body: bytes });
  if (!response.ok) throw new Error(await response.text());
}

render().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  await fetch("/__error", { method: "POST", body: message });
});`;
}

export type RenderSiteOptions = Readonly<{
  directory: string;
  entryPath: string;
  filmId: string;
  format: RenderFormatId;
  props: JsonObject;
  /**
   * A stylesheet to load beside the film, for films drawn with Tailwind
   * classes and the application's design tokens. The editor generates the
   * equivalent sheet when it renders a composition; out here the caller
   * supplies it, so the CLI needs no build tooling of its own.
   */
  stylesheet?: string;
  /**
   * Video files to answer a film's `<Footage asset="…">` requests, by asset id.
   */
  footage?: Readonly<Record<string, string>>;
  /**
   * Extra module aliases. `@zxn/ui` resolves on its own as a workspace
   * package, but the components it re-exports reach each other through the
   * application's own `@/` alias, which only the caller can point at a root.
   */
  alias?: Readonly<Record<string, string>>;
}>;

export async function buildRenderSite(options: RenderSiteOptions): Promise<string> {
  const { directory, entryPath, filmId, format, props } = options;
  const renderEntry = join(directory, "render-entry.ts");
  const footage = options.footage ?? {};
  const footageUrls: Record<string, string> = {};
  for (const assetId of Object.keys(footage)) footageUrls[assetId] = `/footage/${encodeURIComponent(assetId)}`;
  await writeFile(join(directory, "footage-provider.js"), footageProviderSource(footageUrls), "utf8");
  await writeFile(renderEntry, browserEntry(entryPath, filmId, format, props), "utf8");
  const outputDirectory = join(directory, "site");

  await build({
    root: directory,
    configFile: false,
    publicDir: false,
    logLevel: "silent",
    esbuild: { jsx: "automatic" },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: [
        { find: "@zxn/motion-core", replacement: fileURLToPath(import.meta.resolve("@zxn/motion-core")) },
        { find: "@zxn/motion-renderer", replacement: fileURLToPath(import.meta.resolve("@zxn/motion-renderer")) },
        { find: "mediabunny", replacement: fileURLToPath(import.meta.resolve("mediabunny")) },
        ...Object.entries(options.alias ?? {}).map(([find, replacement]) => ({ find, replacement })),
      ],
    },
    build: {
      emptyOutDir: true,
      outDir: outputDirectory,
      rollupOptions: {
        input: renderEntry,
        output: {
          entryFileNames: "render.js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
        },
      },
    },
  });

  if (Object.keys(footage).length > 0) {
    // Served beside the page, so the decoder reads it under `connect-src 'self'`.
    const footageDirectory = join(outputDirectory, "footage");
    await mkdir(footageDirectory, { recursive: true });
    for (const [assetId, file] of Object.entries(footage)) {
      await copyFile(file, join(footageDirectory, encodeURIComponent(assetId)));
    }
  }
  if (options.stylesheet !== undefined) {
    await writeFile(join(outputDirectory, "film.css"), options.stylesheet, "utf8");
  }
  await writeFile(join(outputDirectory, "index.html"), documentHtml(options.stylesheet !== undefined), "utf8");

  return outputDirectory;
}
