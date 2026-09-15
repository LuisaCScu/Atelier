import { NextResponse } from "next/server";
import { defaultSession } from "@/lib/generate";
import { normalizeLikedVote, type LikedLookVote } from "@/lib/liked-looks";
import { readSession, writeSession } from "@/lib/session";
import { ensurePacketStyleSignals, normalizeLockedReasonId, rebuildStyleSignals } from "@/lib/style-signals";
import type { LookFeedbackVote } from "@/lib/types";

type Body = {
  requestId?: string;
  lookId?: string;
  vote?: LikedLookVote;
  reasons?: unknown;
  look?: LookFeedbackVote["look"];
};

function isVote(value: unknown): value is LikedLookVote {
  return value === "like" || value === "dislike" || value === "skip" || value === "wear" || value === "maybe" || value === "no";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body.lookId !== "string" || !body.lookId || !isVote(body.vote)) {
    return NextResponse.json({ error: "lookId and vote are required" }, { status: 400 });
  }

  const reasons = Array.isArray(body.reasons)
    ? body.reasons
        .map((item) => normalizeLockedReasonId(String(item)))
        .filter((id): id is string => Boolean(id))
        .slice(0, 8)
    : [];
  const requestId = typeof body.requestId === "string" && body.requestId ? body.requestId : "unknown";
  const normalized = normalizeLikedVote(body.vote);
  const vote: LookFeedbackVote = {
    requestId,
    lookId: body.lookId,
    vote: normalized,
    reasons: normalized === "dislike" ? reasons : [],
    at: new Date().toISOString(),
    look: body.look,
  };

  const current = (await readSession()) ?? defaultSession();
  const nextVotes = [...(current.lookFeedback ?? []).filter((item) => item.lookId !== vote.lookId), vote].slice(-40);
  const styleSignals = rebuildStyleSignals({
    likedIds: current.likedStyleIds ?? [],
    dislikedIds: current.dislikedStyleIds ?? [],
    shown: current.styleDeckIds?.length ?? (current.likedStyleIds?.length ?? 0) + (current.dislikedStyleIds?.length ?? 0),
    lookVotes: nextVotes,
  });

  const next = { ...current, lookFeedback: nextVotes, styleSignals };
  await writeSession(next);

  return NextResponse.json({
    ok: true,
    vote,
    styleSignals: ensurePacketStyleSignals(styleSignals),
  });
}
