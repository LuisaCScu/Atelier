"use client";

import { applyLookVoteToHistory, canSaveLikedLook, likedLookId, loadLikedLooks, normalizeLikedVote, type LikedLookVote, voteKeepsHistory } from "@/lib/liked-looks";
import { lookFittingUrl } from "@/lib/freemium";
import { pickLookDislikeReasons } from "@/lib/style-signals";
import type { StylistLookV1 } from "@/lib/stylist-contract";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { showAtelierToast } from "@/components/atelier-toast";

type Vote = LikedLookVote;

function lookSnapshot(look: StylistLookV1) {
  const extras = look as StylistLookV1 & { aesthetics?: string[]; vibe?: string };
  return {
    title: look.title,
    hook: look.hook,
    formula: look.formula,
    why: look.why,
    heroImage: look.heroImage,
    fittingUrl: lookFittingUrl(look),
    pieces: look.pieces.map((piece) => ({
      id: piece.id,
      role: piece.role,
      name: piece.name,
      brand: piece.brand,
      price: piece.price,
      currency: piece.currency,
      image: piece.image,
      shopUrl: piece.shopUrl,
    })),
    lookTotal: look.lookTotal,
    aesthetics: Array.isArray(extras.aesthetics) ? extras.aesthetics : undefined,
    vibe: typeof extras.vibe === "string" ? extras.vibe : undefined,
  };
}

async function postLookVote(input: {
  requestId?: string;
  lookId: string;
  vote: Vote;
  reasons?: string[];
  look: ReturnType<typeof lookSnapshot>;
}) {
  const res = await fetch("/api/style/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("save failed");
}

export function LookFeedback({
  look,
  requestId,
  initialVote,
  initialReasons = [],
  budgetMax,
  onDisposition,
}: {
  look: StylistLookV1;
  requestId?: string;
  initialVote?: Vote;
  initialReasons?: string[];
  budgetMax?: number;
  /** Fired after local vote persist — Lookbook uses this to drop No / soft-Saved Wear+Maybe. */
  onDisposition?: (vote: Vote) => void;
}) {
  return (
    <LookVotePanel
      look={look}
      requestId={requestId}
      initialVote={initialVote}
      initialReasons={initialReasons}
      budgetMax={budgetMax}
      layout="detail"
      onDisposition={onDisposition}
    />
  );
}

export function LookCardVotes({
  look,
  requestId,
  initialVote,
  initialReasons = [],
  budgetMax,
  onDisposition,
}: {
  look: StylistLookV1;
  requestId?: string;
  initialVote?: Vote;
  initialReasons?: string[];
  budgetMax?: number;
  onDisposition?: (vote: Vote) => void;
}) {
  return (
    <LookVotePanel
      look={look}
      requestId={requestId}
      initialVote={initialVote}
      initialReasons={initialReasons}
      budgetMax={budgetMax}
      layout="card"
      onDisposition={onDisposition}
    />
  );
}

function LookVotePanel({
  look,
  requestId,
  initialVote,
  initialReasons: _initialReasons,
  budgetMax,
  layout,
  onDisposition,
}: {
  look: StylistLookV1;
  requestId?: string;
  initialVote?: Vote;
  initialReasons: string[];
  budgetMax?: number;
  layout: "detail" | "card";
  onDisposition?: (vote: Vote) => void;
}) {
  // Later: 1–5 ratings can sit beside Wear without replacing No → 4 look-specific reasons.
  const options = useMemo(() => pickLookDislikeReasons(look, { budgetMax }), [look, budgetMax]);
  const [vote, setVote] = useState<Vote | undefined>(initialVote);
  const [modalOpen, setModalOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const compact = layout === "card";

  async function persist(nextVote: Vote, nextReasons: string[] = [], opts?: { localAlready?: boolean }) {
    if (!opts?.localAlready) {
      applyLookVoteToHistory({ requestId: requestId ?? "unknown", look, vote: nextVote });
      onDisposition?.(nextVote);
    }
    setPending(true);
    setError("");
    try {
      await postLookVote({
        requestId,
        lookId: look.id,
        vote: nextVote,
        reasons: nextReasons,
        look: lookSnapshot(look),
      });
    } catch {
      setError("Couldn’t save that note. Try again.");
    } finally {
      setPending(false);
    }
  }

  /** Optimistic local hide + Lookbook update before any await. */
  function commitLocal(nextVote: Vote) {
    applyLookVoteToHistory({ requestId: requestId ?? "unknown", look, vote: nextVote });
    onDisposition?.(nextVote);
  }

  function onWear() {
    if (normalizeLikedVote(vote ?? "skip") === "like") {
      setVote(undefined);
      setModalOpen(false);
      setCelebrate(false);
      commitLocal("no");
      void persist("no", [], { localAlready: true });
      return;
    }
    if (!canSaveToLookbook("wear")) return;
    setVote("wear");
    setModalOpen(false);
    setCelebrate(true);
    window.setTimeout(() => setCelebrate(false), 2000);
    showAtelierToast("This look moved to your Lookbook");
    commitLocal("wear");
    void persist("wear", [], { localAlready: true });
  }

  function onMaybe() {
    if (!canSaveToLookbook("maybe")) return;
    setVote("maybe");
    setModalOpen(false);
    setCelebrate(false);
    showAtelierToast("This look moved to your Lookbook");
    commitLocal("maybe");
    void persist("maybe", [], { localAlready: true });
  }

  function canSaveToLookbook(nextVote: Vote): boolean {
    if (!voteKeepsHistory(nextVote)) return true;
    const id = likedLookId(requestId ?? "unknown", look.id);
    if (canSaveLikedLook(loadLikedLooks(), id)) return true;
    showAtelierToast("Free Lookbook holds 10 looks. Remove one to save another.");
    return false;
  }

  function onNo() {
    // Hide tile immediately (optimistic), sync vote API in background.
    setVote("no");
    setCelebrate(false);
    commitLocal("no");
    showAtelierToast("Sorry this was a miss — hope you’re obsessed with the next one");
    if (compact) {
      // Card unmounts on hide — skip reason modal so it does not flash then die.
      void persist("no", ["skip"], { localAlready: true });
      return;
    }
    // Detail: persist No now; reason modal can patch reasons afterward.
    void persist("no", ["skip"], { localAlready: true });
    setModalOpen(true);
  }

  function closeDislike(nextReasons: string[]) {
    setModalOpen(false);
    setVote("no");
    // Detail: local vote may already be applied; patch reasons via API.
    if (!vote || normalizeLikedVote(vote) !== "dislike") {
      commitLocal("no");
    }
    void persist("no", nextReasons, { localAlready: true });
  }

  return (
    <section className={`relative overflow-hidden ${compact ? "mt-2" : "mt-8 rounded-2xl bg-white px-4 py-4"}`}>
      {celebrate ? <GlitterBurst compact={compact} /> : null}
      {compact ? null : <p className="text-[11px] tracking-[0.16em] text-black/40 uppercase">This look</p>}
      <div className={`flex gap-2 ${compact ? "" : "mt-3"}`}>
        <VoteButton compact={compact} active={normalizeLikedVote(vote ?? "skip") === "like"} disabled={pending} onClick={onWear}>
          <HeartMini />
          Wear
        </VoteButton>
        <VoteButton compact={compact} active={normalizeLikedVote(vote ?? "skip") === "skip" && Boolean(vote)} disabled={pending} onClick={onMaybe}>
          Maybe
        </VoteButton>
        <VoteButton compact={compact} active={normalizeLikedVote(vote ?? "skip") === "dislike"} disabled={pending} onClick={onNo}>
          <XMini />
          No
        </VoteButton>
      </div>

      {error ? <p className="mt-3 text-[13px] text-black/50">{error}</p> : null}

      <DislikeReasonModal
        open={modalOpen}
        options={options}
        pending={pending}
        onPick={(id) => closeDislike([id])}
        onSkip={() => closeDislike(["skip"])}
      />
    </section>
  );
}

function DislikeReasonModal({
  open,
  options,
  pending,
  onPick,
  onSkip,
}: {
  open: boolean;
  options: Array<{ id: string; label: string }>;
  pending: boolean;
  onPick: (id: string) => void;
  onSkip: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSkip();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onSkip]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-4 pb-8 pt-16 sm:items-center sm:pb-0"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!pending) onSkip();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dislike-reason-title"
        className="w-full max-w-[400px] rounded-3xl bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <p id="dislike-reason-title" className="font-serif text-[22px] leading-tight tracking-tight">
          Sorry this didn’t hit — what missed?
        </p>
        <div className="mt-4 grid gap-2">
          {options.map((reason) => (
            <button
              key={reason.id}
              type="button"
              disabled={pending}
              onClick={() => onPick(reason.id)}
              className="flex h-11 items-center justify-center rounded-2xl bg-[#f3f3f3] px-3 text-[14px] font-medium text-black disabled:opacity-40"
            >
              {reason.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onSkip}
          className="mt-3 flex h-10 w-full items-center justify-center text-[13px] text-black/50 disabled:opacity-40"
        >
          Skip
        </button>
      </div>
    </div>,
    document.body
  );
}

function VoteButton({
  compact,
  active,
  disabled,
  onClick,
  children,
}: {
  compact?: boolean;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full font-medium ${
        compact ? "h-8 text-[11px]" : "h-11 text-[14px]"
      } ${active ? "bg-black text-white" : "bg-[#f3f3f3] text-black"}`}
    >
      {children}
    </button>
  );
}

function HeartMini() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
      <path d="M12 20.1s-6.4-3.9-8.6-7.2C1.7 10.4 2.4 7 5.2 6.1c1.7-.6 3.4.1 4.3 1.5L12 10l2.5-2.4c.9-1.4 2.6-2.1 4.3-1.5 2.8.9 3.5 4.3 1.8 6.8-2.2 3.3-8.6 7.2-8.6 7.2Z" />
    </svg>
  );
}

function XMini() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden>
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function GlitterBurst({ compact }: { compact?: boolean }) {
  const motes = [
    [18, 28, 0],
    [72, 22, 90],
    [38, 62, 160],
    [82, 58, 40],
    [52, 16, 220],
    [12, 54, 120],
    [64, 44, 180],
    [46, 34, 30],
  ] as const;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(201,168,106,0.22),transparent_58%)]" />
      {motes.map(([left, top, delay], index) => (
        <span
          key={index}
          className={`absolute rounded-full bg-[#c9a86a] ${compact ? "size-1" : "size-1.5"}`}
          style={{
            left: `${left}%`,
            top: `${top}%`,
            boxShadow: "0 0 8px rgba(201,168,106,0.7)",
            animation: `atelier-glitter 2s ease-out ${delay}ms both`,
          }}
        />
      ))}
      <style>{`
        @keyframes atelier-glitter {
          0% { transform: translate3d(0, 6px, 0) scale(0.35); opacity: 0; }
          20% { opacity: 0.95; }
          100% { transform: translate3d(0, -12px, 0) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
