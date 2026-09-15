"use client";

import { AppShell, ScreenHeader } from "@/components/app-shell";
import { StyleThisPiecePanel } from "@/components/closet/style-this-piece-panel";
import { GenerateQuotaNote } from "@/components/generate-quota-note";
import { ctaPrimary, ctaSecondary } from "@/components/marks";
import { closetColorFill, COLOR_SWATCH } from "@/lib/catalog";
import { cutoutPhoto } from "@/lib/closet-cutout";
import { categoryFromRole, CLOSET_ROLES, suggestedClosetName, CLOSET_COLOR_CHIPS, closetChipAriaLabel } from "@/lib/closet-roles";
import { ensureClosetImagesHydrated, getClosetItem, hydrateCloset, loadClosetCutout, removeClosetItem, subscribeCloset, updateClosetItem } from "@/lib/closet-store";
import {
  enqueueStyleThisPiece,
  markPieceStylePending,
  preheatPieceStyle,
  readPieceStyleEntry,
} from "@/lib/piece-style-cache";
import type { ClosetItem, ClosetRole, ColorId } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";

export function ClosetEdit({
  id,
  stylingRequestId,
  quotaExhausted = false,
  forceEdit = false,
}: {
  id: string;
  /** When set (from ?styling=), show How to style it wait/results on this piece page. */
  stylingRequestId?: string;
  quotaExhausted?: boolean;
  /** Soft entry: ?edit=1 shows the edit form; default landing is How to style it. */
  forceEdit?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const autoStarted = useRef(false);
  /** True after user cuts a new/replaced photo this edit session. */
  const photoReplaced = useRef(false);
  const [item, setItem] = useState<ClosetItem | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(true);
  const [role, setRole] = useState<ClosetRole>("other");
  const [color, setColor] = useState<ColorId | "other">("other");
  const [cutout, setCutout] = useState("");
  const [cornersBusy, setCornersBusy] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [activeStylingId, setActiveStylingId] = useState<string | undefined>(stylingRequestId);
  const [autoError, setAutoError] = useState("");
  const [autoQuota, setAutoQuota] = useState(quotaExhausted);
  const [startingStyle, setStartingStyle] = useState(false);

  useEffect(() => {
    setActiveStylingId(stylingRequestId);
  }, [stylingRequestId]);

  useEffect(() => {
    hydrateCloset();
    void ensureClosetImagesHydrated();
    let cancelled = false;
    const load = () => {
      const found = getClosetItem(id);
      setItem(found);
      if (found) {
        setName(found.name);
        setRole(found.role);
        setColor(found.color);
        const inline = found.cutoutUrl || found.imageDataUrl || "";
        if (inline) setCutout(inline);
        else {
          void loadClosetCutout(found.id).then((url) => {
            if (!cancelled && url) setCutout(url);
          });
        }
      }
    };
    load();
    const unsub = subscribeCloset(load);
    return () => {
      cancelled = true;
      unsub();
    };
  }, [id]);

  useEffect(() => {
    if (nameTouched) return;
    const suggested = suggestedClosetName(color, role);
    if (suggested) setName(suggested);
  }, [color, role, nameTouched]);

  // Default open = How to style it (cached or auto-start). Edit only when ?edit=1.
  useEffect(() => {
    if (forceEdit || !item || autoStarted.current) return;
    if (activeStylingId || stylingRequestId) return;

    const cached = readPieceStyleEntry(item.id);
    if (cached?.requestId) {
      autoStarted.current = true;
      setActiveStylingId(cached.requestId);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("styling") !== cached.requestId) {
          params.set("styling", cached.requestId);
          params.delete("edit");
          router.replace(`/closet/${encodeURIComponent(item.id)}?${params.toString()}`, { scroll: false });
        }
      }
      return;
    }

    autoStarted.current = true;
    setStartingStyle(true);
    setAutoError("");
    void (async () => {
      const result = await enqueueStyleThisPiece(item.id);
      if (!result.ok) {
        setStartingStyle(false);
        setAutoQuota(Boolean(result.quotaExhausted));
        setAutoError(result.error || "Couldn’t start styling.");
        return;
      }
      markPieceStylePending(item.id, result.requestId);
      setActiveStylingId(result.requestId);
      setStartingStyle(false);
      const params = new URLSearchParams();
      params.set("styling", result.requestId);
      router.replace(`/closet/${encodeURIComponent(item.id)}?${params.toString()}`, { scroll: false });
    })();
  }, [forceEdit, item, activeStylingId, stylingRequestId, router]);

  async function onReplacePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setWorking(true);
    try {
      const result = await cutoutPhoto(file, { roleHint: role, fileHint: name });
      setCutout(result.dataUrl);
      setCornersBusy(result.cornersBusy);
      setColor(result.dominantColor);
      setNameTouched(false);
      photoReplaced.current = true;
      const suggested = suggestedClosetName(result.dominantColor, role);
      if (suggested) setName(suggested);
    } catch {
      setError("We couldn’t cut that photo out. Try a clearer shot on a simple surface.");
    } finally {
      setWorking(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!item || working) return;
    const trimmed = name.trim() || suggestedClosetName(color, role) || item.name;
    setWorking(true);
    setError("");
    try {
      const resolvedCutout = cutout || item.cutoutUrl || item.imageDataUrl || "";
      const updated = await updateClosetItem(item.id, {
        name: trimmed,
        role,
        category: categoryFromRole(role),
        color,
        cutoutUrl: resolvedCutout || undefined,
        imageDataUrl: resolvedCutout || undefined,
        source: resolvedCutout ? "photo" : item.source,
      });
      if (!updated) {
        setError("Couldn’t save that piece. Free some browser storage and try again.");
        return;
      }
      // Preheat How to style it when a new/replaced photo cutout was saved (skip note-only / ready/pending).
      if (photoReplaced.current && resolvedCutout) {
        preheatPieceStyle(item.id);
      }
      // After save → piece styling view (not edit form).
      router.push(`/closet/${encodeURIComponent(item.id)}`);
    } catch {
      setError("Couldn’t save that piece. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function onRemove() {
    if (!item || working) return;
    setWorking(true);
    try {
      const result = await removeClosetItem(item.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/closet");
    } catch {
      setError("Couldn’t remove that piece. Try again.");
    } finally {
      setWorking(false);
    }
  }

  if (item === undefined) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
        <ScreenHeader backHref="/closet" title="Closet" />
        <p className="mt-10 text-center text-[13px] text-black/40">Opening piece…</p>
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
        <ScreenHeader backHref="/closet" title="Closet" />
        <h1 className="font-serif text-[30px] leading-tight">Piece not found.</h1>
        <p className="mt-3 text-[14px] leading-6 text-black/50">It may have been removed on this device.</p>
        <a href="/closet" className={`${ctaPrimary} mt-8`}>
          Back to closet
        </a>
      </div>
    );
  }

  const swatch =
    color !== "other" && color in COLOR_SWATCH ? closetColorFill(color as ColorId) : "#ececec";

  const showEdit = forceEdit;
  const stylingId = activeStylingId || stylingRequestId;

  // How to style it — primary landing for any existing piece (Luisa lock).
  if (!showEdit) {
    return (
      <AppShell tab="closet">
        {stylingId ? (
          <StyleThisPiecePanel piece={item} requestId={stylingId} />
        ) : (
          <section data-style-this-piece="pending">
            <h1 className="mt-2 font-serif text-[32px] leading-[1.1] tracking-tight">How to style it</h1>
            <p className="mt-2 text-[14px] leading-5 text-black/45">Your piece + shoppable finishes</p>
            <button
              type="button"
              className={`${ctaSecondary} mt-5`}
              onClick={() => router.push("/closet")}
            >
              Back to Closet
            </button>
            <p className="mt-2 text-center text-[12px] leading-5 text-black/40">
              Styling continues in the background when you leave.
            </p>
            <p className="mt-8 text-[12px] tracking-[0.14em] text-black/40 uppercase">
              {startingStyle ? "Styling this piece…" : "Preparing…"}
            </p>
            <p className="mt-2 font-serif text-[22px] leading-tight text-black/70">
              Generating your looks…
            </p>
            <p className="mt-1 text-[13px] text-black/45">Almost ready…</p>
            {autoError ? <p className="mt-4 text-[13px] text-black/45">{autoError}</p> : null}
          </section>
        )}
        <GenerateQuotaNote forced={autoQuota || quotaExhausted} className="mt-6 text-[13px] leading-5 text-black/45" />
        {!stylingId ? (
          <button
            type="button"
            className={`${ctaPrimary} mt-8`}
            onClick={() => router.push("/closet")}
          >
            Back to Closet
          </button>
        ) : null}
        <a
          href={`/closet/${encodeURIComponent(item.id)}?edit=1`}
          className="mt-4 block text-center text-[13px] text-black/45"
        >
          Edit this piece
        </a>
      </AppShell>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
      <ScreenHeader backHref={`/closet/${encodeURIComponent(item.id)}`} title="Edit" />
      <h1 className="font-serif text-[30px] leading-tight">Edit piece</h1>
      <p className="mt-2 text-[14px] leading-6 text-black/50">Name, role, color, or replace the photo cutout.</p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-1 flex-col">
        <div
          className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-3xl"
          style={{
            // Solid white plate behind alpha cutouts — never checkerboard (Luisa lock).
            background: cutout ? "#ffffff" : swatch,
          }}
        >
          {working ? (
            <p className="text-[13px] text-black/45">Cutting the piece out…</p>
          ) : cutout ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cutout} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <p className="px-6 text-center text-[13px] text-black/40">No photo yet</p>
          )}
        </div>
        {cornersBusy ? (
          <p className="mt-3 rounded-xl bg-[#efe8dc] px-3 py-2.5 text-[12px] leading-5 text-black/60">
            Corners still look busy — try a plainer surface if the cutout feels off.
          </p>
        ) : null}
        <button
          type="button"
          className="mt-3 text-[13px] text-black/45"
          onClick={() => inputRef.current?.click()}
          disabled={working}
        >
          {cutout ? "Replace photo" : "Add photo"}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={onReplacePhoto} />

        <label className="mt-5 text-[12px] text-black/40" htmlFor="edit-name">
          Name
        </label>
        <input
          id="edit-name"
          value={name}
          onChange={(event) => {
            setNameTouched(true);
            setName(event.target.value);
          }}
          className="mt-2 h-12 rounded-xl border border-black/8 bg-white px-4 text-[15px] outline-none"
        />

        <p className="mt-5 text-[12px] text-black/40">Role</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CLOSET_ROLES.map((entry) => (
            <label key={entry.id} className="cursor-pointer">
              <input
                type="radio"
                name="role"
                value={entry.id}
                checked={role === entry.id}
                onChange={() => setRole(entry.id)}
                className="peer sr-only"
              />
              <span className="flex rounded-full bg-white px-3 py-1.5 text-[12px] peer-checked:bg-black peer-checked:text-white">
                {entry.label}
              </span>
            </label>
          ))}
        </div>

        <p className="mt-5 text-[12px] text-black/40">Color · editable</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input
              type="radio"
              name="color"
              value="other"
              checked={color === "other"}
              onChange={() => setColor("other")}
              className="peer sr-only"
            />
            <span className="flex h-8 items-center rounded-full bg-white px-3 text-[11px] peer-checked:ring-2 peer-checked:ring-black">
              Skip
            </span>
          </label>
          {CLOSET_COLOR_CHIPS.map((cid) => (
            <label key={cid} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={cid}
                checked={color === cid}
                onChange={() => setColor(cid)}
                className="peer sr-only"
              />
              <span
                className="block size-8 rounded-full border border-black/10 peer-checked:ring-2 peer-checked:ring-black peer-checked:ring-offset-2"
                style={{ background: closetColorFill(cid) }}
                aria-label={closetChipAriaLabel(cid)}
              />
            </label>
          ))}
        </div>

        {error ? <p className="mt-4 text-[13px] text-black/55">{error}</p> : null}

        <button type="submit" className={`${ctaPrimary} mt-8`} disabled={working}>
          Save changes
        </button>
        <button type="button" className={`${ctaSecondary} mt-2.5`} onClick={onRemove}>
          Remove from closet
        </button>
        <a
          href={`/closet/${encodeURIComponent(item.id)}`}
          className="mt-6 block text-center text-[13px] text-black/45"
        >
          Back to How to style it
        </a>
      </form>
    </div>
  );
}
