import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("zxnCapture", {
  prepare: (width: number, height: number): Promise<void> => ipcRenderer.invoke("zxn:prepare", width, height) as Promise<void>,
  frame: (): Promise<Uint8Array> => ipcRenderer.invoke("zxn:capture") as Promise<Uint8Array>,
});
