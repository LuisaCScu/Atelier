import { stylistGenerateOptionsFromRequest } from "@/lib/closet-packet";
import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import { requestStylistLooks } from "@/lib/stylist";
import { stylistMode } from "@/lib/stylist-contract";
import { readSession } from "@/lib/session";

export function OPTIONS() {
  return stylistOptions();
}

/** Queue a new pending generate from the saved profile. Same budget gate as /api/stylist/generate. */
export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return corsJson({ error: "No profile session. Finish personalize first." }, 400);
  }
  session.seed = Date.now();
  const { closet, generateMode, closetPieceId, occasions, occasionNote } =
    await stylistGenerateOptionsFromRequest(request);
  const result = await requestStylistLooks(session, {
    force: true,
    closet,
    generateMode,
    closetPieceId,
    occasions,
    occasionNote,
  });
  if (result.premiumRequired) {
    return corsJson(
      {
        ok: false,
        error: "Premium required for fittings",
        code: "premium_required",
      },
      403
    );
  }
  if (result.budgetExhausted) {
    return corsJson(
      {
        ok: false,
        error: "Generate budget exhausted",
        globalDaily: result.budget.globalDaily,
        userGenerate: result.budget.userGenerate,
        freeGenerate: result.budget.freeGenerate,
      },
      429
    );
  }
  return corsJson({
    ok: true,
    mode: stylistMode(),
    request: result.request,
    response: result.response,
    status: result.status,
  });
}
