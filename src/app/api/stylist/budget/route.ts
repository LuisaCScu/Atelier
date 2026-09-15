import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import { readStylistBudget } from "@/lib/stylist-budget";

export function OPTIONS() {
  return stylistOptions();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const snapshot = await readStylistBudget({
    userKey: url.searchParams.get("userKey"),
    requestId: url.searchParams.get("requestId"),
  });
  return corsJson(snapshot);
}
