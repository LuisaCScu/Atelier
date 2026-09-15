import { redirect } from "next/navigation";
import { parseClosetPacketForMode } from "@/lib/closet-packet";
import { defaultSession } from "@/lib/generate";
import { mergeSessionFromForm, readSession } from "@/lib/session";
import { parseClosetPieceId, parseGenerateMode } from "@/lib/stylist-contract";
import { lookbookPathAfterRequest, requestStylistLooks } from "@/lib/stylist";

export async function POST(request: Request) {
  const data = await request.formData();
  const current = (await readSession()) ?? defaultSession();
  const next = mergeSessionFromForm(current, data);
  next.seed = Date.now();
  if (data.get("path") === "deep") next.path = "deep";
  if (data.get("path") === "quick") next.path = "quick";
  if (!next.occasions.length) next.occasions = ["weekend"];
  if (!next.name.trim()) next.name = "Alex";
  const generateMode = parseGenerateMode(data.get("generateMode"));
  const closetPieceId = parseClosetPieceId(data.get("closetPieceId"));
  const closet = parseClosetPacketForMode(data.get("closetJson"), generateMode, closetPieceId);
  const result = await requestStylistLooks(next, {
    closet,
    generateMode,
    ...(generateMode === "styleThisPiece" && closetPieceId ? { closetPieceId } : {}),
  });
  if (result.budgetExhausted) {
    if (current.generated || current.stylistRequestId) redirect(lookbookPathAfterRequest(result));
    redirect(next.path === "deep" ? "/personalize/budget?quota=exhausted" : "/quick?quota=exhausted");
  }
  redirect(lookbookPathAfterRequest(result));
}
