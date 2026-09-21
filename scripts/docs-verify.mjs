/*
 * Nothing in the docs may be wrong in a way a machine could have caught.
 *
 *   ```tsx film                      a complete film. It is type-checked against the real SDK and must
 *                                    raise no errors and no warnings from the film checker.
 *   ```tsx film expect-warnings      a complete film shown as what NOT to do. It must type-check, and it
 *                                    must actually trigger a warning, so a bad example cannot quietly go good.
 *   ```tsx excerpt=examples/x.tsx    quoted from a verified example. The text must still be in that file,
 *                                    so an example cannot change under the page that quotes it.
 *   ```tsx / ```ts                   a fragment. It must at least parse.
 *
 * Every page needs a title and a summary, and every link to another page must land.
 * Run `npm run build` first: the checker is the one the MCP server ships.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { checkFilm, parseDoc } from "../packages/mcp/dist/index.js";
import { canTypeCheck } from "../packages/mcp/dist/check.js";

// Without the SDK beside it the checker finds no type errors at all, and "nothing wrong" would be a lie.
if (!canTypeCheck()) { console.error("Cannot verify: @zxn/motion-core is not installed. Run `npm install && npm run build` first."); process.exit(1); }

const root = path.resolve(import.meta.dirname, "..");
const docsDirectory = path.join(root, "docs");
const pages = readdirSync(docsDirectory).filter((file) => file.endsWith(".md")).sort();
const problems = [];
const squash = (text) => text.replace(/\s+/g, " ").trim();
let films = 0, excerpts = 0, fragments = 0;

for (const page of pages) {
  const text = readFileSync(path.join(docsDirectory, page), "utf8");
  const fail = (line, message) => problems.push(`${page}:${line}  ${message}`);
  const doc = parseDoc(page.replace(/\.md$/, ""), text);
  if (!/^---\n(?:[^\n]*\n)*?title:/.test(text) || !doc.summary) fail(1, "needs front matter with a title and a summary.");

  for (const match of text.matchAll(/\]\((?!https?:|#|mailto:)([^)#\s]+)(#[^)]*)?\)/g)) {
    if (!existsSync(path.resolve(docsDirectory, match[1]))) fail(text.slice(0, match.index).split("\n").length, `link to "${match[1]}" does not exist.`);
  }

  for (const match of text.matchAll(/^```(\w+)([^\n]*)\n([\s\S]*?)^```/gm)) {
    const [, language, info, code] = match;
    const line = text.slice(0, match.index).split("\n").length;
    if (language !== "tsx" && language !== "ts") continue;
    const excerpt = /excerpt=(\S+)/.exec(info)?.[1];
    if (excerpt) {
      excerpts += 1;
      const file = path.join(root, excerpt);
      if (!existsSync(file)) fail(line, `excerpt source "${excerpt}" does not exist.`);
      else if (!squash(readFileSync(file, "utf8")).includes(squash(code))) fail(line, `this excerpt is no longer in ${excerpt}.`);
    } else if (/\bfilm\b/.test(info)) {
      films += 1;
      const findings = checkFilm({ entryFile: "film.tsx", files: { "film.tsx": code } });
      const errors = findings.filter((finding) => finding.severity === "error");
      const warnings = findings.filter((finding) => finding.severity === "warning");
      for (const finding of errors) fail(line + (finding.line ?? 0), `film does not compile: ${finding.message}`);
      if (/expect-warnings/.test(info)) { if (warnings.length === 0) fail(line, "marked expect-warnings, but the checker found nothing wrong with it."); }
      else for (const finding of warnings) fail(line + (finding.line ?? 0), `film raises a warning: ${finding.message}`);
    } else {
      fragments += 1;
      const result = ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 }, fileName: language === "tsx" ? "fragment.tsx" : "fragment.ts" });
      for (const diagnostic of result.diagnostics ?? []) fail(line, `fragment does not parse: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
    }
  }
}

console.log(`${pages.length} pages: ${films} complete films, ${excerpts} excerpts, ${fragments} fragments checked.`);
if (problems.length > 0) { console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`); process.exit(1); }
console.log("All docs verified.");
