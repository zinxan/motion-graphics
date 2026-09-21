import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

/*
 * Checks a film's source the way the SDK will meet it: type errors against the
 * real `@zxn/motion-core` declarations, imports a film is not allowed, and the
 * handful of habits that make a film slow or unrepeatable.
 *
 * Nothing is executed. An agent can call this as often as it likes on source
 * it has just written, and what comes back is what a compile would have said.
 */

export type Finding = Readonly<{ severity: "error" | "warning"; file: string; line?: number; message: string }>;
export type FilmSource = Readonly<{ entryFile: string; files: Readonly<Record<string, string>> }>;

/** What a film may import: React, the SDK, and the seekable, deterministic libraries ZXN Studio bundles. */
export const allowedPackages = [
  "react", "react/jsx-runtime", "@zxn/motion-core", "@zxn/motion-graphics", "@zxn/motion-text", "@zxn/ui",
  "lucide-react", "clsx", "tailwind-merge", "class-variance-authority", "radix-ui",
  "d3-scale", "d3-shape", "d3-interpolate", "d3-ease", "gsap", "lottie-web", "simplex-noise", "culori",
] as const;

const isAllowed = (specifier: string): boolean =>
  specifier.startsWith(".") || allowedPackages.some((name) => specifier === name || specifier.startsWith(`${name}/`));

const lineOf = (text: string, index: number): number => text.slice(0, index).split("\n").length;

/** Habits worth a warning. Each says what to do instead, because "this is slow" alone is not actionable. */
const habits: readonly Readonly<{ pattern: RegExp; message: string }>[] = [
  { pattern: /Array\.from\(\s*\{\s*length:\s*(\d{3,})/g, message: "This builds hundreds of elements or more. DOM costs layout and paint per element on every frame: draw a field of many things on one <Canvas2D> instead." },
  { pattern: /\bsetInterval\(|\brequestAnimationFrame\(/g, message: "Timers and animation frames run on a clock. Compute the picture from useTimeline().frame; a film must draw any frame on its own, in any order." },
  { pattern: /\bDate\.now\(\)|\bnew Date\(\)|\bperformance\.now\(\)/g, message: "A film must not read the real clock. Use useTimeline().frame or useVirtualTime().seconds." },
  { pattern: /\bMath\.random\(\)/g, message: "Math.random() differs on every render outside ZXN Studio's sandbox. Use seededRandom(seed) so a frame always draws the same thing." },
  { pattern: /createNoise[234]D\(\s*\)/g, message: "An unseeded noise function is a different field on every render. Pass a deterministic source: createNoise3D(() => seededRandom(...))." },
  { pattern: /\.(play|restart|resume)\(\)/g, message: "Letting a library play runs it on the real clock. Build it paused and seek it every frame: timeline.seek(seconds), lottie.goToAndStop(frame, true)." },
  { pattern: /\btransition\s*:|\banimation\s*:|@keyframes/g, message: "CSS transitions and animations are driven by the browser's clock, not the frame, and will not match the export. Compute the value from the frame." },
  { pattern: /useState\(|useReducer\(/g, message: "State that accumulates across frames breaks scrubbing: frames are asked for in any order. Derive everything from the frame and props." },
];

function habitFindings(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  for (const { pattern, message } of habits) {
    for (const match of text.matchAll(pattern)) findings.push({ severity: "warning", file, line: lineOf(text, match.index), message });
  }
  // Blur inside a loop is the single most common way to make a film crawl.
  const looped = /\.map\([\s\S]{0,1200}?(textShadow|boxShadow|filter:\s*["'`]blur|backdropFilter)/.exec(text);
  if (looped) findings.push({ severity: "warning", file, line: lineOf(text, looped.index), message: "A blur or shadow is applied to every item of a list. Blur is the most expensive thing to paint; put one on a shared parent, or draw the list on a <Canvas2D>." });
  const size = /width:\s*(\d{4,}),\s*\n?\s*height:\s*(\d{4,})/.exec(text);
  if (size && Number(size[1]) * Number(size[2]) > 1920 * 1080) findings.push({ severity: "warning", file, line: lineOf(text, size.index), message: "Larger than 1920×1080. A host scales a film to fit; four times the pixels is four times the paint on every frame. Author at 1920×1080 unless asked otherwise." });
  return findings;
}

function importFindings(file: string, text: string): Finding[] {
  const findings: Finding[] = [];
  for (const match of text.matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g)) {
    const specifier = match[1]!;
    if (!isAllowed(specifier)) findings.push({ severity: "error", file, line: lineOf(text, match.index), message: `"${specifier}" cannot be imported by a film. Available: ${allowedPackages.join(", ")}.` });
  }
  return findings;
}

/** A directory whose node_modules can resolve the SDK, so types come from the real declarations. */
function resolutionRoot(): string {
  const require = createRequire(import.meta.url);
  try {
    const core = require.resolve("@zxn/motion-core/package.json");
    return path.resolve(path.dirname(core), "../../..");
  } catch {
    return process.cwd();
  }
}

export function checkFilm(source: FilmSource): readonly Finding[] {
  const names = Object.keys(source.files);
  if (!names.includes(source.entryFile)) return [{ severity: "error", file: source.entryFile, message: `entryFile "${source.entryFile}" is not among the files supplied: ${names.join(", ") || "none"}.` }];

  const findings: Finding[] = [];
  for (const [file, text] of Object.entries(source.files)) findings.push(...importFindings(file, text), ...habitFindings(file, text));
  if (!/export\s+const\s+films\s*=/.test(source.files[source.entryFile]!)) {
    findings.push({ severity: "error", file: source.entryFile, message: "The entry file must `export const films = [defineFilm({...})]`." });
  }

  const root = resolutionRoot();
  const virtualDirectory = path.join(root, ".zxn-film-check");
  const virtual = new Map(Object.entries(source.files).map(([file, text]) => [path.join(virtualDirectory, file), text]));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX, strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"], types: [],
  };
  const host = ts.createCompilerHost(options);
  const original = { fileExists: host.fileExists.bind(host), readFile: host.readFile.bind(host), getSourceFile: host.getSourceFile.bind(host) };
  host.fileExists = (file) => virtual.has(file) || original.fileExists(file);
  host.readFile = (file) => virtual.get(file) ?? original.readFile(file);
  host.getSourceFile = (file, languageVersion, ...rest) => virtual.has(file)
    ? ts.createSourceFile(file, virtual.get(file)!, languageVersion, true)
    : original.getSourceFile(file, languageVersion, ...rest);
  host.getCurrentDirectory = () => root;

  const program = ts.createProgram([...virtual.keys()], options, host);
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    const file = diagnostic.file ? path.relative(virtualDirectory, diagnostic.file.fileName) : source.entryFile;
    // Only what the agent wrote is its business; a library's own declarations are not.
    if (diagnostic.file && !virtual.has(diagnostic.file.fileName)) continue;
    const line = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : undefined;
    findings.push({ severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning", file, ...(line === undefined ? {} : { line }), message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n") });
  }
  return findings;
}

/** Whether the SDK's declarations can be found, so a caller can say why type errors are missing rather than report none. */
export const canTypeCheck = (): boolean => existsSync(path.join(resolutionRoot(), "node_modules/@zxn/motion-core"));
