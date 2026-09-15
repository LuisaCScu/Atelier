"use client";

import { closetRoleLabel } from "@/lib/closet-roles";
import { ensureClosetImagesHydrated, hydrateCloset, loadClosetCutout, subscribeCloset } from "@/lib/closet-store";
import { closetColorFill, COLOR_SWATCH } from "@/lib/catalog";
import type { ClosetItem, ColorId } from "@/lib/types";
import { useEffect, useState } from "react";

export function HomeCloset() {
  const [items, setItems] = useState<ClosetItem[] | null>(null);

  useEffect(() => {
    setItems(hydrateCloset());
    void ensureClosetImagesHydrated().then(() => setItems(hydrateCloset()));
    return subscribeCloset(() => setItems(hydrateCloset()));
  }, []);

  const preview = (items ?? []).slice(0, 6);

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Closet</p>
          <h2 className="mt-1 font-serif text-[26px] leading-tight">What you own</h2>
        </div>
        <a href="/closet" className="text-[13px] text-black/50 underline underline-offset-4">
          Open closet
        </a>
      </div>

      {items === null ? (
        <p className="mt-4 text-[13px] text-black/40">Opening your closet…</p>
      ) : preview.length ? (
        <div className="mt-5 grid grid-cols-3 gap-2.5">
          {preview.map((item) => (
            <HomeClosetTile key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <a href="/closet" className="mt-5 block rounded-2xl bg-white px-5 py-8 text-[14px] leading-6 text-black/50">
          Add pieces you already wear. Generate can mix them with the store.
        </a>
      )}
    </section>
  );
}

function HomeClosetTile({ item }: { item: ClosetItem }) {
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
  const swatch =
    item.color !== "other" && item.color in COLOR_SWATCH ? closetColorFill(item.color as ColorId) : "#ececec";
  return (
    <a href={`/closet/${encodeURIComponent(item.id)}`} className="overflow-hidden rounded-xl bg-white">
      <div className="relative aspect-square" style={{ background: swatch }}>
        {cutout ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cutout} alt="" className="size-full object-contain p-1.5" />
        ) : (
          <div className="flex size-full items-center justify-center px-2 text-center text-[11px] text-black/40">
            {closetRoleLabel(item.role)}
          </div>
        )}
      </div>
      <p className="truncate px-2 py-2 text-[12px] font-medium">{item.name}</p>
    </a>
  );
}
