import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { app, BrowserWindow } from "electron";

console.info("ZXN Motion render host starting.");
const [siteArgument, outputArgument, writeMode] = process.argv.slice(-3);
if (!siteArgument || !outputArgument || !["create", "replace"].includes(writeMode ?? "")) {
  throw new Error("Render runner arguments are missing or invalid.");
}
const siteRoot = resolve(siteArgument);
const outputPath = resolve(outputArgument);
const partialPath = `${outputPath}.part-${process.pid}`;

const contentTypes: Readonly<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => { body += chunk; });
    request.once("end", () => resolvePromise(body));
    request.once("error", reject);
  });
}

function send(response: ServerResponse, status: number, body = ""): void {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = resolve(siteRoot, relativePath);
  if (filePath !== siteRoot && !filePath.startsWith(`${siteRoot}${sep}`)) {
    send(response, 403, "Forbidden");
    return;
  }
  const file = await stat(filePath).catch(() => undefined);
  if (!file?.isFile()) {
    send(response, 404, "Not found");
    return;
  }
  response.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] ?? "application/octet-stream" });
  createReadStream(filePath).pipe(response);
}

async function start(): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method === "POST" && url.pathname === "/__result") {
        await pipeline(request, createWriteStream(partialPath, { flags: "wx" }));
        const partial = await stat(partialPath);
        if (partial.size === 0) throw new Error("The renderer returned an empty output.");
        await rename(partialPath, outputPath);
        send(response, 204);
        console.info(`Wrote ${outputPath}`);
        server.close(() => app.exit(0));
        return;
      }
      if (request.method === "POST" && url.pathname === "/__error") {
        const message = await readBody(request);
        send(response, 204);
        console.error(message);
        await rm(partialPath, { force: true });
        server.close(() => app.exit(1));
        return;
      }
      await serveStatic(url.pathname, response);
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      send(response, 500, message);
      console.error(message);
      void rm(partialPath, { force: true }).finally(() => server.close(() => app.exit(1)));
    });
  });

  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not start the render server.");
    const window = new BrowserWindow({
      show: false,
      width: 960,
      height: 640,
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    window.webContents.on("console-message", (details) => {
      if (details.message.startsWith("ZXN_PROGRESS")) console.info(details.message);
    });
    window.webContents.on("render-process-gone", (_event, details) => {
      console.error(`Render process stopped: ${details.reason}`);
      void rm(partialPath, { force: true }).finally(() => server.close(() => app.exit(1)));
    });
    void window.loadURL(`http://127.0.0.1:${address.port}/`).catch((error: unknown) => {
      console.error(error);
      server.close(() => app.exit(1));
    });
  });

  setTimeout(() => {
    console.error("Render timed out after 30 minutes.");
    void rm(partialPath, { force: true }).finally(() => server.close(() => app.exit(1)));
  }, 30 * 60 * 1000).unref();
}

app.whenReady().then(start).catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});
