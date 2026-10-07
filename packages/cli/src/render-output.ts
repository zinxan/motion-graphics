import { link, open, rename, rm, type FileHandle } from "node:fs/promises";

export const maxChunkBytes = 2 * 1024 * 1024;

/** A seekable, bounded output that becomes visible only after successful encoding. */
export class RenderOutput {
  private file: FileHandle | undefined;
  private busy = false;
  private completed = false;

  constructor(private readonly path: string, private readonly replace: boolean, private readonly partial = `${path}.part-${process.pid}`) {}

  async write(position: number, chunks: AsyncIterable<Uint8Array>): Promise<void> {
    if (!Number.isSafeInteger(position) || position < 0) throw new Error("Invalid output position.");
    if (this.busy || this.completed) throw new Error("Output writes must be sequential.");
    this.busy = true;
    try {
      this.file ??= await open(this.partial, "wx");
      let size = 0;
      for await (const chunk of chunks) {
        size += chunk.byteLength;
        if (size > maxChunkBytes || !Number.isSafeInteger(position + size)) throw new Error("Output chunk exceeds its limit.");
        let offset = 0;
        while (offset < chunk.byteLength) {
          const { bytesWritten } = await this.file.write(chunk, offset, chunk.byteLength - offset, position);
          if (bytesWritten === 0) throw new Error("Could not write render output.");
          offset += bytesWritten;
          position += bytesWritten;
        }
      }
    } finally {
      this.busy = false;
    }
  }

  async complete(): Promise<void> {
    if (this.busy || this.completed) throw new Error("Output is not ready to complete.");
    if (!this.file || (await this.file.stat()).size === 0) throw new Error("The renderer returned an empty output.");
    await this.file.close();
    this.file = undefined;
    if (this.replace) {
      await rename(this.partial, this.path);
    } else {
      await link(this.partial, this.path);
      await rm(this.partial);
    }
    this.completed = true;
  }

  async discard(): Promise<void> {
    await this.file?.close();
    this.file = undefined;
    await rm(this.partial, { force: true });
  }
}
