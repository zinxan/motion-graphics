import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

/*
 * Checks a film's source the way the SDK will meet it: type errors against the
 * real `@matildeene/motion-core` declarations, imports a film is not allowed, and the
 * handful of habits that make a film slow or unrepeatable.
 *
 * Nothing is executed. An agent can call this as often as it likes on source
 * it has just written, and what comes back is what a compile would have said.
 */

export type Finding = Readonly<{ severity: "error" | "warning"; file: string; line?: number; message: string }>;
export type FilmSource = Readonly<{ entryFile: string; files: Readonly<Record<string, string>> }>;

/** What a film may import: React, the SDK, and the seekable, deterministic libraries ZXN Studio bundles. */
export const allowedPackages = [
  "react", "react/jsx-runtime", "@matildeene/motion-core", "@matildeene/motion-graphics", "@matildeene/motion-text", "@zxn/ui",
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

/**
 * The source with comments blanked out, line for line. The habits are found by
 * pattern, and a comment that says "never call Date.now()" is not a call to it.
 */
const withoutComments = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, " "));

function habitFindings(file: string, source: string): Finding[] {
  const text = withoutComments(source);
  const findings: Finding[] = [];
  for (const { pattern, message } of habits) {
    for (const match of text.matchAll(pattern)) findings.push({ severity: "warning", file, line: lineOf(text, match.index), message });
  }
  // Blur inside a loop is the single most common way to make a film crawl.
  // Either way of making a list: `.map(` over an array, or `Array.from({ length }, callback)`.
  const looped = /(?:\.map\(|Array\.from\(\s*\{[^}]*\}\s*,)[\s\S]{0,1200}?(textShadow|boxShadow|filter:\s*["'`]blur|backdropFilter)/.exec(text);
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

/**
 * A directory whose node_modules can resolve the SDK, so types come from the
 * real declarations: beside this server first, then wherever it was started.
 * Nothing, if neither has the SDK -- guessing a root only produces a page of
 * "cannot find module" errors that say nothing about the film.
 */
function resolutionRoot(): string | undefined {
  const require = createRequire(import.meta.url);
  try {
    const core = require.resolve("@matildeene/motion-core/package.json");
    return path.resolve(path.dirname(core), "../../..");
  } catch {
    return existsSync(path.join(process.cwd(), "node_modules/@matildeene/motion-core")) ? process.cwd() : undefined;
  }
}

const workspacePackages = { "@matildeene/motion-core": "core", "@matildeene/motion-graphics": "graphics", "@matildeene/motion-text": "text" } as const;

function workspaceSources(root: string): Pick<ts.CompilerOptions, "paths"> {
  // Absolute targets, so no `baseUrl` is needed (TypeScript 6 deprecates it).
  const paths = Object.fromEntries(Object.entries(workspacePackages)
    .map(([name, directory]) => [name, path.join(root, "packages", directory, "src/index.ts")] as const)
    .filter(([, file]) => existsSync(file))
    .map(([name, file]) => [name, [file]]));
  return Object.keys(paths).length > 0 ? { paths } : {};
}

/** Props with no control can only be changed by editing code, which is exactly what a control is for. */
function controlFindings(file: string, text: string): Finding[] {
  const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ES2023, true, ts.ScriptKind.TSX);
  const findings: Finding[] = [];
  const keysOf = (node: ts.Expression | undefined): string[] | undefined => node && ts.isObjectLiteralExpression(node)
    ? node.properties.flatMap((property) => property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? [property.name.text] : [])
    : undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "defineFilm" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
      const field = (name: string) => (node.arguments[0] as ts.ObjectLiteralExpression).properties
        .find((property): property is ts.PropertyAssignment => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === name)?.initializer;
      const props = keysOf(field("defaultProps"));
      const controls = keysOf(field("controls")) ?? [];
      const missing = (props ?? []).filter((name) => !controls.includes(name));
      if (missing.length > 0) findings.push({ severity: "warning", file, line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        message: `No control for ${missing.map((name) => `"${name}"`).join(", ")}. Give every prop a control (text, number, color, boolean or choice) so it can be changed without opening the code.` });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return findings;
}

export function checkFilm(source: FilmSource): readonly Finding[] {
  const names = Object.keys(source.files);
  if (!names.includes(source.entryFile)) return [{ severity: "error", file: source.entryFile, message: `entryFile "${source.entryFile}" is not among the files supplied: ${names.join(", ") || "none"}.` }];

  const findings: Finding[] = [];
  for (const [file, text] of Object.entries(source.files)) findings.push(...importFindings(file, text), ...habitFindings(file, text), ...controlFindings(file, text));
  if (!/export\s+const\s+films\s*=/.test(source.files[source.entryFile]!)) {
    findings.push({ severity: "error", file: source.entryFile, message: "The entry file must `export const films = [defineFilm({...})]`." });
  }

  const root = resolutionRoot();
  // Without the SDK's declarations there is nothing to check types against; `canTypeCheck` lets the caller say so.
  if (!root) return findings;
  const virtualDirectory = path.join(root, ".zxn-film-check");
  const virtual = new Map(Object.entries(source.files).map(([file, text]) => [path.join(virtualDirectory, file), text]));
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX, strict: true, noEmit: true, skipLibCheck: true, esModuleInterop: true,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"], types: [],
    // In this repository the packages may not be built yet (a fresh clone, CI before its build step);
    // their source says the same thing their declarations will.
    ...workspaceSources(root),
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
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    // A package a film may import, whose types simply are not installed here: not the film's mistake.
    const unresolved = /Cannot find module '([^']+)'/.exec(message)?.[1];
    if (unresolved && isAllowed(unresolved) && !unresolved.startsWith(".")) {
      findings.push({ severity: "warning", file, ...(line === undefined ? {} : { line }), message: `"${unresolved}" may be imported by a film, but it is not installed beside this checker, so nothing that uses it could be type-checked.` });
      continue;
    }
    findings.push({ severity: diagnostic.category === ts.DiagnosticCategory.Error ? "error" : "warning", file, ...(line === undefined ? {} : { line }), message });
  }
  return findings;
}

/** Whether the SDK's declarations can be found, so a caller can say why type errors are missing rather than report none. */
export const canTypeCheck = (): boolean => resolutionRoot() !== undefined;
