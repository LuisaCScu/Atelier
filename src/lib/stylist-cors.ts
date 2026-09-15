export const STYLIST_CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization, x-stylist-key",
  "access-control-max-age": "86400",
};

export function stylistOptions() {
  return new Response(null, { status: 204, headers: STYLIST_CORS });
}

export function corsJson(body: unknown, status = 200, extra?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { ...STYLIST_CORS, "cache-control": "no-store", ...extra },
  });
}
