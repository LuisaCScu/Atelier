"use client";

import { ColorAspects } from "@/components/personalize/color-aspects";
import { FacePhotoField } from "@/components/personalize/face-photo-field";
import { KnowSeasonFork, type KnowSeason } from "@/components/personalize/know-season-fork";
import { SeasonPicker } from "@/components/personalize/season-picker";
import { analyzeFaceDataUrl, SEASON_GUIDES } from "@/lib/color-analysis";
import { loadFacePhoto } from "@/lib/media";
import { useEffect, useState } from "react";

/** Color starts with know-season. Face photo only on the unknown path. */
export function QuickColorField() {
  const [knows, setKnows] = useState<KnowSeason>("");
  const [photo, setPhoto] = useState("");
  const [season, setSeason] = useState("");
  const [undertone, setUndertone] = useState("");
  const [value, setValue] = useState("");
  const [chroma, setChroma] = useState("");
  const [reading, setReading] = useState(false);

  const ready = knows === "yes" ? Boolean(season) : knows === "no" ? Boolean(undertone && value && chroma) : false;

  useEffect(() => {
    const existing = loadFacePhoto();
    if (existing) setPhoto(existing);
  }, []);

  useEffect(() => {
    const form = document.querySelector("form.atelier-quick");
    if (!form) return;
    const onSubmit = (event: Event) => {
      if (ready) return;
      event.preventDefault();
      form.querySelector<HTMLElement>("[data-color-needed]")?.focus();
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [ready]);

  useEffect(() => {
    if (knows !== "no" || !photo) return;
    let cancelled = false;
    setReading(true);
    void analyzeFaceDataUrl(photo).then((result) => {
      if (cancelled) return;
      setUndertone((current) => current || result.undertone);
      setValue((current) => current || (result.value === "dark" ? "deep" : result.value));
      setChroma((current) => current || result.chroma);
      setReading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [knows, photo]);

  useEffect(() => {
    if (knows !== "yes") return;
    const guide = SEASON_GUIDES.find((item) => item.id === season);
    if (!guide) return;
    setUndertone(guide.undertone);
    setValue(guide.value === "dark" ? "deep" : guide.value);
    setChroma(guide.chroma);
  }, [knows, season]);

  return (
    <fieldset className="mt-8">
      <KnowSeasonFork value={knows} onChange={setKnows} />

      {knows === "yes" ? (
        <div className="mt-6">
          <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">Your season</p>
          <p className="mt-1 text-[13px] text-black/45">Chips show the main colors. Selecting a season is enough.</p>
          <SeasonPicker name="seasonPick" value={season} onChange={setSeason} />
        </div>
      ) : null}

      {knows === "no" ? (
        <div className="mt-2">
          <FacePhotoField value={photo} onChange={setPhoto} />
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

      {!ready ? (
        <p tabIndex={-1} data-color-needed className="mt-3 text-[12px] text-black/40 outline-none">
          {knows === "yes"
            ? "Choose a season to request looks."
            : knows === "no"
              ? "Pick undertone, value, and chroma. Photo is optional."
              : "Tell us if you already know your season."}
        </p>
      ) : null}

      <input type="hidden" name="colorSource" value={knows === "yes" ? "season" : knows === "no" ? "aspects" : ""} />
      <input type="hidden" name="hasFacePhoto" value={knows === "no" && photo ? "1" : "0"} />
      <input type="hidden" name="season" value={knows === "yes" ? season : ""} />
      <input type="hidden" name="skipAspects" value={knows === "yes" ? "1" : "0"} />
      <input type="hidden" name="undertone" value={undertone} />
      <input type="hidden" name="value" value={value} />
      <input type="hidden" name="chroma" value={chroma} />
      <input type="hidden" name="colorReady" value={ready ? "1" : "0"} />
    </fieldset>
  );
}
