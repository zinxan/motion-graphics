import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { installNativeCapture } from "./native-capture.js";

const { handle, removeHandler } = vi.hoisted(() => ({ handle: vi.fn(), removeHandler: vi.fn() }));
vi.mock("electron", () => ({
  ipcMain: { handle, removeHandler },
  nativeImage: { createFromBuffer: () => ({ toBitmap: () => Uint8Array.of(0, 0, 255, 255) }) },
}));

describe("native capture boundary", () => {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>();
  const image = { isEmpty: vi.fn(() => false), resize: vi.fn(), toBitmap: vi.fn(() => new Uint8Array(4)) };
  const webContents = { mainFrame: {}, setZoomFactor: vi.fn(), capturePage: vi.fn(async () => image) };
  const window = { webContents, setContentSize: vi.fn(), once: vi.fn() };
  const event = { sender: webContents, senderFrame: webContents.mainFrame } as unknown as IpcMainInvokeEvent;
  const invoke = (name: string, ...args: unknown[]): unknown => handlers.get(name)!(event, ...args);
  beforeEach(() => {
    vi.clearAllMocks();
    handlers.clear();
    handle.mockImplementation((name: string, callback: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => handlers.set(name, callback));
    image.isEmpty.mockReturnValue(false);
    image.resize.mockReturnValue(image);
    webContents.capturePage.mockResolvedValue(image);
    installNativeCapture(window as unknown as BrowserWindow);
  });

  it("captures exact film dimensions while keeping the window hidden", async () => {
    invoke("zxn:prepare", 1, 1);
    expect(window.setContentSize).toHaveBeenCalledWith(1, 1);
    expect(await invoke("zxn:capture")).toEqual(new Uint8Array(4));
    expect(webContents.capturePage).toHaveBeenCalledWith({ x: 0, y: 0, width: 1, height: 1 }, { stayHidden: true });
    expect(image.resize).toHaveBeenCalledWith({ width: 1, height: 1, quality: "best" });
  });

  it("rejects other frames and windows", () => {
    expect(() => handlers.get("zxn:prepare")!({ ...event, senderFrame: {} } as IpcMainInvokeEvent, 320, 180)).toThrow("restricted");
    expect(() => handlers.get("zxn:prepare")!({ ...event, sender: {} } as IpcMainInvokeEvent, 320, 180)).toThrow("restricted");
  });

  it.each([[0, 100], [100, -1], [Infinity, 100], [100.5, 200], [8192, 8192]])("rejects unsafe dimensions %s × %s", (width, height) => {
    expect(() => invoke("zxn:prepare", width, height)).toThrow("dimensions");
  });

  it("rejects captures before preparation and empty compositor output", async () => {
    await expect(invoke("zxn:capture")).rejects.toThrow("prepared");
    invoke("zxn:prepare", 1, 1);
    image.isEmpty.mockReturnValue(true);
    await expect(invoke("zxn:capture")).rejects.toThrow("empty");
  });

  it("allows only one outstanding frame and recovers after capture failure", async () => {
    invoke("zxn:prepare", 1, 1);
    let reject!: (error: Error) => void;
    webContents.capturePage.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
    const first = invoke("zxn:capture");
    await expect(invoke("zxn:capture")).rejects.toThrow("sequential");
    reject(new Error("capture failed"));
    await expect(first).rejects.toThrow("capture failed");
    expect(await invoke("zxn:capture")).toEqual(new Uint8Array(4));
  });

  it("removes IPC handlers when the render window closes", () => {
    const closed = window.once.mock.calls[0]?.[1] as () => void;
    closed();
    expect(removeHandler.mock.calls).toEqual([["zxn:prepare"], ["zxn:capture"]]);
  });
});
