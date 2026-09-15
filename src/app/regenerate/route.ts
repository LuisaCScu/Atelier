import { redirect } from "next/navigation";
import { parseClosetPacketForMode } from "@/lib/closet-packet";
import { styleChatPacketFromInput } from "@/lib/style-chat";
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
  let occasions = session.occasions;
  let occasionNote = session.styleBrief;
  try {
    const data = await request.formData();
    generateMode = parseGenerateMode(data.get("generateMode"));
    closetPieceId = parseClosetPieceId(data.get("closetPieceId"));
    closet = parseClosetPacketForMode(data.get("closetJson"), generateMode, closetPieceId);
    const chat = styleChatPacketFromInput({
      occasion: data.getAll("occasion"),
      occasions: data.get("occasions"),
      occasionNote: data.get("occasionNote") ?? data.get("details"),
    });
    if (data.has("occasion") || data.has("occasions") || data.has("occasionNote") || data.has("details")) {
      occasions = chat.occasions;
      occasionNote = chat.occasionNote;
      session.occasions = occasions;
      if (occasionNote) session.styleBrief = occasionNote;
    }
  } catch {
    closet = undefined;
  }
  const result = await requestStylistLooks(session, {
    force: true,
    closet,
    generateMode,
    occasions,
    occasionNote,
    ...(generateMode === "styleThisPiece" && closetPieceId ? { closetPieceId } : {}),
  });
  redirect(lookbookPathAfterRequest(result));
}
