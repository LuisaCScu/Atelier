import { corsJson } from "./stylist-cors";

export function stylistKeyAuthorized(request: Request): boolean {
  const key = process.env.STYLIST_INGEST_KEY;
  if (!key) return true;
  const authorization = request.headers.get("authorization") ?? "";
  const headerKey = request.headers.get("x-stylist-key") ?? "";
  return authorization === `Bearer ${key}` || headerKey === key;
}

export function unauthorizedStylist() {
  return corsJson({ error: "Unauthorized" }, 401);
}
