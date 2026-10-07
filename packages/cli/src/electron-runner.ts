import { createReadStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { RenderOutput } from "./render-output.js";
import { fileURLToPath } from "node:url";
import { installNativeCapture } from "./native-capture.js";
import { app, BrowserWindow } from "electron";

console.info("ZXN Motion render host starting.");
const [siteArgument, outputArgument, writeMode, memoryArgument] = process.argv.slice(-4);
const memoryLimitMiB = Number(memoryArgument);
if (!siteArgument || !outputArgument || !["create", "replace"].includes(writeMode ?? "") || !Number.isSafeInteger(memoryLimitMiB) || memoryLimitMiB < 128) {
  throw new Error("Render runner arguments are missing or invalid.");
}
const siteRoot = resolve(siteArgument);
const outputPath = resolve(outputArgument);
const output = new RenderOutput(outputPath, writeMode === "replace");
app.setPath("userData", resolve(app.getPath("appData"), "ZXN Motion CLI"));
if (!app.requestSingleInstanceLock()) {
  console.error("Another ZXN Motion render is running. Wait for it to finish before starting another.");
  app.exit(1);
}

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
    request.on("data", (chunk: string) => {
      body += chunk;
      if (body.length > 65536) request.destroy(new Error("Error report exceeds its limit."));
    });
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
  let finished = false;
  let peakMiB = 0;
  let window: BrowserWindow | undefined;
  const finish = async (code: number, message?: string): Promise<void> => {
    if (finished) return;
    finished = true;
    if (message) console.error(message);
    console.info(`ZXN_MEMORY peak=${Math.ceil(peakMiB)}MiB limit=${memoryLimitMiB}MiB`);
    window?.destroy();
    server.close();
    server.closeAllConnections();
    await output.discard().catch((error: unknown) => console.error(error));
    app.exit(code);
  };
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (finished) { send(response, 503); return; }
      if (request.method === "POST" && url.pathname === "/__chunk") {
        const position = url.searchParams.get("position");
        if (position === null || !/^[0-9]+$/.test(position)) throw new Error("Invalid output position.");
        await output.write(Number(position), request);
        send(response, 204);
        return;
      }
      if (request.method === "POST" && url.pathname === "/__complete") {
        await output.complete();
        send(response, 204);
        console.info(`Wrote ${outputPath}`);
        response.once("finish", () => { void finish(0); });
        return;
      }
      if (request.method === "POST" && url.pathname === "/__error") {
        const message = await readBody(request);
        send(response, 204);
        response.once("finish", () => { void finish(1, message); });
        return;
      }
      await serveStatic(url.pathname, response);
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      send(response, 500, message);
      console.error(message);
      void finish(1);
    });
  });

  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Could not start the render server.");
    window = new BrowserWindow({
      show: false,
      backgroundColor: "#000000",
      width: 960,
      height: 640,
      webPreferences: {
        preload: fileURLToPath(new URL("./capture-preload.cjs", import.meta.url)),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    installNativeCapture(window);
    window.webContents.on("console-message", (details) => {
      if (details.message.startsWith("ZXN_PROGRESS")) console.info(details.message);
    });
    window.webContents.on("render-process-gone", (_event, details) => {
      console.error(`Render process stopped: ${details.reason}`);
      void finish(1);
    });
    void window.loadURL(`http://127.0.0.1:${address.port}/`).catch((error: unknown) => {
      console.error(error);
      void finish(1);
    });
  });

  process.once("SIGTERM", () => { void finish(1, "Render cancelled."); });
  process.once("SIGINT", () => { void finish(1, "Render cancelled."); });
  const parentPid = process.ppid;
  setInterval(() => {
    if (finished) return;
    const metrics = app.getAppMetrics();
    const usedMiB = metrics.reduce((total, metric) => total + metric.memory.workingSetSize / 1024, 0);
    peakMiB = Math.max(peakMiB, usedMiB);
    if (usedMiB > memoryLimitMiB) {
      console.error(metrics.map(metric => `${metric.type}=${Math.ceil(metric.memory.workingSetSize / 1024)}MiB`).join(" "));
      void finish(1, `Render exceeded its ${memoryLimitMiB} MiB memory limit (${Math.ceil(usedMiB)} MiB).`);
    } else if (process.ppid !== parentPid) {
      void finish(1, "Render parent stopped.");
    }
  }, 250).unref();
  setTimeout(() => { void finish(1, "Render timed out after 30 minutes."); }, 30 * 60 * 1000).unref();
}

app.on("window-all-closed", () => { /* finish owns the exit status and output cleanup. */ });

app.whenReady().then(start).catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});
