import { spawn, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Run = Readonly<{ child: ChildProcess; result: Promise<{ code: number | null; log: string }> }>;

const integration = process.env.ZXN_RENDER_INTEGRATION === "1" ? describe.sequential : describe.skip;
integration("built Electron renderer", () => {
  let directory: string;
  let entry: string;
  const active = new Set<ChildProcess>();
  function launch(id: string, output: string, ...options: string[]): Run {
    return spawnRender(process.execPath, [resolve("packages/cli/dist/bin.js"), "render", entry, id, output, ...options]);
  }
  function spawnRender(binary: string, args: string[]): Run {
    const child = spawn(binary, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    active.add(child);
    let log = "";
    const collect = (chunk: Buffer): void => { log = (log + chunk.toString()).slice(-65536); };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    const result = new Promise<{ code: number | null; log: string }>((resolvePromise, reject) => {
      child.once("error", reject);
      child.once("close", code => { active.delete(child); resolvePromise({ code, log }); });
    });
    return { child, result };
  }
  beforeAll(async () => {
    directory = await mkdtemp(resolve(".motion-render-integration-"));
    entry = join(directory, "films.tsx");
    await writeFile(entry, `import { Canvas2D, Footage, defineFilm, useTimeline } from "@matildeene/motion-core";
function Scene() {
  const { frame } = useTimeline();
  return <div style={{ width: "100%", height: "100%", background: "#102030", color: "white" }}>
    <div style={{ position: "absolute", transform: "translateX(" + frame + "px)", fontSize: 24 }}>Frame {frame}</div>
    <svg width="80" height="80"><circle cx="40" cy="40" r="20" fill="red" /></svg>
    <Canvas2D width={60} height={60} draw={ctx => { ctx.fillStyle = "lime"; ctx.fillRect(0, 0, 60, 60); }} />
  </div>;
}
function Clip() { return <Footage asset="source" style={{ width: 320, height: 180 }} />; }
function Broken() { throw new Error("Deliberate integration render failure"); }
const metadata = { width: 320, height: 180, frameRate: 30, defaultProps: {} };
export const films = [
  defineFilm({ ...metadata, id: "scene", title: "Scene", frames: 30, component: Scene }),
  defineFilm({ ...metadata, id: "long", title: "Long", frames: 3000, component: Scene }),
  defineFilm({ ...metadata, id: "clip", title: "Clip", frames: 30, component: Clip }),
  defineFilm({ ...metadata, id: "broken", title: "Broken", frames: 30, component: Broken }),
];`);
  });
  afterAll(async () => {
    for (const child of active) child.kill("SIGTERM");
    await rm(directory, { force: true, recursive: true });
  });

  it("renders exact frames in all three containers, including SVG, text and Canvas2D", async () => {
    for (const [extension, codec] of [["mp4", "avc"], ["mov", "avc"], ["webm", "vp9"]]) {
      const output = join(directory, `scene.${extension}`);
      const result = await launch("scene", output, "--memory-limit", "1024").result;
      expect(result, result.log).toMatchObject({ code: 0 });
      expect(result.log).toContain("ZXN_MEMORY peak=");
      const input = new Input({ source: new BufferSource(await readFile(output)), formats: ALL_FORMATS });
      try {
        const track = await input.getPrimaryVideoTrack();
        expect(track).not.toBeNull();
        expect(await track!.getCodec()).toBe(codec);
        expect(await track!.getDisplayWidth()).toBe(320);
        expect(await track!.getDisplayHeight()).toBe(180);
        expect(await track!.computeDuration()).toBeCloseTo(1, 4);
        expect((await track!.computePacketStats()).packetCount).toBe(30);
      } finally { input.dispose(); }
    }
  }, 60000);

  it("keeps the browser byte-returning renderer working with managed DOM capture", async () => {
    const browserEntry = join(directory, "browser.ts");
    const site = join(directory, "site");
    const output = join(directory, "browser.mp4");
    await writeFile(browserEntry, `import { describeFilm } from "@matildeene/motion-core";
import { renderFilmToMp4 } from "@matildeene/motion-renderer";
import { films } from "./films.tsx";
async function render() {
  const bytes = await renderFilmToMp4({ film: describeFilm(films[0]) });
  const response = await fetch("/__chunk?position=0", { method: "POST", body: bytes });
  if (!response.ok) throw new Error(await response.text());
  await fetch("/__complete", { method: "POST" });
}
render().catch(error => fetch("/__error", { method: "POST", body: String(error) }));`);
    await build({
      root: directory, configFile: false, publicDir: false, logLevel: "silent",
      resolve: { alias: {
        "@matildeene/motion-core": fileURLToPath(import.meta.resolve("@matildeene/motion-core")),
        "@matildeene/motion-renderer": fileURLToPath(import.meta.resolve("@matildeene/motion-renderer")),
      } },
      build: { outDir: site, rollupOptions: { input: browserEntry, output: { entryFileNames: "browser.js" } } },
    });
    await writeFile(join(site, "index.html"), '<!doctype html><script type="module" src="/browser.js"></script>');
    const binary = createRequire(import.meta.url)("electron") as unknown;
    if (typeof binary !== "string") throw new Error("Electron executable is unavailable");
    const result = await spawnRender(binary, [resolve("packages/cli/dist/runner"), site, output, "create", "1024"]).result;
    expect(result, result.log).toMatchObject({ code: 0 });
    expect((await readFile(output)).byteLength).toBeGreaterThan(1000);
  }, 60000);

  it("decodes supplied footage and streams a complete output", async () => {
    const result = await launch("clip", join(directory, "clip.mp4"), "--footage", `source=${join(directory, "scene.mp4")}`, "--memory-limit", "1024").result;
    expect(result, result.log).toMatchObject({ code: 0 });
    expect(result.log).toContain("ZXN_PROGRESS 30/30");
  }, 60000);

  it("fails safely at the memory ceiling without replacing an existing output", async () => {
    const output = join(directory, "limited.mp4");
    await writeFile(output, "previous");
    const result = await launch("long", output, "--force", "--memory-limit", "128").result;
    expect(result, result.log).toMatchObject({ code: 1 });
    expect(result.log).toContain("memory limit");
    expect(await readFile(output, "utf8")).toBe("previous");
    expect((await readdir(directory)).filter(name => name.includes(".part-"))).toEqual([]);
  }, 60000);

  it("rejects overlapping renders and cleans up when the caller cancels", async () => {
    const first = launch("long", join(directory, "cancelled.mp4"), "--memory-limit", "1024");
    await new Promise<void>((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error("Renderer did not start")), 15000);
      first.child.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("ZXN_PROGRESS")) { clearTimeout(timer); resolvePromise(); }
      });
      first.child.once("exit", () => { clearTimeout(timer); reject(new Error("Renderer exited before cancellation test")); });
    });
    const second = await launch("scene", join(directory, "overlap.mp4"), "--memory-limit", "1024").result;
    expect(second, second.log).toMatchObject({ code: 1 });
    expect(second.log).toContain("Another ZXN Motion render");
    first.child.kill("SIGTERM");
    const cancelled = await first.result;
    expect(cancelled, cancelled.log).toMatchObject({ code: 1 });
    expect(cancelled.log).toContain("cancelled");
    expect((await readdir(directory)).filter(name => name.includes(".part-"))).toEqual([]);
  }, 60000);

  it("stops an orphaned renderer when its CLI parent disappears", async () => {
    const run = launch("long", join(directory, "orphan.mp4"), "--memory-limit", "1024");
    await new Promise<void>((resolvePromise, reject) => {
      const timer = setTimeout(() => reject(new Error("Renderer did not start")), 15000);
      run.child.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("ZXN_PROGRESS")) { clearTimeout(timer); resolvePromise(); }
      });
      run.child.once("exit", () => { clearTimeout(timer); reject(new Error("Renderer exited before orphan test")); });
    });
    run.child.kill("SIGKILL");
    const result = await run.result;
    expect(result.log).toContain("Render parent stopped.");
    expect((await readdir(directory)).filter(name => name.includes(".part-"))).toEqual([]);
  }, 60000);

  it("reports a film failure and discards the incomplete output", async () => {
    const result = await launch("broken", join(directory, "broken.mp4"), "--memory-limit", "1024").result;
    expect(result, result.log).toMatchObject({ code: 1 });
    expect(result.log).toContain("Deliberate integration render failure");
    expect((await readdir(directory)).filter(name => name.includes(".part-"))).toEqual([]);
  }, 60000);
});
