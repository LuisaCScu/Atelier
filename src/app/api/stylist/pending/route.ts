import { stylistKeyAuthorized, unauthorizedStylist } from "@/lib/stylist-auth";
import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import { deleteInbox, listPendingRequests } from "@/lib/stylist-inbox";

export function OPTIONS() {
  return stylistOptions();
}

export async function GET(request: Request) {
  if (!stylistKeyAuthorized(request)) return unauthorizedStylist();
  try {
    const records = await listPendingRequests();
    return corsJson({
      pending: records
        .filter((record) => !record.response)
        .map((record) => ({
          requestId: record.request.requestId,
          updatedAt: record.updatedAt,
          request: record.request,
        })),
    });
  } catch {
    return corsJson({ pending: [] });
  }
}

async function deletePending(request: Request) {
  if (!stylistKeyAuthorized(request)) return unauthorizedStylist();
  const url = new URL(request.url);
  let requestId = url.searchParams.get("requestId")?.trim() || "";
  if (!requestId && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const rec = body as Record<string, unknown>;
      if (typeof rec.requestId === "string") requestId = rec.requestId.trim();
    }
  }
  if (!requestId) {
    return corsJson({ error: "requestId query (or JSON body) required" }, 400);
  }
  const ok = await deleteInbox(requestId);
  if (!ok) return corsJson({ error: "Not found", requestId }, 404);
  return corsJson({ ok: true, requestId });
}

export async function DELETE(request: Request) {
  return deletePending(request);
}

/** DELETE-via-POST for clients that cannot send DELETE. */
export async function POST(request: Request) {
  return deletePending(request);
}
