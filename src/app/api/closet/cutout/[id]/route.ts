import { readHostedCutout } from "@/lib/closet-cutout-host";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const cutout = await readHostedCutout(id);
  if (!cutout) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(cutout.bytes), {
    status: 200,
    headers: {
      "content-type": cutout.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "access-control-allow-origin": "*",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "*",
    },
  });
}
