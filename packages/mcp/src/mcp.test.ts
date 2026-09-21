import { describe, expect, it } from "vitest";
import { checkFilm } from "./check.js";
import { loadExamples, parseDoc } from "./content.js";
import { search } from "./search.js";

const film = (body: string, imports = 'import { FullFrame, defineFilm, useTimeline } from "@zxn/motion-core";') => ({
  entryFile: "film.tsx",
  files: { "film.tsx": `${imports}
function Demo() { const { frame } = useTimeline(); ${body} return <FullFrame>{frame}</FullFrame>; }
export const films = [defineFilm({ id: "demo", title: "Demo", width: 1920, height: 1080, frameRate: 30, frames: 60, component: Demo, defaultProps: {} })];` },
});

describe("check_film", () => {
  it("passes a small, well-behaved film", () => {
    expect(checkFilm(film(""))).toEqual([]);
  });

  it("passes every shipped example, so the checker and the recipes can never disagree", () => {
    const examples = loadExamples();
    expect(examples.length).toBeGreaterThanOrEqual(8);
    for (const example of examples) {
      const findings = checkFilm({ entryFile: example.file, files: { [example.file]: example.source } });
      expect(findings.filter((finding) => finding.severity === "error"), example.id).toEqual([]);
    }
  });

  it("reports a type error with its line, from the SDK's real declarations", () => {
    const findings = checkFilm(film("const wrong: string = frame;"));
    expect(findings).toContainEqual(expect.objectContaining({ severity: "error", file: "film.tsx", line: 2 }));
  });

  it("refuses an import a film may not use, and says what is available", () => {
    const findings = checkFilm(film("", 'import { FullFrame, defineFilm, useTimeline } from "@zxn/motion-core";\nimport fs from "node:fs";'));
    expect(findings.find((finding) => finding.message.includes('"node:fs"'))?.message).toContain("d3-scale");
  });

  it.each([
    ["const now = Date.now();", "real clock"],
    ["const value = Math.random();", "seededRandom"],
    ["requestAnimationFrame(() => undefined);", "any order"],
  ])("warns about %s", (body, expected) => {
    expect(checkFilm(film(body)).map((finding) => finding.message).join(" ")).toContain(expected);
  });

  it("warns about the two habits that made the first AI-written rain crawl", () => {
    const slow = film('const glyphs = Array.from({ length: 1800 }, (_, index) => index).map((index) => <i key={index} style={{ textShadow: "0 0 8px lime" }}>x</i>);');
    const messages = checkFilm(slow).map((finding) => finding.message).join(" ");
    expect(messages).toContain("Canvas2D");
    expect(messages).toContain("every item of a list");
  });

  it("needs the entry file to be supplied and to export films", () => {
    expect(checkFilm({ entryFile: "missing.tsx", files: {} })[0]?.severity).toBe("error");
    expect(checkFilm({ entryFile: "film.tsx", files: { "film.tsx": "export const nothing = 1;" } }).map((finding) => finding.message).join(" ")).toContain("export const films");
  });
});

describe("docs and search", () => {
  it("reads a title and summary from front matter, and falls back to the first heading", () => {
    expect(parseDoc("canvas", "---\ntitle: Canvas\nsummary: One element.\n---\n# Ignored\nBody")).toMatchObject({ title: "Canvas", summary: "One element.", body: "# Ignored\nBody" });
    expect(parseDoc("plain", "# Plain page\nBody").title).toBe("Plain page");
  });

  it("finds the section that answers the question, and the example that shows it", () => {
    const docs = [parseDoc("canvas", "# Canvas\n\n## When to use it\nParticles and rain belong on a canvas.\n\n## API\nThe draw function."), parseDoc("tempo", "# Tempo\n\n## Beats\nBars and beats.")];
    const hits = search("rain particles", docs, loadExamples());
    expect(hits.find((hit) => hit.kind === "doc")?.title).toBe("Canvas › When to use it");
    expect(hits.map((hit) => hit.id)).toContain("matrix-rain");
    expect(search("zzzz", docs, [])).toEqual([]);
  });
});
