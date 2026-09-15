"use client";

import { ScreenHeader } from "@/components/app-shell";
import { ctaPrimary, ctaSecondary } from "@/components/marks";
import { closetColorFill } from "@/lib/catalog";
import {
  closetBlobsUsingMemoryOnly,
  CUTOUT_BATCH_HARD_MAX,
  CUTOUT_WAIT_COPY,
  cutoutEnqueueBudget,
  cutoutQueueStats,
  discardCutoutJob,
  requeueCutoutJob,
  enqueueCutoutFiles,
  ensureCutoutPreview,
  firstReadyCutoutJob,
  getCutoutJobPreview,
  getCutoutJobRaw,
  getCutoutQueue,
  markCutoutJobSaved,
  startCutoutQueueWorker,
  subscribeCutoutQueue,
  updateCutoutJob,
  type CutoutQueueJob,
} from "@/lib/closet-cutout-queue";
import {
  categoryFromRole,
  CLOSET_ROLES,
  suggestedClosetName,
  CLOSET_COLOR_CHIPS,
  closetChipAriaLabel,
  roleFromCutoutHints,
} from "@/lib/closet-roles";
import {
  addClosetItems,
  closetIsFull,
  closetRemainingSlots,
  hydrateCloset,
} from "@/lib/closet-store";
import { bumpSessionAddedCount } from "@/lib/closet-session-added";
import type { ClosetRole, ColorId } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

type Screen = "pick" | "waiting" | "confirm";

export function PhotoAdd() {
  const router = useRouter();
  const [jobs, setJobs] = useState<CutoutQueueJob[]>([]);
  const [preview, setPreview] = useState("");
  const [previewStatus, setPreviewStatus] = useState<"loading" | "ok" | "requeued" | "expired" | "missing">("loading");
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [role, setRole] = useState<ClosetRole>("other");
  const [color, setColor] = useState<ColorId | "other">("other");
  const [cornersBusy, setCornersBusy] = useState(false);
  const [error, setError] = useState("");
  const [busySave, setBusySave] = useState(false);
  const [remaining, setRemaining] = useState(CUTOUT_BATCH_HARD_MAX);
  const [queuing, setQueuing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [memoryBanner, setMemoryBanner] = useState(false);
  const confirmIdRef = useRef<string | null>(null);

  const stats = useMemo(() => cutoutQueueStats(jobs), [jobs]);
  const readyJob = useMemo(() => firstReadyCutoutJob(jobs), [jobs]);
  const budget = useMemo(() => cutoutEnqueueBudget(), [jobs, remaining]);

  const screen: Screen = readyJob ? "confirm" : stats.isCutting || queuing ? "waiting" : "pick";

  useEffect(() => {
    hydrateCloset();
    startCutoutQueueWorker();
    setRemaining(closetRemainingSlots());
    if (closetIsFull() && !getCutoutQueue().some((j) => j.status === "ready" || j.status === "queued" || j.status === "processing")) {
      router.replace("/closet/upgrade");
      return;
    }
    const sync = () => {
      setJobs([...getCutoutQueue()]);
      setRemaining(closetRemainingSlots());
      if (closetBlobsUsingMemoryOnly()) setMemoryBanner(true);
    };
    sync();
    return subscribeCutoutQueue(sync);
  }, [router]);

  // Load confirm draft + cutout preview when the ready job changes.
  useEffect(() => {
    if (!readyJob) {
      confirmIdRef.current = null;
      setPreview("");
      setPreviewStatus("loading");
      return;
    }
    if (confirmIdRef.current !== readyJob.id) {
      confirmIdRef.current = readyJob.id;
      const nextColor = readyJob.color ?? readyJob.dominantColor ?? "other";
      // Orphan/legacy ready jobs may still be role "other" — bump so auto-name gets an item word.
      const nextRole =
        readyJob.role && readyJob.role !== "other"
          ? readyJob.role
          : roleFromCutoutHints(readyJob.fileHint || "", 0, 0, "other");
      const suggested = suggestedClosetName(nextColor, nextRole);
      const touched = Boolean(readyJob.nameTouched);
      setNameTouched(touched);
      setRole(nextRole);
      setColor(nextColor);
      setCornersBusy(Boolean(readyJob.cornersBusy));
      setError("");
      setPreview("");
      setPreviewStatus("loading");
      // Prefer regenerated name when role was coerced or name was never user-edited.
      setName(touched && readyJob.name ? readyJob.name : suggested || readyJob.fileHint || readyJob.name || "");
      if ((readyJob.role ?? "other") === "other" || (!touched && readyJob.name !== suggested)) {
        updateCutoutJob(readyJob.id, {
          role: nextRole,
          name: touched && readyJob.name ? readyJob.name : suggested || readyJob.fileHint || readyJob.name,
          color: nextColor,
          nameTouched: touched,
        });
      }
    }
    let cancelled = false;
    void ensureCutoutPreview(readyJob.id).then((result) => {
      if (cancelled) return;
      if (result.status === "ok") {
        setPreview(result.url);
        setPreviewStatus("ok");
        setError("");
      } else if (result.status === "requeued") {
        setPreview("");
        setPreviewStatus("requeued");
        // Job leaves ready → waiting screen; no infinite Loading flat tile…
      } else if (result.status === "expired") {
        setPreview("");
        setPreviewStatus("expired");
        setError(result.error || "Cutout expired — re-add the photo");
      } else {
        setPreview("");
        setPreviewStatus("missing");
        setError("Cutout isn’t available — skip and re-add the photo, or try Retry.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [readyJob]);

  // Keep auto-name in sync until the user edits.
  useEffect(() => {
    if (!readyJob || nameTouched) return;
    const suggested = suggestedClosetName(color, role);
    if (suggested) setName(suggested);
    else if (readyJob.fileHint) setName(readyJob.fileHint);
  }, [color, role, nameTouched, readyJob]);

  // Persist draft fields onto the job so leaving confirm mid-way is safe.
  useEffect(() => {
    if (!readyJob) return;
    const same =
      readyJob.name === name &&
      readyJob.role === role &&
      readyJob.color === color &&
      Boolean(readyJob.nameTouched) === nameTouched;
    if (same) return;
    updateCutoutJob(readyJob.id, { name, role, color, nameTouched });
  }, [readyJob, name, role, color, nameTouched]);

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const list = event.target.files;
    if (!list?.length) return;
    // Copy first — clearing the input before Array.from can drop the FileList on iOS.
    const files = Array.from(list).filter(
      (f) =>
        f.type.startsWith("image/") ||
        !f.type ||
        /\.heic$/i.test(f.name) ||
        /\.heif$/i.test(f.name)
    );
    event.target.value = "";
    if (!files.length) {
      setError("Couldn’t read that photo — try JPEG or PNG.");
      return;
    }
    hydrateCloset();
    if (closetIsFull() && budget <= 0) {
      router.replace("/closet/upgrade");
      return;
    }
    setError("");
    setFeedback("Got your photos — starting cutout…");
    setQueuing(true);
    try {
      const result = await enqueueCutoutFiles(files);
      setJobs([...getCutoutQueue()]);
      setRemaining(closetRemainingSlots());
      if (closetBlobsUsingMemoryOnly()) setMemoryBanner(true);
      if (!result.enqueued) {
        setQueuing(false);
        setFeedback("");
        if (closetIsFull()) router.replace("/closet/upgrade");
        else
          setError(
            `You can add up to ${CUTOUT_BATCH_HARD_MAX} photos at a time, and at most ${remaining} more into your free closet.`
          );
      } else {
        // Jobs are queued — waiting screen takes over via stats.isCutting.
        // Keep feedback briefly; Cutting… replaces once queuing flips off.
        setQueuing(false);
        setFeedback("");
        if (result.skipped) {
          setError(`Added ${result.enqueued}. Skipped ${result.skipped} — free closet or batch limit.`);
        }
      }
    } catch (err) {
      setQueuing(false);
      setFeedback("");
      setJobs([...getCutoutQueue()]);
      if (closetBlobsUsingMemoryOnly()) setMemoryBanner(true);
      const raw =
        err instanceof Error && err.message
          ? err.message
          : "Couldn’t queue those photos. Try again, or use JPEG/PNG.";
      const message = /idb|indexeddb|quota/i.test(raw)
        ? "Safari Private mode blocks photo storage. Open Atelier in a normal (non-Private) tab, then try again."
        : raw;
      setError(message);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!readyJob || busySave) return;
    if (closetIsFull()) {
      router.replace("/closet/upgrade");
      return;
    }
    setBusySave(true);
    setError("");
    try {
      const cutout = preview || (await getCutoutJobPreview(readyJob.id));
      if (!cutout) {
        setError("Flat tile isn’t ready yet.");
        return;
      }
      // Confirm already shows generative flat-lay; save that tile (not rembg).
      const raw = (await getCutoutJobRaw(readyJob.id)) || cutout;
      const trimmed = name.trim() || suggestedClosetName(color, role) || "Closet piece";
      const newPieceId = `photo-${Date.now()}`;
      const result = await addClosetItems([
        {
          id: newPieceId,
          name: trimmed,
          role,
          category: categoryFromRole(role),
          color,
          cutoutUrl: cutout,
          imageDataUrl: cutout,
          rawCutoutUrl: raw,
          flatLayStatus: "ready",
          source: "photo",
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
      await markCutoutJobSaved(readyJob.id);
      setJobs([...getCutoutQueue()]);
      setRemaining(closetRemainingSlots());

      // Stay on Photo-add for the next polished piece; no Style Creates from Save.
      const q = getCutoutQueue();
      const more =
        Boolean(firstReadyCutoutJob(q)) ||
        q.some((j) => j.status === "queued" || j.status === "processing");
      if (!more) {
        router.push("/closet");
      }
    } catch {
      setError("Couldn’t save to this device. Try again.");
    } finally {
      setBusySave(false);
    }
  }

  async function onSkip() {
    if (!readyJob) return;
    await discardCutoutJob(readyJob.id);
    setJobs([...getCutoutQueue()]);
  }

  async function onRetryPreview() {
    if (!readyJob) return;
    setError("");
    setPreviewStatus("loading");
    const result = await ensureCutoutPreview(readyJob.id);
    setJobs([...getCutoutQueue()]);
    if (result.status === "ok") {
      setPreview(result.url);
      setPreviewStatus("ok");
    } else if (result.status === "requeued") {
      setPreviewStatus("requeued");
    } else {
      setPreviewStatus(result.status);
      setError(result.error || "Cutout expired — re-add the photo");
    }
  }

  const maxAccept = Math.max(0, Math.min(CUTOUT_BATCH_HARD_MAX, budget || remaining));

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6">
      <ScreenHeader backHref="/closet" title="Photo" />
      <h1 className="font-serif text-[30px] leading-tight">
        {screen === "confirm" ? "Confirm piece" : screen === "waiting" ? "Polishing flat tiles" : "Add photos"}
      </h1>
      <p className="mt-2 text-[14px] leading-6 text-black/50">
        {screen === "pick"
          ? `Select up to ${Math.max(maxAccept, 1)} photos. Outfit shots split into polished flat tiles — tiles stay on this device.`
          : screen === "waiting"
            ? CUTOUT_WAIT_COPY
            : "Name, role, and color — then save. You're confirming a generative flat tile, not a quick cutout."}
      </p>
      <button
        type="button"
        className="mt-3 self-start text-[13px] font-medium text-black/70 underline underline-offset-2"
        onClick={() => router.push("/closet")}
      >
        Back to Closet
      </button>

      {memoryBanner ? (
        <p className="mt-3 rounded-xl bg-[#efe8dc] px-3 py-2.5 text-[12px] leading-5 text-black/60">
          This browser can’t save photos permanently (often Safari Private). Pieces work until you close the
          tab — use a normal tab to keep them.
        </p>
      ) : null}

      {stats.totalWork > 0 ? (
        <p className="mt-3 text-[12px] text-black/40">
          {stats.isCutting
            ? `Polishing ${stats.cuttingOf} of ${stats.cuttingTotal}…`
            : stats.hasReady
              ? `${stats.ready} ready to confirm${stats.error ? ` · ${stats.error} couldn’t cut` : ""}`
              : stats.error
                ? `${stats.error} couldn’t cut`
                : null}
        </p>
      ) : null}

      {screen === "waiting" ? (
        <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
          <div className="size-12 animate-pulse rounded-full bg-black/10" />
          <p className="mt-5 text-[15px] font-medium">
            {queuing ? feedback || "Queuing…" : `Polishing ${stats.cuttingOf} of ${stats.cuttingTotal}…`}
          </p>
          <p className="mt-2 max-w-xs text-[13px] leading-5 text-black/45">{CUTOUT_WAIT_COPY}</p>
          <p className="mt-2 max-w-xs text-[12px] leading-5 text-black/35">
            One at a time on this device. First load may take a moment while the model warms up.
          </p>
          <button
            type="button"
            className={`${ctaSecondary} mt-8`}
            onClick={() => router.push("/closet")}
          >
            Back to Closet
          </button>
          <p className="mt-2 max-w-xs text-[12px] leading-5 text-black/40">
            Queue keeps cutting in the background.
          </p>
          <button
            type="button"
            className="mt-4 text-[13px] text-black/45"
            onClick={() => router.push("/style")}
          >
            Keep styling
          </button>
        </div>
      ) : null}

      {screen === "pick" ? (
        <div className="mt-8 flex flex-1 flex-col">
          <label
            htmlFor="closet-photo-input"
            className={`flex aspect-[4/5] flex-col items-center justify-center rounded-3xl bg-[#e8e8e8] ${
              maxAccept <= 0 ? "pointer-events-none opacity-50" : "cursor-pointer"
            }`}
          >
            <span className="text-[14px] text-black/50">Tap to photograph or upload</span>
            <span className="mt-2 text-[12px] text-black/35">
              Multi-select · up to {Math.max(maxAccept, 0)} · women’s pieces
            </span>
            <input
              id="closet-photo-input"
              type="file"
              accept="image/*,image/heic,image/heif,.heic,.heif"
              multiple
              className="sr-only"
              disabled={maxAccept <= 0}
              onChange={onFiles}
            />
          </label>
          {jobs.some((j) => j.status === "error") ? (
            <ul className="mt-4 space-y-2">
              {jobs
                .filter((j) => j.status === "error")
                .map((j) => (
                  <li key={j.id} className="rounded-xl bg-[#efe8dc] px-3 py-2.5 text-[12px] leading-5 text-black/60">
                    {j.fileName}: {j.error}
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={() =>
                        void requeueCutoutJob(j.id).then((ok) => {
                          if (!ok) void discardCutoutJob(j.id);
                          setJobs([...getCutoutQueue()]);
                        })
                      }
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      className="ml-2 underline"
                      onClick={() => void discardCutoutJob(j.id).then(() => setJobs([...getCutoutQueue()]))}
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
          {error ? <p className="mt-4 text-[13px] text-black/55">{error}</p> : null}
          <p className="mt-6 text-center text-[12px] text-black/35">
            {remaining} free slot{remaining === 1 ? "" : "s"} left · batch max {CUTOUT_BATCH_HARD_MAX}
          </p>
          <button
            type="button"
            className={`${ctaSecondary} mt-6`}
            onClick={() => router.push("/closet")}
          >
            Back to Closet
          </button>
        </div>
      ) : null}

      {screen === "confirm" && readyJob ? (
        <form onSubmit={onSubmit} className="mt-6 flex flex-1 flex-col">
          <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-3xl bg-white">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Flat-lay preview" className="max-h-full max-w-full object-contain" />
            ) : previewStatus === "expired" || previewStatus === "missing" ? (
              <div className="px-6 text-center">
                <p className="text-[13px] text-black/55">
                  {previewStatus === "expired"
                    ? "Cutout expired — re-add the photo"
                    : "Cutout isn’t available on this device."}
                </p>
                {previewStatus === "missing" ? (
                  <button type="button" className="mt-3 text-[13px] underline text-black/50" onClick={() => void onRetryPreview()}>
                    Retry
                  </button>
                ) : null}
              </div>
            ) : previewStatus === "requeued" ? (
              <p className="text-[13px] text-black/40">Rebuilding flat tile…</p>
            ) : (
              <p className="text-[13px] text-black/40">Loading flat tile…</p>
            )}
          </div>
          {readyJob.fromSplit ? (
            <p className="mt-3 text-[12px] leading-5 text-black/45">
              Sliced from an outfit flat-lay sheet — confirm this piece, then the next one.
            </p>
          ) : null}
          {cornersBusy ? (
            <p className="mt-3 rounded-xl bg-[#efe8dc] px-3 py-2.5 text-[12px] leading-5 text-black/60">
              Corners still look busy — try a plainer surface if the cutout feels off.
            </p>
          ) : null}
          {stats.isCutting ? (
            <p className="mt-3 text-[12px] text-black/40">
              Saving won’t stop the queue — polishing {stats.cuttingOf} of {stats.cuttingTotal} in the background.
            </p>
          ) : null}
          <label className="mt-5 text-[12px] text-black/40" htmlFor="photo-name">
            Name
          </label>
          <input
            id="photo-name"
            value={name}
            onChange={(event) => {
              setNameTouched(true);
              setName(event.target.value);
            }}
            placeholder="cream sweater"
            className="mt-2 h-12 rounded-xl border border-black/8 bg-white px-4 text-[15px] outline-none"
          />
          {readyJob.fileHint && nameTouched ? (
            <p className="mt-1.5 text-[11px] text-black/35">From file: {readyJob.fileHint}</p>
          ) : null}
          <p className="mt-5 text-[12px] text-black/40">Role</p>
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
          <p className="mt-6 text-[12px] leading-5 text-black/40">
            Generative flat tile ready for your hang-rack. Save keeps this polish — not a messy cutout.
          </p>
          <button type="submit" className={`${ctaPrimary} mt-3`} disabled={busySave || !preview}>
            Save piece
          </button>
          <button type="button" className={`${ctaSecondary} mt-2.5`} onClick={() => void onSkip()}>
            Skip this photo
          </button>
          <button
            type="button"
            className={`${ctaSecondary} mt-3`}
            onClick={() => router.push("/closet")}
          >
            Back to Closet
          </button>
          <p className="mt-2 text-center text-[12px] leading-5 text-black/40">
            Queue keeps cutting in the background.
          </p>
          <button
            type="button"
            className="mt-4 text-center text-[13px] text-black/45"
            onClick={() => router.push("/style")}
          >
            Keep styling
          </button>
        </form>
      ) : null}
    </div>
  );
}
