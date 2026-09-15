"use client";

import { AppShell, BrandWord } from "@/components/app-shell";
import { ClosetInvite } from "@/components/closet/closet-invite";
import { SlidersIcon } from "@/components/marks";
import { findCachedLooks, rememberLookRequestId, writeCachedLooks } from "@/lib/stylist-client";
import { LookBoard } from "@/components/look-board";
import { OnceForm } from "@/components/once-form";
import { StyleGenerateCtas } from "@/components/style-generate-ctas";
import { quotaMessage, useStylistBudget } from "@/components/generate-quota-note";
import { LookCardTotals } from "@/components/look-totals";
import { LookCardVotes } from "@/components/look-feedback";
import type { GenerateAccess } from "@/lib/freemium";
import { FITTINGS_PARKED, lookFittingLocked } from "@/lib/freemium";
import {
  filterActiveBoardLooks,
  isSavedArchiveVote,
  type HomeLookVote,
} from "@/lib/home-lookbook";
import { normalizeLikedVote, type LikedLookVote } from "@/lib/liked-looks";
import { loadLookVotes, mergeHomeVotes, subscribeLookVotes } from "@/lib/look-votes";
import { lookbookCardTitle,
  lookCardLine,
  type StylistGenerateModeV1,
  type StylistLookV1,
  type StylistResponseV1,
} from "@/lib/stylist-contract";
import { useEffect, useMemo, useState } from "react";

type Props = {
  name: string;
  budgetMax: number;
  sizeLine: string;
  requestIds: string[];
  initial: StylistResponseV1 | null;
  cachedHint?: boolean;
  generateUserKey?: string | null;
  quotaExhausted?: boolean;
  freeBoard?: boolean;
  generateMode?: StylistGenerateModeV1;
  fittingCount?: number;
  generateAccess?: GenerateAccess;
  lookVotes?: Array<{ lookId: string; vote: "like" | "dislike" | "skip"; reasons?: string[]; requestId?: string }>;
  /** Active styleThisPiece request pending — keep prior looks; never empty Generating takeover. */
  pendingStyleThisPiece?: { requestId: string; closetPieceId?: string; ready?: boolean } | null;
  /** storeFirst/closetFirst pending — keep prior board + Generating badge. */
  pendingGenerate?: { requestId: string; generateMode?: StylistGenerateModeV1 } | null;
  /** Four-bucket Style tab: pin Create new looks (+ quiet closet) above wait/board. */
  showStyleCtas?: boolean;
  /** First-board-only auto storeFirst — never regenerate. */
  autoFirstStoreFirst?: boolean;
};

export function LookbookLive({
  name,
  budgetMax,
  sizeLine: _sizeLine,
  requestIds,
  initial,
  cachedHint: _cachedHint = false,
  generateUserKey,
  quotaExhausted = false,
  freeBoard = false,
  generateMode,
  fittingCount,
  generateAccess: access = "free",
  lookVotes = [],
  pendingStyleThisPiece = null,
  pendingGenerate = null,
  showStyleCtas = false,
  autoFirstStoreFirst = false,
}: Props) {
  const [payload, setPayload] = useState<StylistResponseV1 | null>(initial);
  const initialReadyForPending =
    Boolean(pendingGenerate?.requestId) &&
    Boolean(initial?.looks?.length) &&
    initial?.requestId === pendingGenerate?.requestId;
  const [generating, setGenerating] = useState(
    Boolean(pendingGenerate) && !initialReadyForPending && !(initial?.looks?.length && !pendingGenerate)
  );
  const ids = useMemo(() => [...new Set(requestIds.filter(Boolean))], [requestIds]);
  const pendingStyleId = pendingStyleThisPiece?.requestId?.trim() || null;
  const pendingGenId = pendingGenerate?.requestId?.trim() || null;
  const displayId = useMemo(() => {
    if (pendingStyleId) {
      return ids.find((id) => id !== pendingStyleId) || initial?.requestId || ids[0];
    }
    if (pendingGenId) {
      // Prefer prior board id while new request is pending.
      return (
        (initial?.requestId && initial.requestId !== pendingGenId ? initial.requestId : null) ||
        ids.find((id) => id !== pendingGenId) ||
        pendingGenId
      );
    }
    return ids[0];
  }, [ids, pendingStyleId, pendingGenId, initial?.requestId]);
  const budget = useStylistBudget(generateUserKey, pendingGenId || pendingStyleId || displayId || ids[0]);
  const [deviceVotes, setDeviceVotes] = useState<HomeLookVote[]>([]);
  /** Soft "Saved" grace so Wear/Maybe can linger briefly before leaving the active board. */
  const [savedLingerIds, setSavedLingerIds] = useState<Set<string>>(() => new Set());
  /** Instant hide on No (and Wear/Maybe after linger) before vote merge catches up. */
  const [optimisticRemovedIds, setOptimisticRemovedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const refresh = () => setDeviceVotes(loadLookVotes());
    refresh();
    return subscribeLookVotes(refresh);
  }, []);

  useEffect(() => {
    // Drop poisoned ready cookie client-side (oversized boards break later requests).
    try {
      document.cookie = "atelier.stylist.ready.v1=; Path=/; Max-Age=0; SameSite=Lax";
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // Never stick on Generating when the active request (or initial) is already ready.
    if (
      initial?.looks?.length &&
      (!pendingGenId || initial.requestId === pendingGenId)
    ) {
      setGenerating(false);
      return;
    }
    if (payload?.looks?.length && pendingGenId && payload.requestId === pendingGenId) {
      setGenerating(false);
      return;
    }
    setGenerating(Boolean(pendingGenId));
  }, [pendingGenId, initial, payload?.requestId, payload?.looks?.length]);

  useEffect(() => {
    for (const id of ids) rememberLookRequestId(id);
    // Keep prior looks while styleThisPiece or storeFirst/closetFirst generate is pending.
    if (initial?.looks.length) {
      const matchesActive = !ids[0] || !initial.requestId || initial.requestId === ids[0];
      const priorWhilePending =
        (Boolean(pendingStyleId) && initial.requestId !== pendingStyleId) ||
        (Boolean(pendingGenId) && initial.requestId !== pendingGenId);
      if (matchesActive || priorWhilePending) {
        writeCachedLooks(initial);
        setPayload(initial);
        return;
      }
    }
    const stored = findCachedLooks(ids);
    if (stored?.looks.length) {
      const matchesActive = !ids[0] || stored.requestId === ids[0];
      const priorWhilePending =
        (Boolean(pendingStyleId) && stored.requestId !== pendingStyleId) ||
        (Boolean(pendingGenId) && stored.requestId !== pendingGenId);
      if (matchesActive || priorWhilePending) {
        setPayload(stored);
        return;
      }
    }
    // Pending with no prior looks: soft empty — never wipe into dead blank wait.
    if (pendingStyleId || pendingGenId) {
      return;
    }
    setPayload(null);
  }, [initial, ids, pendingStyleId, pendingGenId]);

  useEffect(() => {
    let cancelled = false;
    // Prefer session/cookie requestId; poll pending gen aggressively (1.5s).
    const pollIds = [
      ...new Set([pendingGenId, displayId, pendingStyleId, ids[0]].filter((id): id is string => Boolean(id))),
    ];
    if (!pollIds.length) return;

    const tick = async () => {
      try {
        const order = pendingStyleId
          ? [pendingStyleId, ...pollIds.filter((id) => id !== pendingStyleId)]
          : pendingGenId
            ? [pendingGenId, ...pollIds.filter((id) => id !== pendingGenId)]
            : pollIds;
        for (const pollId of order) {
          const res = await fetch(`/api/stylist/looks?requestId=${encodeURIComponent(pollId)}`, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!res.ok) continue;
          const data = (await res.json()) as { status?: string; response?: StylistResponseV1 };
          if (cancelled) return;
          if (pendingGenId && pollId === pendingGenId) {
            if (data.status === "ready" && data.response?.looks?.length) {
              // Prefer matching requestId; still show if server marks ready for this poll id
              // (requestId drift must not leave Luisa on endless Generating).
              const matched =
                !data.response.requestId ||
                data.response.requestId === pollId ||
                data.response.requestId === pendingGenId;
              if (!matched) {
                // Soft-accept: rewrite cache key to polled id for display.
                data.response = { ...data.response, requestId: pollId };
              }
              try {
                writeCachedLooks(data.response);
              } catch {
                /* cache optional */
              }
              setPayload(data.response);
              setGenerating(false);
              return;
            }
            if (data.status === "awaiting_stylist") {
              setGenerating(true);
              continue;
            }
          }
          // Any polled id that is ready → show board immediately (hydrate path).
          if (data.status === "ready" && data.response?.looks?.length) {
            const ready = data.response;
            try {
              writeCachedLooks(ready);
            } catch {
              /* cache optional */
            }
            if (!pendingStyleId || pollId !== pendingStyleId) {
              setPayload(ready);
              if (!pendingGenId || pollId === pendingGenId || ready.requestId === pendingGenId) {
                setGenerating(false);
              }
              if (pollId === pendingGenId || pollId === ids[0] || pollId === displayId) return;
            }
          }
          if (!data.response?.looks?.length) continue;
          if (data.response.requestId && data.response.requestId !== pollId) {
            // Allow ready boards even when response.requestId differs slightly from poll id.
            if (data.status !== "ready") continue;
          }
          // While styleThisPiece still pending, ignore empty/awaiting on that id and keep prior.
          if (pendingStyleId && pollId === pendingStyleId) {
            try {
              writeCachedLooks(data.response);
            } catch {
              /* cache optional */
            }
            continue;
          }
          if (pendingStyleId && pollId !== pendingStyleId) {
            setPayload((prev) => {
              if (prev?.looks.length && prev.requestId !== data.response!.requestId && prev.requestId !== pendingStyleId) {
                return prev;
              }
              if (prev?.looks.length && prev.requestId === data.response!.requestId) return data.response!;
              if (!prev?.looks.length) return data.response!;
              return prev;
            });
            return;
          }
          try {
            writeCachedLooks(data.response);
          } catch {
            /* cache optional */
          }
          setPayload(data.response);
          if (pendingGenId && data.response.requestId === pendingGenId) setGenerating(false);
          return;
        }
      } catch {
        /* keep waiting */
      }
    };

    void tick();
    const timer = window.setInterval(tick, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ids, displayId, pendingStyleId, pendingGenId]);

  // Burn free board only after looks are visible — never from the Server Component render path.
  useEffect(() => {
    if (!freeBoard || !payload?.looks?.length) return;
    let cancelled = false;
    void (async () => {
      try {
        await fetch("/api/freemium/mark-free-board", { method: "POST", cache: "no-store" });
      } catch {
        /* best-effort */
      }
      void cancelled;
    })();
    return () => {
      cancelled = true;
    };
  }, [freeBoard, payload?.looks?.length]);

  const looks = payload?.looks ?? [];
  const boardRequestId = payload?.requestId ?? ids[0];
  const serverVotes = useMemo<HomeLookVote[]>(
    () =>
      lookVotes.map((item) => ({
        lookId: item.lookId,
        vote: item.vote,
        requestId: item.requestId,
      })),
    [lookVotes]
  );
  const mergedVotes = useMemo(() => mergeHomeVotes(serverVotes, deviceVotes), [serverVotes, deviceVotes]);

  useEffect(() => {
    setSavedLingerIds(new Set());
    setOptimisticRemovedIds(new Set());
  }, [boardRequestId]);

  const activeLooks = useMemo(() => {
    const filtered = filterActiveBoardLooks(looks, mergedVotes, boardRequestId, { lingerIds: savedLingerIds });
    if (!optimisticRemovedIds.size) return filtered;
    return filtered.filter((look) => !optimisticRemovedIds.has(look.id));
  }, [looks, mergedVotes, boardRequestId, savedLingerIds, optimisticRemovedIds]);

  function onLookDisposition(lookId: string, vote: LikedLookVote) {
    const normalized = normalizeLikedVote(vote);
    if (normalized === "dislike") {
      // Optimistic No — hide tile immediately (no linger).
      setOptimisticRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(lookId);
        return next;
      });
      setSavedLingerIds((prev) => {
        if (!prev.has(lookId)) return prev;
        const next = new Set(prev);
        next.delete(lookId);
        return next;
      });
      return;
    }
    // Wear + Maybe both archive to Saved Lookbook and soft-linger off the board.
    if (normalized !== "like" && normalized !== "skip") return;
    setSavedLingerIds((prev) => {
      const next = new Set(prev);
      next.add(lookId);
      return next;
    });
    window.setTimeout(() => {
      setSavedLingerIds((prev) => {
        const next = new Set(prev);
        next.delete(lookId);
        return next;
      });
      setOptimisticRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(lookId);
        return next;
      });
    }, 1900);
  }

  const tier = access === "premium" ? "premium" : "free";
  const requestMeta = {
    freeFirstBoard: freeBoard,
    tier,
    generateMode,
    fittingCount,
  } as const;
  // Tiles-only / FITTINGS_PARKED creates are not metered by userGenerate — never lock Create behind fittings burn.
  const tilesOnly =
    FITTINGS_PARKED || (fittingCount ?? 0) === 0 || generateMode === "styleThisPiece";
  const paused = tilesOnly
    ? false
    : quotaExhausted || Boolean(budget && quotaMessage(budget));
  const boardIdleOrReady = !pendingGenId || !generating;
  // Always pin single Create new looks — even while pending (force regenerate), never dual/no-op.
  const pinStyleCtas = Boolean(showStyleCtas);
  // Prior board fully voted + pending new request → resume Generating (not dead cleared CTAs).
  const clearedWithPending = looks.length > 0 && activeLooks.length === 0 && Boolean(pendingGenId);
  const showWait =
    Boolean(pendingGenId) &&
    (generating || !boardIdleOrReady || clearedWithPending) &&
    !pendingStyleThisPiece;
  const showGeneratingBadge = Boolean(pendingGenId && generating && activeLooks.length > 0);
  if (looks.length === 0 || clearedWithPending) {
    // styleThisPiece must never take over Style with storeFirst Generating UX.
    if (pendingStyleThisPiece && looks.length === 0) {
      return (
        <AppShell tab="style">
          <header className="flex items-center justify-between">
            <span className="size-8" />
            <BrandWord className="text-[20px]" />
            <a href="/profile" className="flex size-8 items-center justify-center text-black/50" aria-label="Edit profile">
              <SlidersIcon />
            </a>
          </header>
          {pinStyleCtas ? <StyleGenerateCtas className="mt-6" autoFirstStoreFirst={autoFirstStoreFirst} /> : null}
          <h1 className="mt-7 font-serif text-[32px] leading-[1.1] tracking-tight">Your looks</h1>
        </AppShell>
      );
    }
    return (
      <AppShell tab="style">
        <header className="flex items-center justify-between">
          <span className="size-8" />
          <BrandWord className="text-[20px]" />
          <a href="/profile" className="flex size-8 items-center justify-center text-black/50" aria-label="Edit profile">
            <SlidersIcon />
          </a>
        </header>
        {pinStyleCtas ? <StyleGenerateCtas className="mt-6" autoFirstStoreFirst={autoFirstStoreFirst} /> : null}
        {showWait ? (
          <>
            <p className="mt-10 text-[12px] tracking-[0.14em] text-black/40 uppercase">Generating…</p>
            <h1 className="mt-2 font-serif text-[32px] leading-tight">Generating your looks…</h1>
            <p className="mt-2 text-[14px] text-black/45">Almost ready…</p>
            <div className="mt-8 space-y-3" aria-hidden>
              {[0, 1].map((slot) => (
                <div key={slot} className="flex overflow-hidden bg-white">
                  <div className="aspect-[3/4] w-[34%] shrink-0 animate-pulse bg-black/8" />
                  <div className="min-h-[42vh] flex-1 bg-white" />
                </div>
              ))}
            </div>
            <div className="mt-8 h-1 overflow-hidden rounded-full bg-black/8">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-black/35" />
            </div>
            {(pendingGenId || ids[0]) ? (
              <p className="mt-6 text-[11px] break-all text-black/35" data-request-id={pendingGenId || ids[0]}>
                Request {pendingGenId || ids[0]}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h1 className="mt-7 font-serif text-[32px] leading-[1.1] tracking-tight">Ready for new looks, {name}</h1>
            <p className="mt-3 text-[15px] leading-6 text-black/50">
              Tap Create new looks for a fresh board anytime.
            </p>
          </>
        )}
        {!pinStyleCtas ? (
          <div className="mt-10 flex items-center gap-6 text-[13px] text-black/55">
            {paused ? (
              <span className="inline-flex items-center gap-2 text-black/40">Regenerate tomorrow</span>
            ) : (
              <OnceForm action="/regenerate" generateMode="storeFirst">
                <button type="submit" className="inline-flex items-center gap-2">
                  Create new looks
                </button>
              </OnceForm>
            )}
            <a href="/profile">Edit profile</a>
          </div>
        ) : (
          <div className="mt-10 flex items-center gap-6 text-[13px] text-black/55">
            <a href="/profile">Edit profile</a>
          </div>
        )}
      </AppShell>
    );
  }

  if (activeLooks.length === 0) {
    return (
      <AppShell tab="style">
        <header className="flex items-center justify-between">
          <span className="size-8" />
          <BrandWord className="text-[20px]" />
          <a href="/profile" className="flex size-8 items-center justify-center text-black/50" aria-label="Edit profile">
            <SlidersIcon />
          </a>
        </header>
        {pinStyleCtas ? (
          <StyleGenerateCtas className="mt-6" autoFirstStoreFirst={autoFirstStoreFirst} />
        ) : paused ? null : (
          <OnceForm action="/regenerate" generateMode="storeFirst" className="mt-6">
            <button type="submit" className="flex h-12 w-full items-center justify-center rounded-2xl bg-black px-4 text-[15px] font-medium text-white">
              Create new looks
            </button>
          </OnceForm>
        )}
        <h1 className="mt-7 font-serif text-[32px] leading-[1.1] tracking-tight">Board cleared, {name}</h1>
        <p className="mt-3 text-[15px] leading-6 text-black/50">
          Looks you passed on are gone from this board. Wear and Maybe live in your Lookbook — create new looks anytime
          for a fresh set.
        </p>
        <div className="mt-8 flex items-center justify-center gap-10 text-[13px] text-black/55">
          {paused ? (
            <span className="inline-flex items-center gap-2 text-black/40">Regenerate tomorrow</span>
          ) : null}
          <a href="/lookbook" className="inline-flex items-center gap-2">
            Saved looks
          </a>
        </div>
        <ClosetInvite />
      </AppShell>
    );
  }

  return (
    <AppShell tab="style">
      <header className="flex items-center justify-between">
        <span className="size-8" />
        <BrandWord className="text-[20px]" />
        <a href="/profile" className="flex size-8 items-center justify-center text-black/50" aria-label="Edit profile">
          <SlidersIcon />
        </a>
      </header>
      {pinStyleCtas ? <StyleGenerateCtas className="mt-6" autoFirstStoreFirst={autoFirstStoreFirst} /> : null}
      {showGeneratingBadge ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3">
          <div>
            <p className="text-[12px] tracking-[0.14em] text-black/40 uppercase">Generating…</p>
            <p className="mt-0.5 text-[14px] text-black/65">Almost ready… keeping your last board up.</p>
          </div>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/8">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-black/35" />
          </div>
        </div>
      ) : null}
      <h1 className="mt-7 font-serif text-[32px] leading-[1.1] tracking-tight">
        Your {activeLooks.length === 1 ? "look" : `${activeLooks.length} looks`}, {name}
      </h1>
      <div className="-mx-5 mt-6 space-y-7">
        {activeLooks.map((look, index) => {
          const prior = lookVotes.find((item) => item.lookId === look.id);
          const liveVote = mergedVotes.find((item) => item.lookId === look.id)?.vote;
          const softSaved = savedLingerIds.has(look.id) || isSavedArchiveVote(liveVote);
          return (
            <LookbookCard
              key={look.id}
              look={look}
              index={index}
              budgetMax={budgetMax}
              requestId={boardRequestId}
              fittingLocked={lookFittingLocked(look, looks.indexOf(look), requestMeta)}
              initialVote={prior?.vote}
              initialReasons={prior?.reasons}
              softSaved={softSaved}
              onDisposition={(vote) => onLookDisposition(look.id, vote)}
            />
          );
        })}
      </div>

      <div className="mt-7 flex items-center justify-center gap-10 text-[13px] text-black/55">
        {paused ? (
          <span className="inline-flex items-center gap-2 text-black/40">Regenerate tomorrow</span>
        ) : pinStyleCtas ? null : (
          <OnceForm action="/regenerate" generateMode="storeFirst">
            <button type="submit" className="inline-flex items-center gap-2">
              Create new looks
            </button>
          </OnceForm>
        )}
        <a href="/profile" className="inline-flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
            <circle cx="12" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M6.4 18c.6-2.6 2.7-4 5.6-4s5 1.4 5.6 4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Edit profile
        </a>
      </div>

      <ClosetInvite />
    </AppShell>
  );
}

function LookbookCard({
  look,
  index,
  budgetMax,
  requestId,
  fittingLocked,
  initialVote,
  initialReasons,
  softSaved,
  onDisposition,
}: {
  look: StylistLookV1;
  index: number;
  budgetMax: number;
  requestId?: string;
  fittingLocked?: boolean;
  initialVote?: "like" | "dislike" | "skip";
  initialReasons?: string[];
  softSaved?: boolean;
  onDisposition?: (vote: LikedLookVote) => void;
}) {
  return (
    <article>
      <a href={`/lookbook/${look.id}?from=style`} className="block">
        <LookBoard look={look} fittingLocked={fittingLocked ?? true} />
        <div className="px-5 pt-2.5">
          <p className="text-[13px] font-medium">
            {index + 1} {lookbookCardTitle(look)}
            {softSaved ? <span className="ml-2 text-[11px] font-normal tracking-wide text-[#c9a86a] uppercase">Saved</span> : null}
          </p>
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-black/45">{lookCardLine(look)}</p>
          <LookCardTotals look={look} budgetMax={budgetMax} />
        </div>
      </a>
      <div className="px-5 pb-1">
        <LookCardVotes
          look={look}
          requestId={requestId}
          initialVote={initialVote}
          initialReasons={initialReasons}
          budgetMax={budgetMax}
          onDisposition={onDisposition}
        />
      </div>
    </article>
  );
}
