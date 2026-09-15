"use client";

import { ScreenHeader } from "@/components/app-shell";
import { AppearanceChips, AppearanceFields } from "@/components/personalize/appearance-chips";
import { ColorAspects } from "@/components/personalize/color-aspects";
import { FacePhotoField } from "@/components/personalize/face-photo-field";
import { FavoriteColorFields, FavoriteColorsPicker } from "@/components/personalize/favorite-colors";
import { KnowSeasonFork, type KnowSeason } from "@/components/personalize/know-season-fork";
import { SeasonPicker } from "@/components/personalize/season-picker";
import { guessAppearanceFromDataUrl } from "@/lib/appearance";
import { analyzeFaceDataUrl } from "@/lib/color-analysis";
import { loadFacePhoto } from "@/lib/media";
import type { AppearanceTags, ColorSwatch } from "@/lib/types";
import { useEffect, useState } from "react";

export function ColorStep({
  initialFavs = [],
  initialAppearance = {},
  fromProfile = false,
}: {
  initialFavs?: ColorSwatch[];
  initialAppearance?: AppearanceTags;
  fromProfile?: boolean;
}) {
  const [knows, setKnows] = useState<KnowSeason>("");
  const [photo, setPhoto] = useState("");
  const [season, setSeason] = useState("");
  const [undertone, setUndertone] = useState("");
  const [value, setValue] = useState("");
  const [chroma, setChroma] = useState("");
  const [favs, setFavs] = useState<ColorSwatch[]>(initialFavs);
  const [appearance, setAppearance] = useState<AppearanceTags>(initialAppearance);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    setPhoto(loadFacePhoto());
  }, []);

  useEffect(() => {
    if (!photo) return;
    let cancelled = false;
    setReading(true);
    void Promise.all([
      knows === "no" ? analyzeFaceDataUrl(photo) : Promise.resolve(null),
      guessAppearanceFromDataUrl(photo),
    ]).then(([result, guess]) => {
      if (cancelled) return;
      if (result) {
        setUndertone((current) => current || result.undertone);
        setValue((current) => current || (result.value === "dark" ? "deep" : result.value));
        setChroma((current) => current || result.chroma);
      }
      setAppearance((current) => ({
        hairColor: current.hairColor || guess.hairColor,
        hairLength: current.hairLength || guess.hairLength,
        eyes: current.eyes || guess.eyes,
        skinToneBand: current.skinToneBand || guess.skinToneBand,
      }));
      setReading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [knows, photo]);

  const ready = knows === "yes" ? Boolean(season) : knows === "no" ? Boolean(undertone && value && chroma) : false;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
      <ScreenHeader
        {...(fromProfile ? { closeHref: "/profile" } : { backHref: "/personalize/measurements" })}
      />
      <p className="text-[12px] text-black/40">{fromProfile ? "Profile · Color" : "2 of 5"}</p>
      <h1 className="mt-2 font-serif text-[32px] leading-tight">Color</h1>
      <p className="mt-2 text-[14px] text-black/50">
        Season analysis stays. Favorite colors are what you like to wear — not a skin-flattering test.
      </p>

      <div className="mt-8">
        <KnowSeasonFork value={knows} onChange={setKnows} />
      </div>

      {knows === "yes" ? (
        <div className="mt-8">
          <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Your season</p>
          <p className="mt-1 text-[13px] text-black/45">The chips are the main colors for that season. Tap a row to choose.</p>
          <SeasonPicker name="seasonChoice" value={season} onChange={setSeason} />
        </div>
      ) : null}

      {knows ? (
        <FacePhotoField
          value={photo}
          onChange={setPhoto}
          hint={
            knows === "no"
              ? "Daylight on the face, little or no makeup. We guess undertone and appearance chips — you can edit both."
              : "Optional. We only guess hair, eyes, and skin tone for heroes — your season stays as you picked it."
          }
        />
      ) : null}

      {knows === "no" ? (
        <div className="mt-6">
          {reading ? <p className="mt-2 text-[12px] text-black/40">Reading the face for a starting point…</p> : null}
          <ColorAspects
            undertone={undertone}
            value={value}
            chroma={chroma}
            onUndertone={setUndertone}
            onValue={setValue}
            onChroma={setChroma}
          />
        </div>
      ) : null}

      {knows ? (
        <>
          {reading && knows === "yes" && photo ? (
            <p className="mt-4 text-[12px] text-black/40">Guessing appearance chips…</p>
          ) : null}
          <AppearanceChips value={appearance} onChange={setAppearance} />
          <FavoriteColorsPicker selected={favs} onChange={setFavs} />
        </>
      ) : null}

      <form id="color-save" action="/session" method="post" className="mt-8 space-y-3">
        <input type="hidden" name="done_color" value="1" />
        <input type="hidden" name="colorSource" value={knows === "yes" ? "season" : "aspects"} />
        <input type="hidden" name="hasFacePhoto" value={photo ? "1" : "0"} />
        <input type="hidden" name="season" value={knows === "yes" ? season : "skip"} />
        <input type="hidden" name="skipAspects" value={knows === "yes" ? "1" : "0"} />
        <input type="hidden" name="undertone" value={knows === "no" ? undertone : ""} />
        <input type="hidden" name="value" value={knows === "no" ? value : ""} />
        <input type="hidden" name="chroma" value={knows === "no" ? chroma : ""} />
        <FavoriteColorFields selected={favs} />
        <AppearanceFields value={appearance} />
        <input type="hidden" name="next" value={fromProfile ? "/profile" : "/personalize/styles"} />
        <button
          type="submit"
          disabled={!ready}
          className="flex h-12 w-full items-center justify-center rounded-xl bg-black text-[15px] font-medium text-white disabled:opacity-40"
        >
          {fromProfile ? "Done" : "Continue"}
        </button>
        {!ready ? (
          <p className="text-center text-[12px] text-black/40">
            {knows === "yes"
              ? "Choose a season to continue."
              : knows === "no"
                ? "Pick undertone, value, and chroma. Photo and favorites are optional."
                : "Yes or no first."}
          </p>
        ) : null}
      </form>
    </div>
  );
}
