"use client";

import { closetPacketOptionsForMode, closetToStylistPacket } from "@/lib/closet-packet";
import { ensureClosetImagesHydrated, hydrateCloset, loadCloset } from "@/lib/closet-store";
import { unvotedActiveBoardLooks } from "@/lib/home-lookbook";
import { loadLookVotes, upsertLookVote } from "@/lib/look-votes";
import { findCachedLooks } from "@/lib/stylist-client";
import type { StylistGenerateModeV1 } from "@/lib/stylist-contract";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** First submit proceeds; later clicks are ignored so look generation cannot double-fire. */
export function OnceForm({
  action,
  method = "post",
  className,
  children,
  generateMode = "storeFirst",
  closetPieceId,
}: {
  action: string;
  method?: "get" | "post";
  className?: string;
  children: ReactNode;
  /** Style my closet → closetFirst; Style a new outfit → storeFirst; How to style it → styleThisPiece. */
  generateMode?: StylistGenerateModeV1;
  /** Required when generateMode is styleThisPiece. */
  closetPieceId?: string;
}) {
  const submitted = useRef(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const pendingSubmitter = useRef<EventTarget | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [leftoverCount, setLeftoverCount] = useState(0);

  useEffect(() => {
    hydrateCloset();
    void ensureClosetImagesHydrated();
  }, []);

  function disable(submitter?: EventTarget | null) {
    const button = submitter instanceof HTMLButtonElement ? submitter : null;
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    }
  }

  function needsUnvotedGate(mode: StylistGenerateModeV1) {
    // Style a new outfit / Style my closet (and regenerate) replace the active board.
    return mode === "storeFirst" || mode === "closetFirst";
  }

  function readUnvotedLeftovers() {
    const board = findCachedLooks();
    if (!board?.looks?.length) return null;
    const votes = loadLookVotes();
    const leftovers = unvotedActiveBoardLooks(board.looks, votes, board.requestId);
    if (!leftovers.length) return null;
    return { board, leftovers };
  }

  function dismissLeftovers(boardRequestId: string, lookIds: string[]) {
    for (const lookId of lookIds) {
      // Persist as skip so they leave the active board and do not return as unreviewed.
      upsertLookVote({ requestId: boardRequestId, lookId, vote: "skip" });
    }
  }

  function commitSubmit(form: HTMLFormElement, submitter?: EventTarget | null) {
    if (submitted.current) return;
    if (method !== "get" && attachesCloset(action)) {
      submitted.current = true;
      disable(submitter);
      void (async () => {
        try {
          await ensureClosetImagesHydrated();
          injectClosetField(form, generateMode, closetPieceId);
          injectGenerateModeField(form, generateMode);
          injectClosetPieceIdField(form, generateMode, closetPieceId);
          injectTimezoneField(form);
        } catch {
          // Still submit without closet rather than leave the user on a dead button.
        }
        form.submit();
      })();
      return;
    }
    if (method !== "get" && (action.includes("generate") || action.includes("regenerate"))) {
      try {
        injectGenerateModeField(form, generateMode);
        injectClosetPieceIdField(form, generateMode, closetPieceId);
        injectTimezoneField(form);
      } catch {
        /* optional */
      }
    }
    submitted.current = true;
    disable(submitter);
    if (method !== "get") {
      form.submit();
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitted.current) {
      event.preventDefault();
      return;
    }
    const form = event.currentTarget;
    formRef.current = form;

    if (
      method !== "get" &&
      needsUnvotedGate(generateMode) &&
      (action.includes("generate") || action.includes("regenerate"))
    ) {
      const leftovers = readUnvotedLeftovers();
      if (leftovers) {
        event.preventDefault();
        pendingSubmitter.current = submitter;
        setLeftoverCount(leftovers.leftovers.length);
        setGateOpen(true);
        return;
      }
    }

    // Disable only after submit is committed — pointerdown-disable cancels the click in many browsers.
    if (method !== "get" && attachesCloset(action)) {
      event.preventDefault();
      commitSubmit(form, submitter);
      return;
    }
    if (method !== "get" && (action.includes("generate") || action.includes("regenerate"))) {
      try {
        injectGenerateModeField(form, generateMode);
        injectClosetPieceIdField(form, generateMode, closetPieceId);
        injectTimezoneField(event.currentTarget);
      } catch {
        /* optional */
      }
    }
    submitted.current = true;
    disable(submitter);
  }

  function onGateContinue() {
    const leftovers = readUnvotedLeftovers();
    if (leftovers) {
      dismissLeftovers(
        leftovers.board.requestId,
        leftovers.leftovers.map((look) => look.id)
      );
    }
    setGateOpen(false);
    const form = formRef.current;
    if (!form) return;
    commitSubmit(form, pendingSubmitter.current);
    pendingSubmitter.current = null;
  }

  function onGateBack() {
    setGateOpen(false);
    pendingSubmitter.current = null;
  }

  return (
    <>
      <form ref={formRef} action={action} method={method} className={className} onSubmit={onSubmit}>
        {children}
      </form>
      <UnvotedLooksGate
        open={gateOpen}
        leftoverCount={leftoverCount}
        onContinue={onGateContinue}
        onBack={onGateBack}
      />
    </>
  );
}

function UnvotedLooksGate({
  open,
  leftoverCount,
  onContinue,
  onBack,
}: {
  open: boolean;
  leftoverCount: number;
  onContinue: () => void;
  onBack: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onBack]);

  if (!open || typeof document === "undefined") return null;

  const countLabel =
    leftoverCount === 1 ? "1 look on this board still has no vote" : `${leftoverCount} looks on this board still have no vote`;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-4 pb-8 pt-16 sm:items-center sm:pb-0"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onBack();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unvoted-looks-gate-title"
        className="w-full max-w-[400px] rounded-3xl bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <p id="unvoted-looks-gate-title" className="font-serif text-[22px] leading-tight tracking-tight">
          Love these first?
        </p>
        <p className="mt-3 text-[14px] leading-6 text-black/55">
          {countLabel}. Continuing removes leftover looks from this board — Wear or Maybe any you want to keep in your
          Lookbook first.
        </p>
        <button
          type="button"
          onClick={onContinue}
          className="mt-5 flex h-11 w-full items-center justify-center rounded-2xl bg-black px-3 text-[14px] font-medium text-white"
        >
          Continue
        </button>
        <button
          type="button"
          onClick={onBack}
          className="mt-2 flex h-10 w-full items-center justify-center text-[13px] text-black/50"
        >
          Back to these looks
        </button>
      </div>
    </div>,
    document.body
  );
}

function attachesCloset(action: string) {
  return action.includes("generate") || action.includes("regenerate");
}

function injectClosetField(form: HTMLFormElement, mode: StylistGenerateModeV1, pieceId?: string) {
  const loaded = loadCloset();
  const packetOpts = closetPacketOptionsForMode(mode, {
    closetPieceId: pieceId,
    closetLength: loaded.length,
  });
  const forceAll = Boolean(packetOpts.forceAllImages);
  const focusPieceId = packetOpts.focusPieceId;
  const items = loaded.map((item) => {
    const shouldCompress =
      forceAll || (Boolean(focusPieceId) && item.id === focusPieceId);
    if (!shouldCompress) return item;
    const raw = item.cutoutUrl || item.imageDataUrl || "";
    if (!raw.startsWith("data:") || raw.length <= 80_000) return item;
    const compressed = compressCutoutIfHuge(raw);
    if (!compressed || compressed === raw) return item;
    return { ...item, cutoutUrl: compressed, imageDataUrl: compressed };
  });
  const closet = closetToStylistPacket(items, packetOpts);
  const value = closet.length ? JSON.stringify(closet) : "";
  const existing = form.querySelector('input[name="closetJson"]');
  if (existing instanceof HTMLInputElement) {
    existing.value = value;
    return;
  }
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "closetJson";
  input.value = value;
  form.appendChild(input);
}

function injectGenerateModeField(form: HTMLFormElement, mode: StylistGenerateModeV1) {
  const existing = form.querySelector('input[name="generateMode"]');
  if (existing instanceof HTMLInputElement) {
    existing.value = mode;
    return;
  }
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "generateMode";
  input.value = mode;
  form.appendChild(input);
}

function injectClosetPieceIdField(
  form: HTMLFormElement,
  mode: StylistGenerateModeV1,
  pieceId?: string
) {
  const existing = form.querySelector('input[name="closetPieceId"]');
  if (mode !== "styleThisPiece" || !pieceId?.trim()) {
    if (existing) existing.remove();
    return;
  }
  const value = pieceId.trim();
  if (existing instanceof HTMLInputElement) {
    existing.value = value;
    return;
  }
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "closetPieceId";
  input.value = value;
  form.appendChild(input);
}

function injectTimezoneField(form: HTMLFormElement) {
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    tz = "";
  }
  if (!tz) return;
  const existing = form.querySelector('input[name="timezone"]');
  if (existing instanceof HTMLInputElement) {
    existing.value = tz;
    return;
  }
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "timezone";
  input.value = tz;
  form.appendChild(input);
}

/** Shrink huge data-URL cutouts before closet packet submit (best-effort; force-include still applies). */
function compressCutoutIfHuge(dataUrl: string, maxEdge = 512): string {
  try {
    if (typeof document === "undefined") return dataUrl;
    const img = new Image();
    img.src = dataUrl;
    // sync path only works if already cached; otherwise keep original (force-include covers size)
    if (!img.complete || !img.naturalWidth) return dataUrl;
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale >= 1 && dataUrl.length <= 80_000) return dataUrl;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}
