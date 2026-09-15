"use client";

import { BrandWord } from "@/components/app-shell";
import { showAtelierToast } from "@/components/atelier-toast";
import { PieceGrid } from "@/components/look-detail-live";
import { applyLookVoteToHistory } from "@/lib/liked-looks";
import {
  dismissPieceStyleLook,
  enqueueStyleThisPiece,
  markPieceStylePending,
  markPieceStyleReady,
  PIECE_STYLE_LOOK_TARGET,
  pieceStyleDismissedSet,
  readPieceStyleEntry,
  subscribePieceStyleCache,
} from "@/lib/piece-style-cache";
import { findCachedLooks, rememberLookRequestId, writeCachedLooks } from "@/lib/stylist-client";
import type { StylistLookV1, StylistPieceV1, StylistResponseV1 } from "@/lib/stylist-contract";
import type { ClosetItem } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ctaSecondary } from "@/components/marks";

/** Solid white plate behind alpha cutouts — never checkerboard (Luisa lock). */
const CUTOUT_PLATE = "bg-white";

/**
 * How to style it — dedicated Closet-tab wait + results (Luisa mock).
 * Not Lookbook. Not LookBoard collage.
 * Row: YOURS tile | + | 2–3 shoppable store tiles (no Look N caption).
 */
export function StyleThisPiecePanel({
  piece,
  requestId,
}: {
  piece: ClosetItem;
  requestId: string;
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<StylistResponseV1 | null>(null);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState<Set<string>>(() => pieceStyleDismissedSet(piece.id));
  const [refillPending, setRefillPending] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const refillInFlight = useRef(false);
  const pollIdsRef = useRef<string[]>([requestId]);

  const refreshDismissed = useCallback(() => {
    setDismissed(pieceStyleDismissedSet(piece.id));
    const entry = readPieceStyleEntry(piece.id);
    setRefillPending(Boolean(entry?.pendingRefillRequestId));
  }, [piece.id]);

  useEffect(() => {
    refreshDismissed();
    return subscribePieceStyleCache(refreshDismissed);
  }, [refreshDismissed]);

  useEffect(() => {
    pollIdsRef.current = [requestId];
    const entry = readPieceStyleEntry(piece.id);
    if (entry?.pendingRefillRequestId) {
      pollIdsRef.current = [...new Set([requestId, entry.pendingRefillRequestId])];
      setRefillPending(true);
    }
  }, [requestId, piece.id]);

  useEffect(() => {
    if (!requestId) return;
    rememberLookRequestId(requestId);
    const cached = findCachedLooks([requestId]);
    if (cached?.looks.length && cached.requestId === requestId) {
      setPayload(cached);
      markPieceStyleReady(piece.id, cached);
    }

    let cancelled = false;
    const tick = async () => {
      const ids = [...pollIdsRef.current];
      for (const id of ids) {
        try {
          const res = await fetch(`/api/stylist/looks?requestId=${encodeURIComponent(id)}`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!res.ok) continue;
          const data = (await res.json()) as { status?: string; response?: StylistResponseV1 };
          if (cancelled || !data.response?.looks?.length) continue;
          if (data.response.requestId && data.response.requestId !== id) continue;
          try {
            writeCachedLooks(data.response);
          } catch {
            /* cache optional */
          }
          const isRefill = id !== requestId;
          markPieceStyleReady(piece.id, data.response, { mergeLookIds: isRefill });
          if (isRefill) {
            setPayload((prev) => mergeLooks(prev, data.response!, pieceStyleDismissedSet(piece.id)));
            setRefillPending(false);
            refillInFlight.current = false;
            pollIdsRef.current = [requestId];
          } else {
            setPayload(data.response);
          }
          setError("");
          refreshDismissed();
        } catch {
          if (!cancelled) setError("Still working — check back in a moment.");
        }
      }
    };

    void tick();
    const timer = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [requestId, piece.id, refreshDismissed]);

  const visibleLooks = useMemo(() => {
    const looks = payload?.looks ?? [];
    return looks.filter((look) => !dismissed.has(look.id)).slice(0, PIECE_STYLE_LOOK_TARGET);
  }, [payload, dismissed]);

  // Show at most one "Getting another idea…" when refill is pending or in flight.
  const showRefillPlaceholder = refillPending || (visibleLooks.length < PIECE_STYLE_LOOK_TARGET && refillInFlight.current);

  const onLike = useCallback(
    (look: StylistLookV1) => {
      const rid = payload?.requestId || requestId;
      applyLookVoteToHistory({ requestId: rid, look, vote: "wear" });
      setLikedIds((prev) => new Set(prev).add(look.id));
      showAtelierToast("Saved to your Lookbook");
    },
    [payload?.requestId, requestId]
  );

  const onDislike = useCallback(
    (look: StylistLookV1) => {
      dismissPieceStyleLook(piece.id, look.id);
      applyLookVoteToHistory({ requestId: payload?.requestId || requestId, look, vote: "no" });
      setDismissed(pieceStyleDismissedSet(piece.id));
      setLikedIds((prev) => {
        const next = new Set(prev);
        next.delete(look.id);
        return next;
      });

      if (refillInFlight.current) {
        setRefillPending(true);
        return;
      }
      refillInFlight.current = true;
      setRefillPending(true);
      void (async () => {
        const result = await enqueueStyleThisPiece(piece.id);
        if (!result.ok) {
          refillInFlight.current = false;
          setRefillPending(false);
          setError(result.error || "Couldn’t get another idea.");
          return;
        }
        markPieceStylePending(piece.id, result.requestId, { refill: true });
        pollIdsRef.current = [...new Set([requestId, result.requestId])];
      })();
    },
    [piece.id, payload?.requestId, requestId]
  );

  // If ready payload is entirely dismissed, kick a refill so the page isn't empty.
  useEffect(() => {
    if (!payload?.looks?.length) return;
    if (visibleLooks.length > 0) return;
    if (refillInFlight.current || refillPending) return;
    refillInFlight.current = true;
    setRefillPending(true);
    void (async () => {
      const result = await enqueueStyleThisPiece(piece.id);
      if (!result.ok) {
        refillInFlight.current = false;
        setRefillPending(false);
        setError(result.error || "Couldn’t get another idea.");
        return;
      }
      markPieceStylePending(piece.id, result.requestId, { refill: true });
      pollIdsRef.current = [...new Set([requestId, result.requestId])];
    })();
  }, [payload, visibleLooks.length, refillPending, piece.id, requestId]);

  const cutout = piece.cutoutUrl || piece.imageDataUrl || "";
  const ready = visibleLooks.length > 0;

  return (
    <section data-style-this-piece={ready ? "ready" : "pending"} data-request-id={requestId}>
      <header className="flex items-center justify-between">
        <BrandWord className="text-[20px]" />
        <button
          type="button"
          className="flex size-8 items-center justify-center text-black/50"
          aria-label="Back to Closet"
          onClick={() => router.push("/closet")}
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      <h1 className="mt-6 font-serif text-[32px] leading-[1.1] tracking-tight">How to style it</h1>
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

      {!ready && !showRefillPlaceholder ? (
        <>
          <p className="mt-8 text-[12px] tracking-[0.14em] text-black/40 uppercase">Styling this piece…</p>
          <p className="mt-2 font-serif text-[22px] leading-tight text-black/70">
            Generating your looks…
          </p>
          <p className="mt-1 text-[13px] text-black/45">Almost ready…</p>
          <div className="mt-6 space-y-3">
            {[0, 1].map((slot) => (
              <div
                key={slot}
                className="flex items-center gap-2 rounded-2xl border border-black/8 bg-white p-2.5"
              >
                <div
                  className={`flex aspect-[3/4] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/6 ${CUTOUT_PLATE}`}
                >
                  {cutout ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cutout} alt="" className="max-h-full max-w-full object-contain p-1" />
                  ) : (
                    <span className="px-1 text-center text-[9px] text-black/35">YOURS</span>
                  )}
                </div>
                <div className="flex items-center justify-center px-1 text-black/30" aria-hidden>
                  <span className="text-[14px] leading-none">+</span>
                </div>
                <div className="flex flex-1 gap-1.5">
                  {[0, 1, 2].map((tile) => (
                    <div key={tile} className="aspect-square flex-1 animate-pulse rounded-xl bg-[#fafafa]" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 h-1 overflow-hidden rounded-full bg-black/8">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-black/35" />
          </div>
          {error ? <p className="mt-4 text-[13px] text-black/45">{error}</p> : null}
          <button
            type="button"
            className={`${ctaSecondary} mt-8`}
            onClick={() => router.push("/closet")}
          >
            Back to Closet
          </button>
          <p className="mt-2 text-center text-[12px] leading-5 text-black/40">
            Styling continues in the background.
          </p>
        </>
      ) : (
        <div className="mt-6 space-y-3">
          {visibleLooks.map((look, index) => (
            <StyleThisPieceLookRow
              key={look.id}
              look={look}
              index={index}
              closetPiece={piece}
              closetPieceId={piece.id}
              liked={likedIds.has(look.id)}
              onLike={() => onLike(look)}
              onDislike={() => onDislike(look)}
            />
          ))}
          {showRefillPlaceholder ? <RefillPlaceholder cutout={cutout} /> : null}
          {error ? <p className="mt-2 text-[13px] text-black/45">{error}</p> : null}
          <button
            type="button"
            className={`${ctaSecondary} mt-6`}
            onClick={() => router.push("/closet")}
          >
            Back to Closet
          </button>
          <p className="mt-2 text-center text-[12px] leading-5 text-black/40">
            Styling continues in the background.
          </p>
        </div>
      )}
    </section>
  );
}

function mergeLooks(
  prev: StylistResponseV1 | null,
  incoming: StylistResponseV1,
  dismissed: Set<string>
): StylistResponseV1 {
  const byId = new Map<string, StylistLookV1>();
  for (const look of prev?.looks ?? []) {
    if (!dismissed.has(look.id)) byId.set(look.id, look);
  }
  for (const look of incoming.looks ?? []) {
    if (dismissed.has(look.id)) continue;
    if (!byId.has(look.id)) byId.set(look.id, look);
  }
  const looks = [...byId.values()].slice(0, PIECE_STYLE_LOOK_TARGET);
  return {
    ...incoming,
    requestId: prev?.requestId || incoming.requestId,
    looks,
  };
}

function RefillPlaceholder({ cutout }: { cutout: string }) {
  return (
    <div
      className="rounded-2xl border border-black/8 bg-white p-2.5"
      data-style-this-piece-slot="refill"
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex aspect-[3/4] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/6 ${CUTOUT_PLATE}`}
        >
          {cutout ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cutout} alt="" className="max-h-full max-w-full object-contain p-1" />
          ) : (
            <span className="px-1 text-center text-[9px] text-black/35">YOURS</span>
          )}
        </div>
        <div className="flex items-center justify-center px-1 text-black/30" aria-hidden>
          <span className="text-[14px] leading-none">+</span>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((tile) => (
              <div key={tile} className="aspect-square flex-1 animate-pulse rounded-xl bg-[#fafafa]" />
            ))}
          </div>
          <p className="text-[11px] leading-4 text-black/40">Getting another idea…</p>
        </div>
      </div>
    </div>
  );
}

/** Mock row: YOURS | + | store tiles. Tap to expand shoppable piece list (Look detail pattern). */
export function StyleThisPieceLookRow({
  look,
  index: _index,
  closetPiece,
  closetPieceId,
  liked = false,
  onLike,
  onDislike,
}: {
  look: StylistLookV1;
  index: number;
  closetPiece?: ClosetItem | null;
  closetPieceId?: string;
  liked?: boolean;
  onLike?: () => void;
  onDislike?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lockedId = closetPieceId?.trim() || closetPiece?.id;
  const storePieces = (look.pieces ?? [])
    .filter((p) => !lockedId || p.id !== lockedId)
    .slice(0, 3);
  const cutout = closetPiece?.cutoutUrl || closetPiece?.imageDataUrl || "";
  const closetFromLook = lockedId
    ? (look.pieces ?? []).find((p) => p.id === lockedId)
    : undefined;
  const closetImage = cutout || closetFromLook?.image || "";
  const closetName = closetPiece?.name || closetFromLook?.name || "Your piece";
  const allPieces = look.pieces ?? [];
  const levelUp = Array.isArray(look.levelUp) ? look.levelUp : [];

  return (
    <article
      className="rounded-2xl border border-black/8 bg-white p-2.5"
      data-look-expanded={expanded ? "true" : "false"}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse look" : "Expand look to shop pieces"}
        onClick={() => setExpanded((open) => !open)}
      >
        <div className="w-[78px] shrink-0">
          <p className="mb-1 text-center text-[10px] font-semibold tracking-[0.12em] text-black uppercase">
            Yours
          </p>
          <div
            className={`flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-black/6 ${CUTOUT_PLATE}`}
          >
            {closetImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={closetImage} alt={closetName} className="max-h-full max-w-full object-contain p-1.5" />
            ) : (
              <span className="px-1 text-center text-[10px] text-black/40">{closetName}</span>
            )}
          </div>
        </div>

        <div
          className="flex shrink-0 items-center justify-center self-center px-0.5 pt-4 text-black/55"
          aria-hidden
        >
          <span className="text-[15px] leading-none font-light">+</span>
        </div>

        <div className="min-w-0 flex-1 pt-4">
          <div className="flex gap-1.5">
            {storePieces.length ? (
              storePieces.map((piece) => <StoreTile key={piece.id} piece={piece} />)
            ) : (
              <p className="py-6 text-[12px] text-black/40">Suggestions incoming…</p>
            )}
          </div>
        </div>
      </button>

      {onLike || onDislike ? (
        /* Centered circular X (pass) + heart (like) — same pattern as quiz style-deck. */
        <div className="mt-2.5 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Pass"
            onClick={(event) => {
              event.stopPropagation();
              onDislike?.();
            }}
            className="flex size-12 items-center justify-center rounded-full border border-black/15 bg-white text-black"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
              <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Like"
            aria-pressed={liked}
            onClick={(event) => {
              event.stopPropagation();
              onLike?.();
            }}
            className="flex size-12 items-center justify-center rounded-full bg-black text-white"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
              <path d="M12 20.1s-6.4-3.9-8.6-7.2C1.7 10.4 2.4 7 5.2 6.1c1.7-.6 3.4.1 4.3 1.5L12 10l2.5-2.4c.9-1.4 2.6-2.1 4.3-1.5 2.8.9 3.5 4.3 1.8 6.8-2.2 3.3-8.6 7.2-8.6 7.2Z" />
            </svg>
          </button>
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-3 border-t border-black/8 pt-3" data-look-expand="pieces">
          <p className="text-[11px] tracking-[0.14em] text-black/40 uppercase">Shop the look</p>
          {allPieces.length ? <PieceGrid pieces={allPieces} /> : (
            <p className="mt-2 text-[12px] text-black/40">No pieces yet.</p>
          )}
          {levelUp.length ? (
            <div className="mt-4">
              <p className="text-[11px] tracking-[0.14em] text-black/40 uppercase">Elevate</p>
              <PieceGrid pieces={levelUp} />
            </div>
          ) : null}
          <button
            type="button"
            className="mt-3 text-[12px] text-black/45 underline underline-offset-2"
            onClick={() => setExpanded(false)}
          >
            Collapse
          </button>
        </div>
      ) : null}
    </article>
  );
}

/** Compact preview tile — shop links live in the expanded PieceGrid. */
function StoreTile({ piece }: { piece: StylistPieceV1 }) {
  return (
    <div
      className={`flex aspect-square min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-black/8 ${CUTOUT_PLATE}`}
    >
      {piece.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={piece.image} alt={piece.name} className="max-h-full max-w-full object-contain p-1" />
      ) : (
        <span className="px-1 text-center text-[9px] text-black/35">{piece.name}</span>
      )}
    </div>
  );
}
