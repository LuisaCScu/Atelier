"use client";

import { ScreenHeader } from "@/components/app-shell";
import { ctaPrimary } from "@/components/marks";
import { closetColorFill } from "@/lib/catalog";
import { categoryFromRole, CLOSET_ROLES, CLOSET_COLOR_CHIPS, closetChipAriaLabel } from "@/lib/closet-roles";
import { addClosetItems, closetIsFull, hydrateCloset } from "@/lib/closet-store";
import { bumpSessionAddedCount } from "@/lib/closet-session-added";
import type { ClosetRole, ColorId } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

/** Note add — formerly Manual. Source stays `manual` in storage. */
export function ManualAdd() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<ClosetRole>("other");
  const [color, setColor] = useState<ColorId | "other">("other");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    hydrateCloset();
    if (closetIsFull()) router.replace("/closet/upgrade");
  }, [router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (closetIsFull()) {
      router.replace("/closet/upgrade");
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the piece a name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await addClosetItems([
        {
          id: `manual-${Date.now()}`,
          name: trimmed,
          role,
          category: categoryFromRole(role),
          color,
          source: "manual",
          gender: "female",
        },
      ]);
      if (!result.ok) {
        if (result.reason === "cap") {
          router.replace("/closet/upgrade");
          return;
        }
        setError(result.message);
        return;
      }
      bumpSessionAddedCount(1);
      router.push("/closet");
    } catch {
      setError("Couldn’t save to this device. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
      <ScreenHeader backHref="/closet" title="Note" />
      <h1 className="font-serif text-[30px] leading-tight">Add by note</h1>
      <p className="mt-2 text-[14px] leading-6 text-black/50">
        Name only · add a photo later. Role and color help Generate mix this piece.
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-1 flex-col">
        <label className="text-[12px] text-black/40" htmlFor="closet-name">
          What is it?
        </label>
        <input
          id="closet-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          placeholder="Cream knit"
          className="mt-2 h-12 rounded-xl border border-black/8 bg-white px-4 text-[15px] outline-none"
        />
        <p className="mt-6 text-[12px] text-black/40">Role</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CLOSET_ROLES.map((item) => (
            <label key={item.id} className="cursor-pointer">
              <input
                type="radio"
                name="role"
                value={item.id}
                checked={role === item.id}
                onChange={() => setRole(item.id)}
                className="peer sr-only"
              />
              <span className="flex rounded-full bg-white px-3 py-1.5 text-[12px] peer-checked:bg-black peer-checked:text-white">
                {item.label}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-6 text-[12px] text-black/40">Color · optional</p>
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
          {CLOSET_COLOR_CHIPS.map((id) => (
            <label key={id} className="cursor-pointer">
              <input
                type="radio"
                name="color"
                value={id}
                checked={color === id}
                onChange={() => setColor(id)}
                className="peer sr-only"
              />
              <span
                className="block size-8 rounded-full border border-black/10 peer-checked:ring-2 peer-checked:ring-black peer-checked:ring-offset-2"
                style={{ background: closetColorFill(id) }}
                aria-label={closetChipAriaLabel(id)}
              />
            </label>
          ))}
        </div>
        {error ? <p className="mt-4 text-[13px] text-black/55">{error}</p> : null}
        <button type="submit" className={`${ctaPrimary} mt-10`} disabled={busy}>
          {busy ? "Saving…" : "Add to closet"}
        </button>
      </form>
    </div>
  );
}

export { ManualAdd as NoteAdd };
