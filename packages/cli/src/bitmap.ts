export type PixelOrder = "rgba" | "bgra";

/** NativeImage's bitmap layout varies by platform; identify it using an opaque red pixel. */
export function identifyPixelOrder(red: Uint8Array): PixelOrder {
  if (red.length !== 4 || red[1] !== 0 || red[3] !== 255) throw new Error("Unsupported native bitmap layout.");
  if (red[0] === 255 && red[2] === 0) return "rgba";
  if (red[0] === 0 && red[2] === 255) return "bgra";
  throw new Error("Unsupported native bitmap layout.");
}

/** Normalize in place, keeping the frame allocation bounded. */
export function normalizeBitmap(bitmap: Uint8Array, order: PixelOrder): Uint8Array {
  if (bitmap.length % 4 !== 0) throw new Error("Invalid native bitmap length.");
  if (order === "bgra") {
    for (let offset = 0; offset < bitmap.length; offset += 4) {
      const blue = bitmap[offset]!;
      bitmap[offset] = bitmap[offset + 2]!;
      bitmap[offset + 2] = blue;
    }
  }
  return bitmap;
}
