import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The docs and examples the server answers from.
 *
 * They are the same files the website publishes and the test suite mounts, not
 * a copy written for the server: an agent is told exactly what a person reads,
 * and nothing it is shown can be an example that has stopped working.
 *
 * Installed from npm the files sit in `content/` beside `dist/`; run from the
 * repository they are read from `docs/` and `examples/recipes/` directly, so a
 * doc edit is live without a build.
 */

export type Doc = Readonly<{ topic: string; title: string; summary: string; body: string }>;
export type Example = Readonly<{
  id: string; title: string; summary: string; file: string;
  techniques: readonly string[]; packages: readonly string[]; source: string;
}>;

const here = path.dirname(fileURLToPath(import.meta.url));

function contentRoots(): Readonly<{ docs: string; examples: string }> {
  const packaged = path.resolve(here, "../content");
  if (existsSync(path.join(packaged, "docs"))) return { docs: path.join(packaged, "docs"), examples: path.join(packaged, "examples") };
  const repository = path.resolve(here, "../../..");
  return { docs: path.join(repository, "docs"), examples: path.join(repository, "examples/recipes") };
}

/** Front matter is two keys and nothing else, so it is read by hand rather than with a YAML parser. */
export function parseDoc(topic: string, text: string): Doc {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  const fields = new Map((match?.[1] ?? "").split("\n").flatMap((line) => {
    const colon = line.indexOf(":");
    return colon < 0 ? [] : [[line.slice(0, colon).trim(), line.slice(colon + 1).trim().replace(/^"(.*)"$/, "$1")] as const];
  }));
  const body = (match?.[2] ?? text).trim();
  const heading = /^#\s+(.+)$/m.exec(body)?.[1];
  return { topic, title: fields.get("title") ?? heading ?? topic, summary: fields.get("summary") ?? "", body };
}

export function loadDocs(): readonly Doc[] {
  const { docs } = contentRoots();
  if (!existsSync(docs)) return [];
  const pages = readdirSync(docs).filter((file) => file.endsWith(".md")).map((file) => file.replace(/\.md$/, ""));
  // Reading order comes from the same manifest the website's sidebar is built from; anything unlisted follows alphabetically.
  const manifest = path.join(docs, "manifest.json");
  const ordered = existsSync(manifest)
    ? (JSON.parse(readFileSync(manifest, "utf8")) as { groups: readonly { pages: readonly string[] }[] }).groups.flatMap((group) => group.pages)
    : [];
  const position = (topic: string): number => ordered.includes(topic) ? ordered.indexOf(topic) : ordered.length;
  return pages.sort((left, right) => position(left) - position(right) || left.localeCompare(right))
    .map((topic) => parseDoc(topic, readFileSync(path.join(docs, `${topic}.md`), "utf8")));
}

export function loadExamples(): readonly Example[] {
  const { examples } = contentRoots();
  const manifest = path.join(examples, "manifest.json");
  if (!existsSync(manifest)) return [];
  const entries = JSON.parse(readFileSync(manifest, "utf8")) as readonly Omit<Example, "source">[];
  return entries.map((entry) => ({ ...entry, source: readFileSync(path.join(examples, entry.file), "utf8") }));
}
