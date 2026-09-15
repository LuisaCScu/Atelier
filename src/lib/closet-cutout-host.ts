import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import type { StylistClosetPieceV1 } from "./stylist-contract";
import { redisCommand, redisConfigured } from "./stylist-inbox";

const CUTOUT_NAMESPACE = "atelier:cutout:v1";
const CUTOUT_TTL_SECONDS = 60 * 60 * 24 * 90;
const MAX_EDGE = 900;
const MAX_BYTES = 450_000;

export type HostedCutout = {
  id: string;
  contentType: string;
  bytes: Buffer;
};

function fsDir() {
  if (process.env.STYLIST_DATA_DIR) return path.join(process.env.STYLIST_DATA_DIR, "cutouts");
  if (process.env.VERCEL) return "/tmp/atelier-cutouts";
  return path.join(process.cwd(), ".data/cutouts");
}

function fileFor(id: string) {
  return path.join(fsDir(), `${id}.webp`);
}

function redisKey(id: string) {
  return `${CUTOUT_NAMESPACE}:${id}`;
}

function safeCutoutId(pieceId: string, hash: string): string {
  const piece = pieceId.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 48) || "piece";
  return `cut_${piece}_${hash.slice(0, 10)}`;
}

function parseDataUrl(raw: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;,]+)?(;base64)?,([\s\S]+)$/i.exec(raw.trim());
  if (!m) return null;
  const mime = (m[1] || "image/png").toLowerCase();
  const isB64 = Boolean(m[2]);
  try {
    const buffer = Buffer.from(m[3], isB64 ? "base64" : "utf8");
    if (!buffer.length || buffer.length > 8_000_000) return null;
    return { mime, buffer };
  } catch {
    return null;
  }
}

async function compress(buffer: Buffer): Promise<{ contentType: string; bytes: Buffer }> {
  const bytes = await sharp(buffer)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72, effort: 4 })
    .toBuffer();
  if (bytes.length > MAX_BYTES) {
    const tighter = await sharp(buffer)
      .rotate()
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 58, effort: 4 })
      .toBuffer();
    return { contentType: "image/webp", bytes: tighter };
  }
  return { contentType: "image/webp", bytes };
}

async function writeCutout(id: string, contentType: string, bytes: Buffer) {
  await mkdir(fsDir(), { recursive: true });
  await writeFile(fileFor(id), bytes);
  if (redisConfigured()) {
    const payload = JSON.stringify({
      id,
      contentType,
      b64: bytes.toString("base64"),
      updatedAt: new Date().toISOString(),
    });
    // Soft-fail Redis if payload too large for plan — FS still works on single instance.
    if (payload.length < 900_000) {
      await redisCommand(["SET", redisKey(id), payload, "EX", CUTOUT_TTL_SECONDS]);
    }
  }
  // Best-effort lasting static mirrors (parent may redeploy assets).
  for (const dir of [
    path.join(process.cwd(), "public/cutouts"),
    "/workspace/atelier-assets-static/cutouts",
  ]) {
    try {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${id}.webp`), bytes);
    } catch {
      /* optional */
    }
  }
}

export async function readHostedCutout(id: string): Promise<HostedCutout | null> {
  const safe = id.replace(/[^A-Za-z0-9._-]+/g, "").slice(0, 96);
  if (!safe || safe !== id) return null;
  if (redisConfigured()) {
    const raw = await redisCommand<string>(["GET", redisKey(safe)]);
    if (raw && typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw) as { contentType?: string; b64?: string };
        if (parsed.b64) {
          return {
            id: safe,
            contentType: parsed.contentType || "image/webp",
            bytes: Buffer.from(parsed.b64, "base64"),
          };
        }
      } catch {
        /* fall through */
      }
    }
  }
  try {
    const bytes = await readFile(fileFor(safe));
    return { id: safe, contentType: "image/webp", bytes };
  } catch {
    return null;
  }
}

/**
 * Decode data:image closet tiles → lasting https on this host.
 * Keeps existing https URLs. Soft-fails per piece (omits image) rather than sending megabase64 to Stylist.
 */
export async function hostClosetImagesForStylist(
  closet: StylistClosetPieceV1[] | undefined,
  hostBase: string
): Promise<StylistClosetPieceV1[] | undefined> {
  if (!closet?.length) return closet;
  const base = hostBase.replace(/\/$/, "");
  const out: StylistClosetPieceV1[] = [];
  for (const piece of closet) {
    const image = piece.image?.trim();
    if (!image) {
      out.push(piece);
      continue;
    }
    if (/^https:\/\//i.test(image)) {
      out.push(piece);
      continue;
    }
    if (!image.startsWith("data:image")) {
      // Reject http / blob / unknown — never forward to Stylist.
      const { image: _drop, ...rest } = piece;
      out.push(rest);
      continue;
    }
    try {
      const parsed = parseDataUrl(image);
      if (!parsed) {
        const { image: _drop, ...rest } = piece;
        out.push(rest);
        continue;
      }
      const hash = createHash("sha256").update(parsed.buffer).digest("hex");
      const id = safeCutoutId(piece.id, hash);
      const existing = await readHostedCutout(id);
      if (!existing) {
        const compressed = await compress(parsed.buffer);
        await writeCutout(id, compressed.contentType, compressed.bytes);
      }
      out.push({ ...piece, image: `${base}/api/closet/cutout/${id}` });
    } catch {
      const { image: _drop, ...rest } = piece;
      out.push(rest);
    }
  }
  return out;
}

export function isHttpsImageUrl(url: string | undefined): boolean {
  return Boolean(url && /^https:\/\//i.test(url.trim()));
}
