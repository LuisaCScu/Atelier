import { LookbookLive } from "@/components/lookbook-live";
import { applyFreeBoardFittings } from "@/lib/freemium";
import { defaultSession } from "@/lib/generate";
import { buildStylistRequest, STYLIST_RESPONSE_KIND } from "@/lib/stylist-contract";
import { localStylistResponse } from "@/lib/stylist-local";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Local/preview only — lasting production 404s so Luisa never lands here. */
export default function PreviewFreeBoardPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  const session = defaultSession({
    name: "Luisa",
    likedStyleIds: ["pc-cream-coat", "hg-denim-loafer"],
    occasions: ["weekend"],
    budgetMax: 280,
    lookAge: "mid",
  });
  const request = buildStylistRequest(session, { requestId: "srq_preview_free", tier: "free", freeFirstBoard: true });
  const generated = localStylistResponse(request, session);
  const response = {
    ...generated,
    kind: STYLIST_RESPONSE_KIND,
    requestId: request.requestId,
    looks: applyFreeBoardFittings(generated.looks, true),
  };

  return (
    <LookbookLive
      name="Luisa"
      budgetMax={280}
      sizeLine=""
      requestIds={[request.requestId]}
      initial={response}
      freeBoard
      generateAccess="free"
    />
  );
}
