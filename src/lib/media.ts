import { MEDIA_KEY } from "./types";

export const FACE_SLOT = "face";

export type MediaMap = Record<string, string>;

export function loadMedia(): MediaMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MEDIA_KEY) || "{}") as MediaMap;
    if (!parsed || typeof parsed !== "object") return {};
    const face = parsed[FACE_SLOT];
    return face ? { [FACE_SLOT]: face } : {};
  } catch {
    return {};
  }
}

export function saveMedia(photos: MediaMap) {
  if (typeof window === "undefined") return;
  const next: MediaMap = {};
  if (photos[FACE_SLOT]) next[FACE_SLOT] = photos[FACE_SLOT];
  window.localStorage.setItem(MEDIA_KEY, JSON.stringify(next));
}

export function loadFacePhoto(): string {
  return loadMedia()[FACE_SLOT] ?? "";
}

export function saveFacePhoto(dataUrl: string) {
  const current = loadMedia();
  if (dataUrl) current[FACE_SLOT] = dataUrl;
  else delete current[FACE_SLOT];
  saveMedia(current);
}
