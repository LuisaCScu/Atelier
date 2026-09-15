"use client";

import { closetColorFill, COLOR_SWATCH } from "@/lib/catalog";
import { closetRoleLabel } from "@/lib/closet-roles";
import { loadClosetCutout } from "@/lib/closet-store";
import type { ClosetItem, ClosetRole, ColorId } from "@/lib/types";
import { useEffect, useState } from "react";

/** Solid cream/white plate behind alpha cutouts — never checkerboard. */
export const CUTOUT_PLATE = "#FFFAF5";
export const CLOSET_CREAM = "#F4EDE3";

const CLIP_ROLES = new Set<ClosetRole>(["bottom", "trousers", "shorts"]);

function hangerKind(role: ClosetRole): "clip" | "classic" {
  return CLIP_ROLES.has(role) ? "clip" : "classic";
}

/** Classic coat-hanger hook + triangle (tops, dresses, sweaters, etc.). */
function ClassicHanger({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 28" className={className} aria-hidden fill="none">
      <path
        d="M36 3.5c0-1.6 1.2-2.8 2.7-2.8 1.4 0 2.5 1 2.7 2.3"
        stroke="#8a8074"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M36 5.5V10M10 24.5 36 10l26 14.5"
        stroke="#8a8074"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 24.5h48" stroke="#8a8074" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Clip hanger — bar with two clips (bottoms / skirts / pants). */
function ClipHanger({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 28" className={className} aria-hidden fill="none">
      <path
        d="M36 3.5c0-1.6 1.2-2.8 2.7-2.8 1.4 0 2.5 1 2.7 2.3"
        stroke="#8a8074"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M36 5.5V11" stroke="#8a8074" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 12h44" stroke="#8a8074" strokeWidth="1.6" strokeLinecap="round" />
      {/* left clip */}
      <path d="M22 12v6M19.5 18h5" stroke="#8a8074" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M19.5 20.5 22 25l2.5-4.5" stroke="#8a8074" strokeWidth="1.3" strokeLinejoin="round" />
      {/* right clip */}
      <path d="M50 12v6M47.5 18h5" stroke="#8a8074" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M47.5 20.5 50 25l2.5-4.5" stroke="#8a8074" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function HangPiece({ item }: { item: ClosetItem }) {
  const [cutout, setCutout] = useState(item.cutoutUrl || item.imageDataUrl || "");
  useEffect(() => {
    const inline = item.cutoutUrl || item.imageDataUrl || "";
    if (inline) {
      setCutout(inline);
      return;
    }
    let cancelled = false;
    void loadClosetCutout(item.id).then((url) => {
      if (!cancelled && url) setCutout(url);
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, item.cutoutUrl, item.imageDataUrl]);

  const kind = hangerKind(item.role);
  const swatch =
    item.color !== "other" && item.color in COLOR_SWATCH ? closetColorFill(item.color as ColorId) : "#ececec";

  return (
    <a
      href={`/closet/${encodeURIComponent(item.id)}`}
      className="hang-piece relative flex w-[108px] shrink-0 snap-start flex-col items-center pt-1"
    >
      {kind === "clip" ? (
        <ClipHanger className="relative z-[1] h-7 w-[72px]" />
      ) : (
        <ClassicHanger className="relative z-[1] h-7 w-[72px]" />
      )}
      <div
        className="relative -mt-1 flex aspect-[3/4] w-[96px] items-center justify-center overflow-hidden rounded-md border border-black/6 shadow-[0_1px_0_rgba(0,0,0,0.03)]"
        style={{ background: cutout ? CUTOUT_PLATE : swatch }}
      >
        {cutout ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cutout} alt="" className="size-full object-contain p-1.5" />
        ) : (
          <span className="px-1.5 text-center text-[10px] leading-tight text-black/40">
            {closetRoleLabel(item.role)}
          </span>
        )}
        {item.flatLayStatus === "pending" ? (
          <span className="absolute inset-x-1 bottom-1 rounded bg-black/55 px-1 py-0.5 text-center text-[9px] leading-tight text-white/95">
            Polishing…
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 w-full truncate px-0.5 text-center text-[11px] font-medium leading-tight">{item.name}</p>
    </a>
  );
}

export function HangRackRow({
  bucketId,
  label,
  items,
  showDrillIn = true,
}: {
  bucketId: string;
  label: string;
  items: ClosetItem[];
  showDrillIn?: boolean;
}) {
  return (
    <section className="relative">
      {showDrillIn ? (
        <a
          href={`/closet/bucket/${encodeURIComponent(bucketId)}`}
          className="inline-flex items-center gap-0.5 text-[13px] font-medium text-black/70"
        >
          {label}
          <span className="text-black/35" aria-hidden>
            ›
          </span>
        </a>
      ) : (
        <p className="text-[13px] font-medium text-black/70">{label}</p>
      )}
      <div className="relative mt-2">
        {/* Thin rod behind hangers */}
        <div
          className="pointer-events-none absolute top-[18px] right-0 left-0 z-0 h-px bg-[#c4b8a8]/90"
          aria-hidden
        />
        <div
          className="hang-rack-scroll flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
          style={{ scrollPaddingInline: "4px" }}
        >
          {/* Leading pad for momentum / polish on iOS */}
          <div className="w-0.5 shrink-0 snap-start" aria-hidden />
          {items.map((item) => (
            <HangPiece key={item.id} item={item} />
          ))}
          <div className="w-3 shrink-0" aria-hidden />
        </div>
      </div>
    </section>
  );
}
