import { stylistKeyAuthorized, unauthorizedStylist } from "@/lib/stylist-auth";
import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import { readInbox } from "@/lib/stylist-inbox";

export function OPTIONS() {
  return stylistOptions();
}

export async function GET(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  if (!stylistKeyAuthorized(request)) return unauthorizedStylist();
  const { requestId } = await params;
  const record = await readInbox(requestId);
  if (!record) {
    return corsJson({ error: "Unknown requestId" }, 404);
  }
  return corsJson({
    request: record.request,
    status: record.response ? "ready" : "awaiting_stylist",
  });
}
