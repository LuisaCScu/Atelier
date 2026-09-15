import { stylistGenerateOptionsFromRequest } from "@/lib/closet-packet";
import { corsJson, stylistOptions } from "@/lib/stylist-cors";
import { requestStylistLooks } from "@/lib/stylist";
import { stylistMode } from "@/lib/stylist-contract";
import { readSession } from "@/lib/session";

export function OPTIONS() {
  return stylistOptions();
}

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) {
    return corsJson({ error: "No profile session. Finish personalize first." }, 400);
  }
  const { closet, generateMode, closetPieceId } = await stylistGenerateOptionsFromRequest(request);
  const result = await requestStylistLooks(session, { closet, generateMode, closetPieceId });
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
      },
      429
    );
  }
  return corsJson({
    mode: stylistMode(),
    request: result.request,
    response: result.response,
    status: result.status,
  });
}
