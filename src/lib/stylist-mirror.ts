import { cookies } from "next/headers";
import { gunzipSync, gzipSync } from "zlib";
import { compactStylistResponse, parseStylistResponse, type StylistResponseV1 } from "./stylist-contract";

export const STYLIST_READY_COOKIE = "atelier.stylist.ready.v1";
const COOKIE_BUDGET = 3500;

function encodeCookie(response: StylistResponseV1): string | null {
  const compact = compactStylistResponse(response);
  const raw = JSON.stringify(compact);
  if (raw.length <= COOKIE_BUDGET) return raw;
  const gz = `gz:${gzipSync(raw).toString("base64")}`;
  // Never put a multi‑KB board into a cookie — it poisons later requests (431 / silent failures).
  if (gz.length > COOKIE_BUDGET) return null;
  return gz;
}

function decodeCookie(raw: string): unknown {
  if (raw.startsWith("gz:")) {
    return JSON.parse(gunzipSync(Buffer.from(raw.slice(3), "base64")).toString("utf8"));
  }
  return JSON.parse(raw);
}

export async function readReadyCookie(): Promise<StylistResponseV1 | null> {
  const jar = await cookies();
  const raw = jar.get(STYLIST_READY_COOKIE)?.value;
  if (!raw) return null;
  try {
    return parseStylistResponse(decodeCookie(decodeURIComponent(raw)));
  } catch {
    try {
      return parseStylistResponse(decodeCookie(raw));
    } catch {
      return null;
    }
  }
}

export async function writeReadyCookie(response: StylistResponseV1) {
  try {
    const encoded = encodeCookie(response);
    const jar = await cookies();
    if (!encoded) {
      // Drop any prior ready cookie so a huge board cannot stick around.
      try {
        jar.delete(STYLIST_READY_COOKIE);
      } catch {
        /* read-only context */
      }
      return;
    }
    jar.set(STYLIST_READY_COOKIE, encoded, {
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: Boolean(process.env.VERCEL),
      maxAge: 60 * 60 * 24 * 30,
    });
  } catch {
    /* cookie budget or read-only context */
  }
}

export async function clearReadyCookie() {
  try {
    const jar = await cookies();
    jar.delete(STYLIST_READY_COOKIE);
  } catch {
    /* read-only context */
  }
}
