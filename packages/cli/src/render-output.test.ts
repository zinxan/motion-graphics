import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { maxChunkBytes, RenderOutput } from "./render-output.js";

async function* bytes(...values: number[]): AsyncIterable<Uint8Array> {
  yield Uint8Array.from(values);
}

describe("render output", () => {
  let directory: string;
  let path: string;
  let output: RenderOutput;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "motion-output-test-"));
    path = join(directory, "film.mp4");
    output = new RenderOutput(path, true);
  });
  afterEach(async () => {
    await output.discard();
    await rm(directory, { recursive: true, force: true });
  });

  it("supports header rewrites and keeps the previous output until completion", async () => {
    await writeFile(path, "previous");
    await output.write(0, bytes(0, 0, 3, 4));
    await output.write(0, bytes(1, 2));
    expect(await readFile(path, "utf8")).toBe("previous");
    await output.complete();
    expect([...await readFile(path)]).toEqual([1, 2, 3, 4]);
  });

  it("preserves previous output when cancelled", async () => {
    await writeFile(path, "previous");
    await output.write(0, bytes(1, 2));
    await output.discard();
    expect(await readFile(path, "utf8")).toBe("previous");
    await expect(stat(`${path}.part-${process.pid}`)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("refuses overlapping writes", async () => {
    let release!: () => void;
    async function* slow(): AsyncIterable<Uint8Array> {
      await new Promise<void>((resolve) => { release = resolve; });
      yield Uint8Array.of(1);
    }
    const pending = output.write(0, slow());
    while (!release) await new Promise((resolve) => setTimeout(resolve, 1));
    await expect(output.write(1, bytes(2))).rejects.toThrow("sequential");
    await expect(output.complete()).rejects.toThrow("ready");
    release();
    await pending;
  });

  it("bounds streamed request size", async () => {
    async function* oversized(): AsyncIterable<Uint8Array> {
      yield new Uint8Array(maxChunkBytes);
      yield Uint8Array.of(1);
    }
    await expect(output.write(0, oversized())).rejects.toThrow("limit");
  });

  it.each([-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid position %s", async (position) => {
    await expect(output.write(position, bytes(1))).rejects.toThrow("position");
  });

  it("refuses empty output", async () => {
    await expect(output.complete()).rejects.toThrow("empty");
  });

  it("does not overwrite a file created during a render without --force", async () => {
    output = new RenderOutput(path, false);
    await output.write(0, bytes(1));
    await writeFile(path, "other");
    await expect(output.complete()).rejects.toMatchObject({ code: "EEXIST" });
    expect(await readFile(path, "utf8")).toBe("other");
  });
});
