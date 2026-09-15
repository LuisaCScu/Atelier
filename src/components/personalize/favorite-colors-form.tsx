"use client";

import { FavoriteColorFields, FavoriteColorsPicker } from "@/components/personalize/favorite-colors";
import { ctaPrimary } from "@/components/marks";
import type { ColorSwatch } from "@/lib/types";
import { useState } from "react";

export function FavoriteColorsForm({
  initial,
  nextHref = "/profile",
  doneLabel = "Save favorites",
}: {
  initial: ColorSwatch[];
  nextHref?: string;
  doneLabel?: string;
}) {
  const [favs, setFavs] = useState<ColorSwatch[]>(initial);
  return (
    <form action="/session" method="post" className="mt-6">
      <input type="hidden" name="next" value={nextHref} />
      <FavoriteColorsPicker selected={favs} onChange={setFavs} />
      <FavoriteColorFields selected={favs} />
      <button type="submit" className={`${ctaPrimary} mt-8`}>
        {doneLabel}
      </button>
    </form>
  );
}
