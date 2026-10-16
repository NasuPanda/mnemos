import { MAX_IMAGE_BYTES, ok, refuse, type Result } from "@/core";

/** The longest edge an image is stored at. */
export const MAX_EDGE = 1_600;

export type PreparedImage = { blob: Blob; key: string };
export type PrepareProblem = "unreadable" | "too-large";

/** The size to draw at: the longest edge at most `max`, never enlarged, proportions kept. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_EDGE,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The stored name: the content's SHA-256 in hex, then ".webp" or ".jpg". */
export function imageKey(hash: ArrayBuffer, type: string): string {
  const hex = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex}.${type === "image/webp" ? "webp" : "jpg"}`;
}

/**
 * Shrinks a photo or screenshot in the browser, so the Worker only ever stores and serves small
 * files: at most 1,600 px on the longest edge, as WebP, or JPEG where the browser can't make
 * WebP (Safari). Named by its SHA-256, so the same image is never stored twice.
 */
export async function prepareImage(file: Blob): Promise<Result<PreparedImage, PrepareProblem>> {
  const source = await decode(file);
  if (!source) return refuse("unreadable");

  const size = fitWithin(source.width, source.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return refuse("unreadable");
  context.drawImage(source.image, 0, 0, size.width, size.height);
  source.close();

  let blob = await encode(canvas, "image/webp", 0.82);
  if (!blob || blob.type !== "image/webp") {
    // JPEG has no transparency: draw transparent parts on white, as images are shown.
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = "white";
    context.fillRect(0, 0, size.width, size.height);
    blob = await encode(canvas, "image/jpeg", 0.85);
  }
  if (blob && blob.size > MAX_IMAGE_BYTES) blob = await encode(canvas, blob.type, 0.6);
  if (!blob) return refuse("unreadable");
  if (blob.size > MAX_IMAGE_BYTES) return refuse("too-large");

  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return ok({ blob, key: imageKey(hash, blob.type) });
}

type Decoded = {
  image: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

/** Reads the file, turned the way the camera held it (EXIF orientation). */
async function decode(file: Blob): Promise<Decoded | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  } catch {
    // Some browsers decode more formats through an <img> than through createImageBitmap.
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return {
        image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        close: () => URL.revokeObjectURL(url),
      };
    } catch {
      URL.revokeObjectURL(url);
      return null;
    }
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
