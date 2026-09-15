import { parseSession, writeSession } from "@/lib/session";
import { corsJson, stylistOptions } from "@/lib/stylist-cors";

export function OPTIONS() {
  return stylistOptions();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const raw = typeof body === "string" ? body : body ? JSON.stringify(body) : "";
  const session = parseSession(raw) ?? (body && typeof body === "object" ? parseSession(JSON.stringify(body)) : null);
  if (!session) {
    return corsJson({ error: "Invalid profile" }, 400);
  }
  await writeSession(session);
  return corsJson({ status: "restored", stylistRequestId: session.stylistRequestId ?? null });
}
