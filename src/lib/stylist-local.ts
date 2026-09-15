import { applyFreeBoardFittings, isFreeFirstBoard } from "./freemium";
import { generateMvpLooks } from "./mvp-generate";
import { isIsolatedImage, isLiveShopUrl } from "./mvp-catalog";
import {
  STYLIST_RESPONSE_KIND,
  type StylistLookV1,
  type StylistPieceRoleV1,
  type StylistPieceV1,
  type StylistRequestV1,
  type StylistResponseV1,
} from "./stylist-contract";
import type { ProfileSession } from "./types";

function asRole(role: string): StylistPieceRoleV1 {
  return role as StylistPieceRoleV1;
}

export function localStylistResponse(request: StylistRequestV1, session: ProfileSession): StylistResponseV1 {
  const generated = generateMvpLooks(session, request.lookCount);
  const mix = request.lookMix;
  const looks: StylistLookV1[] = generated.map((look, index) => {
    const slot = mix?.find((item) => item.look === index + 1) ?? mix?.[index];
    return {
      id: look.id,
      title: look.title,
      hook: look.hook,
      formula: look.formula,
      why: look.why,
      heroImage: look.heroImage,
      source: slot?.source,
      pieces: look.pieces.map((item) => {
        if (!isLiveShopUrl(item.shopUrl)) {
          throw new Error(`MVP piece ${item.id} is missing a live shop URL`);
        }
        const tile = isIsolatedImage(item) ? item.image : item.image;
        const piece: StylistPieceV1 = {
          id: item.id,
          role: asRole(item.role),
          brand: item.brand,
          name: item.name,
          price: item.price,
          currency: item.currency === "USD" ? "USD" : "USD",
          image: tile,
          shopUrl: item.shopUrl,
        };
        return piece;
      }),
    };
  });

  return {
    kind: STYLIST_RESPONSE_KIND,
    requestId: request.requestId,
    catalogVersion: request.catalogVersion,
    looks: applyFreeBoardFittings(looks, isFreeFirstBoard(request)),
  };
}
