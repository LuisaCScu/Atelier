import { redirect } from "next/navigation";
import { parseClosetPacketForMode } from "@/lib/closet-packet";
import { parseClosetPieceId, parseGenerateMode } from "@/lib/stylist-contract";
import { readSession } from "@/lib/session";
import { lookbookPathAfterRequest, requestStylistLooks } from "@/lib/stylist";

export function GET() {
  redirect("/style");
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) redirect("/style");
  session.seed = Date.now();
  let closet;
  let generateMode = parseGenerateMode(undefined);
  let closetPieceId: string | undefined;
  try {
    const data = await request.formData();
    generateMode = parseGenerateMode(data.get("generateMode"));
    closetPieceId = parseClosetPieceId(data.get("closetPieceId"));
    closet = parseClosetPacketForMode(data.get("closetJson"), generateMode, closetPieceId);
  } catch {
    closet = undefined;
  }
  const result = await requestStylistLooks(session, {
    force: true,
    closet,
    generateMode,
    ...(generateMode === "styleThisPiece" && closetPieceId ? { closetPieceId } : {}),
  });
  redirect(lookbookPathAfterRequest(result));
}
