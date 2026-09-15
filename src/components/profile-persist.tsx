"use client";

import { rememberLookRequestId } from "@/lib/stylist-client";
import { SESSION_COOKIE } from "@/lib/types";
import { useEffect } from "react";

const STORAGE_KEY = SESSION_COOKIE;

function readCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${STORAGE_KEY}=([^;]*)`));
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function ProfilePersist() {
  useEffect(() => {
    const cookie = readCookie();
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (cookie) {
      window.localStorage.setItem(STORAGE_KEY, cookie);
      try {
        const profile = JSON.parse(cookie) as { stylistRequestId?: string; stylistRequestIds?: string[] };
        rememberLookRequestId(profile.stylistRequestId);
        for (const id of profile.stylistRequestIds ?? []) rememberLookRequestId(id);
      } catch {
        /* profile JSON only */
      }
      return;
    }
    if (!stored) return;
    void fetch("/api/session/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stored,
    }).then((res) => {
      if (res.ok) window.location.reload();
    });
  }, []);
  return null;
}
