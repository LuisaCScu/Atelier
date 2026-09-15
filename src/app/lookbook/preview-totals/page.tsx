import { LookDetailLive } from "@/components/look-detail-live";
import { mvpItemById } from "@/lib/mvp-catalog";
import { type StylistLookV1, type StylistPieceV1, type StylistPieceRoleV1 } from "@/lib/stylist-contract";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function piece(id: string, role: StylistPieceRoleV1): StylistPieceV1 {
  const item = mvpItemById(id);
  if (!item) throw new Error(`Missing catalog piece ${id}`);
  return {
    id: item.id,
    role,
    brand: item.brand,
    name: item.name,
    price: item.price,
    currency: "USD",
    image: item.image,
    shopUrl: item.shopUrl,
  };
}

/** Local/preview only — lasting production 404s so Luisa never lands here. */
export default function PreviewTotalsPage() {
  if (process.env.VERCEL_ENV === "production") notFound();

  const pieces = [
    piece("everlane-womens-tissue-long-sleeve-turtleneck-black", "knit"),
    piece("everlane-womens-column-jean-bitter-chocolate", "trousers"),
    piece("soft-ruched-loafers", "shoes"),
  ];
  const levelUp = [piece("everlane-womens-leather-boxy-tote-black-pebble-leather", "accessory")];
  const core = pieces.reduce((sum, item) => sum + item.price, 0);
  const elevate = levelUp.reduce((sum, item) => sum + item.price, 0);
  const turtleneck = mvpItemById("everlane-womens-tissue-long-sleeve-turtleneck-black");

  const look: StylistLookV1 = {
    id: "preview-core-elevate",
    title: "Paddock Cashmere",
    hook: "Soft structure for a weekday.",
    formula: "Knit + column jean + loafer",
    why: "Quiet layers that stay inside the request, with one optional bag.",
    heroImage: turtleneck?.image ?? pieces[0].image,
    pieces,
    levelUp,
    coreTotal: core,
    elevateTotal: elevate,
    lookTotal: { amount: core + elevate, currency: "USD" },
    layout: "board",
  };

  return <LookDetailLive id={look.id} initial={look} budgetMin={80} budgetMax={280} />;
}
