import { ipcMain, nativeImage, type BrowserWindow, type IpcMainInvokeEvent } from "electron";
import { identifyPixelOrder, normalizeBitmap } from "./bitmap.js";

/** Capture Chromium's composed page without creating an SVG document per frame. */
export function installNativeCapture(window: BrowserWindow): void {
  const redPixel = nativeImage.createFromBuffer(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64"));
  const pixelOrder = identifyPixelOrder(redPixel.toBitmap());
  let size: Readonly<{ width: number; height: number }> | undefined;
  let capturing = false;
  const authorize = (event: IpcMainInvokeEvent): void => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error("Capture is restricted to the render page.");
    }
  };
  ipcMain.handle("zxn:prepare", (event, width: unknown, height: unknown) => {
    authorize(event);
    if (size) throw new Error("Capture is already prepared.");
    if (typeof width !== "number" || typeof height !== "number" || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
      || width < 1 || height < 1 || width * height > 33_554_432) {
      throw new Error("Invalid capture dimensions (maximum 32 megapixels).");
    }
    size = { width, height };
    window.setContentSize(width, height);
    window.webContents.setZoomFactor(1);
  });
  ipcMain.handle("zxn:capture", async (event) => {
    authorize(event);
    if (!size) throw new Error("Capture is not prepared.");
    if (capturing) throw new Error("Frame captures must be sequential.");
    capturing = true;
    try {
      const image = await window.webContents.capturePage({ x: 0, y: 0, ...size }, { stayHidden: true });
      if (image.isEmpty()) throw new Error("The compositor returned an empty frame.");
      const bitmap = image.resize({ ...size, quality: "best" }).toBitmap({ scaleFactor: 1 });
      if (bitmap.byteLength !== size.width * size.height * 4) throw new Error("Unexpected capture bitmap dimensions.");
      return normalizeBitmap(bitmap, pixelOrder);
    } finally {
      capturing = false;
    }
  });
  window.once("closed", () => {
    ipcMain.removeHandler("zxn:prepare");
    ipcMain.removeHandler("zxn:capture");
  });
}
