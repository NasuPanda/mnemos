import { useEffect, useRef, useState } from "react";
import { ApiError, putBlob } from "@/lib/api";
import type { UploadImageResponse } from "../../worker/contract";
import type { EditorImage, ImageSide } from "./form";
import { prepareImage } from "./image-prep";
import { hasKey, roomFor, updateImage } from "./images";

type SetImages = (update: (images: EditorImage[]) => EditorImage[]) => void;

const MESSAGES = {
  unreadable: "That file isn’t an image this browser can read.",
  "too-large": "That image is over 2 MB, even after shrinking.",
  full: "A side holds up to 10 images.",
  duplicate: "That image is already here.",
  limit: "You’ve reached 2,000 images. Remove some from other items first.",
} as const;

/**
 * Adding images: each one is shrunk and named in the browser, then uploaded straight away, so
 * Save only has to wait for what is still on its way. A failed upload can be tried again.
 */
export function useImageUploads(setImages: SetImages, currentImages: () => EditorImage[]) {
  const prepared = useRef(new Map<string, { blob: Blob; key: string }>());
  const urls = useRef(new Set<string>());
  const [problems, setProblems] = useState<Partial<Record<ImageSide, string>>>({});

  useEffect(() => {
    const owned = urls.current;
    return () => owned.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const preview = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return url;
  };
  const forget = (url: string) => {
    if (!urls.current.delete(url)) return;
    URL.revokeObjectURL(url);
  };
  const say = (side: ImageSide, message: string | undefined) =>
    setProblems((current) => ({ ...current, [side]: message }));

  const upload = (id: string, side: ImageSide) => {
    const file = prepared.current.get(id);
    if (!file) return;
    setImages((images) => updateImage(images, id, { status: "uploading" }));
    putBlob<UploadImageResponse>(`/api/images/${file.key}`, file.blob).then(
      () => setImages((images) => updateImage(images, id, { status: "stored" })),
      (error: unknown) => {
        setImages((images) => updateImage(images, id, { status: "failed" }));
        if (error instanceof ApiError && error.code === "images-limit") say(side, MESSAGES.limit);
      },
    );
  };

  /** Adds images to the end of a side, as many as fit. */
  const add = (side: ImageSide, files: readonly File[], current: readonly EditorImage[]) => {
    const images = files.filter((file) => file.type === "" || file.type.startsWith("image/"));
    if (images.length === 0) return say(side, files.length > 0 ? MESSAGES.unreadable : undefined);
    const room = roomFor(current, side, images.length);
    say(side, room < images.length ? MESSAGES.full : undefined);

    for (const file of images.slice(0, room)) {
      const id = crypto.randomUUID();
      const original = preview(file);
      setImages((list) => [...list, { id, side, key: null, src: original, status: "preparing" }]);
      void prepareImage(file).then((result) => {
        if (!result.ok) {
          setImages((list) => list.filter((image) => image.id !== id));
          forget(original);
          return say(side, MESSAGES[result.error]);
        }
        const { blob, key } = result.value;
        if (hasKey(currentImages(), side, key, id)) {
          setImages((list) => list.filter((image) => image.id !== id));
          forget(original);
          return say(side, MESSAGES.duplicate);
        }
        // From here the thumbnail shows the small file; the original can go.
        const src = preview(blob);
        setImages((list) => updateImage(list, id, { key, src }));
        requestAnimationFrame(() => forget(original));
        prepared.current.set(id, { blob, key });
        upload(id, side);
      });
    }
  };

  const retry = (image: EditorImage) => upload(image.id, image.side);

  const remove = (image: EditorImage) => {
    prepared.current.delete(image.id);
    forget(image.src);
    setImages((list) => list.filter((i) => i.id !== image.id));
    say(image.side, undefined);
  };

  return { add, retry, remove, problems };
}
