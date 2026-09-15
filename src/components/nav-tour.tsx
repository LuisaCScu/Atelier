"use client";

import { NAV_TOUR_KEY, POST_PROFILE_DEMO_KEY, SESSION_COOKIE } from "@/lib/types";
import { useEffect } from "react";

function readKey(key: string): boolean {
  try {
    if (window.localStorage.getItem(key) === "1") return true;
    if (document.cookie.split("; ").some((row) => row.startsWith(`${key}=1`))) return true;
  } catch {
    return true;
  }
  return false;
}

function writeKey(key: string) {
  try {
    window.localStorage.setItem(key, "1");
    document.cookie = `${key}=1; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function readPostProfileDemoDone(): boolean {
  return readKey(POST_PROFILE_DEMO_KEY) || readKey(NAV_TOUR_KEY);
}

export function writePostProfileDemoDone() {
  writeKey(POST_PROFILE_DEMO_KEY);
  writeKey(NAV_TOUR_KEY);
}

function parseSession(): Record<string, unknown> | null {
  try {
    const raw =
      window.localStorage.getItem(SESSION_COOKIE) ||
      (() => {
        const match = document.cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]*)`));
        return match?.[1] ? decodeURIComponent(match[1]) : null;
      })();
    if (!raw) return null;
    const session = JSON.parse(raw) as Record<string, unknown>;
    return session && typeof session === "object" ? session : null;
  } catch {
    return null;
  }
}

/** Returning / already-generated accounts — never show post-profile demo. */
function isExistingAccountSession(session: Record<string, unknown> | null): boolean {
  if (!session) return false;
  if (session.stylistRequestId) return true;
  if (session.generated) return true;
  if (session.hasUsedFreeBoard) return true;
  if (Array.isArray(session.stylistRequestIds) && session.stylistRequestIds.length > 0) return true;
  if (Array.isArray(session.lookFeedback) && session.lookFeedback.length > 0) return true;
  return false;
}

/**
 * Layout stub — never auto-opens a tour on home (or anywhere).
 * First-run home is the magazine cover: Create a profile + cookie Log in.
 * Existing accounts get tour keys marked done; mid-quiz does not (they still need post-profile demo).
 * Spotlight demo lives on `/personalize/ready` only.
 */
export function NavTour() {
  useEffect(() => {
    if (readPostProfileDemoDone()) return;
    if (isExistingAccountSession(parseSession())) {
      writePostProfileDemoDone();
    }
  }, []);

  return null;
}
