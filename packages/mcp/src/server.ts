import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { allowedPackages, canTypeCheck, checkFilm } from "./check.js";
import { loadDocs, loadExamples } from "./content.js";
import { search } from "./search.js";

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

/*
 * What an agent is told before it writes a film. Short on purpose: it is read
 * on every session, and everything longer is one `search_docs` away.
 */
export const authoringRules = `# Writing a ZXN Motion film

1. A film is a pure function of its props and an integer frame. Read the frame with useTimeline(); never a clock, a timer, state that accumulates, or Math.random(). Frames are requested in any order.
2. Export \`const films = [defineFilm({ id, title, width, height, frameRate, frames, component, defaultProps, controls })]\`. Author at 1920×1080 and 30 fps unless asked otherwise; a host scales the film.
3. Give every prop a control, so a person can change it without opening the code.
4. Few large elements, not thousands of small ones. Anything particle-like (rain, snow, stars, noise, a field of lines) goes on ONE <Canvas2D draw={(ctx, frame) => ...}>. Blur and shadows are the expensive paint: never inside a loop.
5. Use DOM or SVG for things a person would select: titles, bars, labels, shapes. Give those a stable data-zxn-element-id. Do not give ids to particles.
6. Libraries are seeked, never played: build a GSAP timeline paused and call timeline.seek(seconds); lottie.goToAndStop(frame, true). Seed any noise or random source with seededRandom().
7. Motion that reads well: ease everything (easing.easeOut in, easeIn out); springValue for arrivals with weight; hold long enough to read (about 1 s per 3 words); stagger related items 2–4 frames apart; move things far enough to notice, quickly enough to feel deliberate (a full-screen travel in 0.4–0.8 s).
8. Before proposing source: call search_docs for the technique, get_example for the nearest recipe, then check_film on what you wrote and fix every error and warning.

Importable: ${allowedPackages.join(", ")}.`;

export function createServer(): McpServer {
  const docs = loadDocs();
  const examples = loadExamples();
  const server = new McpServer({ name: "zxn-motion", version: "0.1.2" }, { instructions: authoringRules });

  server.registerTool("authoring_rules", {
    title: "Authoring rules",
    description: "The short list of rules for writing a ZXN Motion film that is deterministic, fast and good-looking. Read this first in any session that will write or edit a film.",
    inputSchema: {},
  }, () => text(authoringRules));

  server.registerTool("search_docs", {
    title: "Search the docs and examples",
    description: "Search the ZXN Motion documentation and the verified example films. Use broad, topic-like queries: 'canvas particles', 'spring overshoot', 'gsap seek', 'tempo beats', 'controls props'. Returns the matching doc sections and examples, best first.",
    inputSchema: { query: z.string().min(2), limit: z.number().int().min(1).max(12).optional() },
  }, ({ query, limit }) => {
    const hits = search(query, docs, examples, limit ?? 6);
    if (hits.length === 0) return text(`Nothing matched "${query}". Topics: ${docs.map((doc) => doc.topic).join(", ")}. Examples: ${examples.map((example) => example.id).join(", ")}.`);
    return text(hits.map((hit) => hit.kind === "doc"
      ? `## ${hit.title}  (read_doc topic: ${hit.id})\n\n${hit.excerpt}`
      : `## Example: ${hit.title}  (get_example id: ${hit.id})\n\n${hit.excerpt}`).join("\n\n---\n\n"));
  });

  server.registerTool("list_docs", {
    title: "List documentation topics",
    description: "Every documentation topic with a one-line summary. Pass a topic to read_doc.",
    inputSchema: {},
  }, () => text(docs.map((doc) => `- ${doc.topic}: ${doc.title}${doc.summary ? ` — ${doc.summary}` : ""}`).join("\n") || "No docs are installed."));

  server.registerTool("read_doc", {
    title: "Read a documentation page",
    description: "The full Markdown of one documentation topic from list_docs.",
    inputSchema: { topic: z.string() },
  }, ({ topic }) => {
    const doc = docs.find((item) => item.topic === topic);
    return doc ? text(doc.body) : text(`No topic "${topic}". Topics: ${docs.map((item) => item.topic).join(", ")}.`);
  });

  server.registerTool("list_examples", {
    title: "List example films",
    description: "Every verified example film with what it shows, the techniques it uses and the packages it imports. Each one is mounted and rendered by the test suite, so it is known to work.",
    inputSchema: {},
  }, () => text(examples.map((example) =>
    `- ${example.id}: ${example.title} — ${example.summary}\n  techniques: ${example.techniques.join(", ")}${example.packages.length ? `\n  packages: ${example.packages.join(", ")}` : ""}`).join("\n") || "No examples are installed."));

  server.registerTool("get_example", {
    title: "Get an example film's source",
    description: "The complete, working source of one example film. Start from the nearest example rather than from nothing.",
    inputSchema: { id: z.string() },
  }, ({ id }) => {
    const example = examples.find((item) => item.id === id);
    return example
      ? text(`// ${example.title}: ${example.summary}\n// examples/recipes/${example.file}\n\n${example.source}`)
      : text(`No example "${id}". Examples: ${examples.map((item) => item.id).join(", ")}.`);
  });

  server.registerTool("check_film", {
    title: "Check a film's source",
    description: "Type-check film source against the real SDK and look for imports a film may not use and habits that make a film slow or unrepeatable (real clocks, unseeded randomness, played-not-seeked libraries, blur in loops, thousands of elements). Nothing is executed. Call it on everything you write and fix what it reports before proposing the source.",
    inputSchema: {
      entryFile: z.string().describe("The file that exports `films`, e.g. film.tsx"),
      files: z.record(z.string()).describe("Every source file, keyed by its path relative to the entry file's directory"),
    },
  }, ({ entryFile, files }) => {
    const findings = checkFilm({ entryFile, files });
    const typed = canTypeCheck() ? "" : "\n\nNote: @matildeene/motion-core is not installed beside this server, so types were not checked; only imports and habits were.";
    if (findings.length === 0) return text(`No problems found.${typed}`);
    const lines = findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.file}${finding.line ? `:${String(finding.line)}` : ""}  ${finding.message}`);
    const errors = findings.filter((finding) => finding.severity === "error").length;
    return text(`${String(errors)} error(s), ${String(findings.length - errors)} warning(s).\n\n${lines.join("\n")}${typed}`);
  });

  return server;
}
