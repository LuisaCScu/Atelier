"use client";

import { StylePhoto } from "@/components/style-photo";
import { ctaPrimary } from "@/components/marks";
import { dedupeStyleCards, styleCardVisualKey, type StyleCardV1 } from "@/lib/style-cards";
import { useEffect, useMemo, useRef, useState } from "react";

type Vote = "like" | "dislike";

const SWIPE_PX = 88;
const OFFSCREEN = 480;

function cardUrl(card: StyleCardV1): string {
  return (card.image ?? "").trim().toLowerCase();
}

/** Queue never includes already-shown ids, image URLs, or visual near-dups. */
function buildUniqueQueue(
  cards: StyleCardV1[],
  votes: Record<string, Vote>,
  shownIds: Set<string>,
  shownUrls: Set<string>,
  shownVisual: Set<string>
): string[] {
  const queue: string[] = [];
  const queuedIds = new Set<string>();
  const queuedUrls = new Set<string>();
  const queuedVisual = new Set<string>();
  for (const card of cards) {
    if (votes[card.id]) continue;
    if (shownIds.has(card.id) || queuedIds.has(card.id)) continue;
    const url = cardUrl(card);
    if (url && (shownUrls.has(url) || queuedUrls.has(url))) continue;
    const visual = styleCardVisualKey(card);
    if (shownVisual.has(visual) || queuedVisual.has(visual)) continue;
    queue.push(card.id);
    queuedIds.add(card.id);
    if (url) queuedUrls.add(url);
    queuedVisual.add(visual);
  }
  return queue;
}

export function StyleDeck({
  cards,
  likedIds,
  dislikedIds,
  fromProfile = false,
}: {
  cards: StyleCardV1[];
  likedIds: string[];
  dislikedIds: string[];
  fromProfile?: boolean;
}) {
  const uniqueCards = useMemo(() => dedupeStyleCards(cards), [cards]);

  const initialVotes = useMemo(() => {
    const votes: Record<string, Vote> = {};
    for (const id of likedIds) votes[id] = "like";
    for (const id of dislikedIds) votes[id] = "dislike";
    return votes;
  }, [likedIds, dislikedIds]);

  // Session hard-lock: once a look id or image URL has been shown, never show again
  // (except intentional Undo of the last vote).
  const shownIdsRef = useRef<Set<string>>(new Set(Object.keys(initialVotes)));
  const shownUrlsRef = useRef<Set<string>>(
    new Set(
      uniqueCards
        .filter((card) => initialVotes[card.id])
        .map(cardUrl)
        .filter(Boolean)
    )
  );
  const shownVisualRef = useRef<Set<string>>(
    new Set(
      uniqueCards.filter((card) => initialVotes[card.id]).map((card) => styleCardVisualKey(card))
    )
  );

  const [votes, setVotes] = useState<Record<string, Vote>>(initialVotes);
  const [queue, setQueue] = useState<string[]>(() =>
    buildUniqueQueue(
      uniqueCards,
      initialVotes,
      shownIdsRef.current,
      shownUrlsRef.current,
      shownVisualRef.current
    )
  );
  const [history, setHistory] = useState<string[]>(() =>
    uniqueCards.map((card) => card.id).filter((id) => Boolean(initialVotes[id]))
  );
  const [nudge, setNudge] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0, active: false });
  const [fly, setFly] = useState<{ id: string; dir: Vote } | null>(null);
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const voteRef = useRef<(vote: Vote) => void>(() => undefined);
  const undoRef = useRef<() => void>(() => undefined);

  const byId = useMemo(() => new Map(uniqueCards.map((card) => [card.id, card])), [uniqueCards]);
  const currentId = queue[0];
  const current = currentId ? byId.get(currentId) : undefined;
  const likes = uniqueCards.filter((card) => votes[card.id] === "like").map((card) => card.id);
  const dislikes = uniqueCards.filter((card) => votes[card.id] === "dislike").map((card) => card.id);
  const decided = likes.length + dislikes.length;
  const canContinue = likes.length >= 2;
  const deckExhausted = !current && !fly;
  const leaning = drag.x / SWIPE_PX;
  const likeGlow = fly?.dir === "like" ? 1 : Math.max(0, Math.min(1, leaning));
  const passGlow = fly?.dir === "dislike" ? 1 : Math.max(0, Math.min(1, -leaning));

  // Mark front card shown as soon as visible — never requeue later.
  useEffect(() => {
    if (!current) return;
    shownIdsRef.current.add(current.id);
    const url = cardUrl(current);
    if (url) shownUrlsRef.current.add(url);
    shownVisualRef.current.add(styleCardVisualKey(current));
  }, [current]);

  // No replay loop: when unique cards run out, stop gracefully.
  useEffect(() => {
    if (queue.length > 0 || canContinue) return;
    setNudge(true);
  }, [queue.length, canContinue]);

  function commitVote(id: string, vote: Vote) {
    const card = byId.get(id);
    shownIdsRef.current.add(id);
    if (card) {
      const url = cardUrl(card);
      if (url) shownUrlsRef.current.add(url);
      shownVisualRef.current.add(styleCardVisualKey(card));
    }
    setVotes((currentVotes) => ({ ...currentVotes, [id]: vote }));
    setHistory((currentHistory) => [...currentHistory, id]);
    setQueue((currentQueue) => currentQueue.filter((item) => item !== id));
    setFly(null);
    setDrag({ x: 0, y: 0, active: false });
    if (vote === "like") setNudge(false);
  }

  function voteCurrent(vote: Vote) {
    if (!currentId || fly) return;
    setFly({ id: currentId, dir: vote });
    window.setTimeout(() => commitVote(currentId, vote), 220);
  }

  function undo() {
    const last = history[history.length - 1];
    if (!last || fly) return;
    const card = byId.get(last);
    shownIdsRef.current.delete(last);
    if (card) {
      const url = cardUrl(card);
      if (url) shownUrlsRef.current.delete(url);
      shownVisualRef.current.delete(styleCardVisualKey(card));
    }
    setHistory((currentHistory) => currentHistory.slice(0, -1));
    setVotes((currentVotes) => {
      const next = { ...currentVotes };
      delete next[last];
      return next;
    });
    setQueue((currentQueue) => [last, ...currentQueue.filter((id) => id !== last)]);
    setFly(null);
    setDrag({ x: 0, y: 0, active: false });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!currentId || fly) return;
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ x: 0, y: 0, active: true });
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    setDrag({
      x: event.clientX - pointer.current.x,
      y: event.clientY - pointer.current.y,
      active: true,
    });
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return;
    const dx = event.clientX - pointer.current.x;
    pointer.current = null;
    if (dx >= SWIPE_PX) {
      voteCurrent("like");
      return;
    }
    if (dx <= -SWIPE_PX) {
      voteCurrent("dislike");
      return;
    }
    setDrag({ x: 0, y: 0, active: false });
  }

  voteRef.current = voteCurrent;
  undoRef.current = undo;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") voteRef.current("like");
      if (event.key === "ArrowLeft") voteRef.current("dislike");
      if (event.key === "Backspace") undoRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shiftX = fly ? (fly.dir === "like" ? OFFSCREEN : -OFFSCREEN) : drag.x;
  const shiftY = fly ? -36 : drag.y * 0.35;
  const rotate = Math.max(-16, Math.min(16, shiftX / 18));

  return (
    <form action="/session" method="post" className="mt-5 flex flex-1 flex-col">
      <input type="hidden" name="done_styles" value="1" />
      <input type="hidden" name="next" value={fromProfile ? "/profile" : "/personalize/prefs"} />
      {uniqueCards.map((card) => (
        <input key={`deck-${card.id}`} type="hidden" name="styleDeck" value={card.id} />
      ))}
      {uniqueCards.map((card) => (
        <input key={`shown-${card.id}`} type="hidden" name="styleShown" value={card.id} />
      ))}
      {likes.map((id) => (
        <input key={`like-${id}`} type="hidden" name="likedStyle" value={id} />
      ))}
      {dislikes.map((id) => (
        <input key={`pass-${id}`} type="hidden" name="dislikedStyle" value={id} />
      ))}

      <div className="relative mx-[-4px] h-[min(62vh,560px)] min-h-[420px]">
        {queue
          .slice(0, 3)
          .map((id, depth) => {
            const card = byId.get(id);
            if (!card) return null;
            const front = depth === 0;
            return (
              <article
                key={`${card.id}:${card.image}:${card.formulaHint}`}
                className="absolute inset-0 origin-bottom overflow-hidden rounded-[28px] bg-[#ececec] shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
                style={
                  front
                    ? {
                        transform: `translate(${shiftX}px, ${shiftY}px) rotate(${rotate}deg)`,
                        transition: drag.active ? "none" : "transform 220ms ease",
                        zIndex: 10,
                        touchAction: "none",
                      }
                    : {
                        transform: `translateY(${depth * 10}px) scale(${1 - depth * 0.035})`,
                        zIndex: 10 - depth,
                      }
                }
                onPointerDown={front ? onPointerDown : undefined}
                onPointerMove={front ? onPointerMove : undefined}
                onPointerUp={front ? onPointerUp : undefined}
                onPointerCancel={front ? onPointerUp : undefined}
              >
                <StylePhoto src={card.image} alt={card.alt} />
                {front ? (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.42),transparent_38%)]"
                      aria-hidden
                    />
                    <p className="pointer-events-none absolute inset-x-4 bottom-4 text-[13px] leading-5 text-white/92">
                      {card.formulaHint}
                    </p>
                    <SwipeGlow tone="like" opacity={likeGlow} />
                    <SwipeGlow tone="pass" opacity={passGlow} />
                  </>
                ) : null}
              </article>
            );
          })
          .reverse()}

        {deckExhausted && canContinue ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[28px] bg-white px-6 text-center">
            <p className="font-serif text-[28px] leading-tight">That’s the set.</p>
            <p className="mt-2 text-[14px] leading-6 text-black/50">
              {likes.length} looks you’d wear. Continue and we’ll keep the vibe.
            </p>
          </div>
        ) : null}

        {deckExhausted && !canContinue ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[28px] bg-white px-6 text-center">
            <p className="font-serif text-[28px] leading-tight">You’ve seen every look.</p>
            <p className="mt-2 text-[14px] leading-6 text-black/50">
              No repeats in this quiz. Undo a pass and like at least two looks you’d actually wear.
            </p>
          </div>
        ) : null}
      </div>

      {/* Centered heart + X only — no Wear/Maybe/No text buttons. Undo kept. */}
      <div className="mt-5 flex w-full flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-6">
          <CircleButton
            label="Pass"
            onClick={() => voteCurrent("dislike")}
            disabled={!current || Boolean(fly)}
            className="border border-black/15 bg-white text-black"
          >
            <XMark />
          </CircleButton>
          <CircleButton
            label="Like"
            onClick={() => voteCurrent("like")}
            disabled={!current || Boolean(fly)}
            className="bg-black text-white"
          >
            <HeartMark />
          </CircleButton>
        </div>
        <button
          type="button"
          onClick={undo}
          disabled={!history.length || Boolean(fly)}
          className="text-[12px] text-black/40 disabled:opacity-30"
        >
          Undo
        </button>
      </div>

      <p className="mt-4 text-center text-[12px] text-black/40">
        {Math.min(decided, uniqueCards.length)} of {uniqueCards.length}
        {likes.length ? ` · ${likes.length} liked` : ""}
      </p>
      {nudge || (decided >= 3 && likes.length < 2) ? (
        <p className="mt-2 text-center text-[13px] leading-5 text-black/55">
          Pass on everything? Like at least two looks you’d actually wear.
        </p>
      ) : (
        <p className="mt-2 text-center text-[13px] leading-5 text-black/40">Right to like · left to pass</p>
      )}

      <button type="submit" disabled={!canContinue} className={`${ctaPrimary} mt-5 disabled:opacity-35`}>
        {fromProfile ? "Done" : "Continue to extras"}
      </button>
    </form>
  );
}

/** Icon-only swipe glow — no Wear/Maybe/No text stamps. */
function SwipeGlow({ tone, opacity }: { tone: "like" | "pass"; opacity: number }) {
  if (opacity <= 0.04) return null;
  const like = tone === "like";
  return (
    <div
      className={`pointer-events-none absolute top-6 ${like ? "left-5" : "right-5"} flex size-12 items-center justify-center rounded-full border-2 border-white text-white`}
      style={{ opacity, transform: like ? "rotate(-12deg)" : "rotate(12deg)" }}
      aria-hidden
    >
      {like ? <HeartMark /> : <XMark />}
    </div>
  );
}

function CircleButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex size-16 items-center justify-center rounded-full disabled:opacity-35 ${className}`}
    >
      {children}
    </button>
  );
}

function HeartMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden>
      <path d="M12 20.1s-6.4-3.9-8.6-7.2C1.7 10.4 2.4 7 5.2 6.1c1.7-.6 3.4.1 4.3 1.5L12 10l2.5-2.4c.9-1.4 2.6-2.1 4.3-1.5 2.8.9 3.5 4.3 1.8 6.8-2.2 3.3-8.6 7.2-8.6 7.2Z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden>
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
