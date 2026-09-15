import { NextResponse } from "next/server";
import { readSession, writeSession } from "@/lib/session";

/** Route Handler — safe place to burn hasUsedFreeBoard after looks are ready. */
export async function POST() {
  const session = await readSession();
  if (!session) return NextResponse.json({ ok: false, reason: "no_session" }, { status: 401 });
  if (session.hasUsedFreeBoard) return NextResponse.json({ ok: true, already: true });
  await writeSession({ ...session, hasUsedFreeBoard: true, generated: true });
  return NextResponse.json({ ok: true });
}
