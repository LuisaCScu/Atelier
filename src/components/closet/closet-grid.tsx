"use client";

import { AppShell, BrandWord } from "@/components/app-shell";
import { StyleMyClosetCta } from "@/components/style-my-closet-cta";
import { CLOSET_CREAM, HangRackRow } from "@/components/closet/hang-rack";
import { CameraLine, LockLine, PencilLine, SparkleLine, WardrobeEmpty, ctaSecondary } from "@/components/marks";
import {
  CUTOUT_WAIT_COPY,
  cutoutQueueStats,
  getCutoutQueue,
  startCutoutQueueWorker,
  subscribeCutoutQueue,
  type CutoutQueueJob,
} from "@/lib/closet-cutout-queue";
import { CLOSET_ROLE_BUCKETS } from "@/lib/closet-roles";
import { readSessionAddedCount } from "@/lib/closet-session-added";
import { closetIsFull, ensureClosetImagesHydrated, hydrateCloset, subscribeCloset } from "@/lib/closet-store";
import { CLOSET_FREE_CAP, type ClosetItem } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

export function ClosetScreen({ bucketId }: { bucketId?: string }) {
  const [items, setItems] = useState<ClosetItem[] | null>(null);
  const [queueJobs, setQueueJobs] = useState<CutoutQueueJob[]>([]);
  const [addedSession, setAddedSession] = useState(0);

  useEffect(() => {
    setItems(hydrateCloset());
    setAddedSession(readSessionAddedCount());
    void ensureClosetImagesHydrated().then(() => setItems(hydrateCloset()));
    startCutoutQueueWorker();
    setQueueJobs([...getCutoutQueue()]);
    const unsubCloset = subscribeCloset(() => {
      setItems(hydrateCloset());
      setAddedSession(readSessionAddedCount());
    });
    const unsubQueue = subscribeCutoutQueue(() => setQueueJobs([...getCutoutQueue()]));
    return () => {
      unsubCloset();
      unsubQueue();
    };
  }, []);

  const activeBucket = useMemo(
    () => (bucketId ? CLOSET_ROLE_BUCKETS.find((b) => b.id === bucketId) : undefined),
    [bucketId]
  );

  const buckets = useMemo(() => {
    if (!items?.length) return [];
    const source = activeBucket ? [activeBucket] : CLOSET_ROLE_BUCKETS;
    return source
      .map((bucket) => ({
        ...bucket,
        items: items.filter((item) => bucket.roles.includes(item.role)),
      }))
      .filter((bucket) => bucket.items.length > 0);
  }, [items, activeBucket]);

  const queueStats = useMemo(() => cutoutQueueStats(queueJobs), [queueJobs]);
  const flatLayPending = useMemo(
    () => (items ?? []).filter((item) => item.flatLayStatus === "pending").length,
    [items]
  );
  const full = items ? closetIsFull(items) : false;
  const addHref = full ? "/closet/upgrade" : "/closet/add/photo";
  const noteHref = full ? "/closet/upgrade" : "/closet/add/note";

  if (items === null) {
    return (
      <AppShell tab="closet">
        <ClosetChrome addHref={addHref} cream>
          <p className="mt-16 text-center text-[13px] text-black/40">Opening your closet…</p>
        </ClosetChrome>
      </AppShell>
    );
  }

  if (items.length === 0) {
    return (
      <AppShell tab="closet">
        <ClosetChrome addHref={addHref} cream>
          <div className="mt-5 flex justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#efe8dc] px-3 py-1 text-[12px] text-black/60">
              <SparkleLine /> Looks first · closet next
            </span>
          </div>
          <div className="mt-14 flex flex-col items-center text-center">
            <div className="flex size-[104px] items-center justify-center rounded-full bg-[#efe8dc] text-black/35">
              <WardrobeEmpty />
            </div>
            <h1 className="mt-6 font-serif text-[30px] leading-tight">Nothing here yet.</h1>
            <p className="mt-3 max-w-xs text-[14px] leading-6 text-black/50">
              Add pieces you already wear — a photo or a quick note. Generate can mix them with the store.
            </p>
          </div>
          <QueueStatusBanner stats={queueStats} />
          <p className="mt-10 text-[13px] font-medium">Add a piece</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <AddTile href={addHref} icon={<CameraLine />} title="Photo" caption="Snap · we cut it out" />
            <AddTile href={noteHref} icon={<PencilLine />} title="Note" caption="Name only · add photo later" />
          </div>
          <p className="mt-6 text-center text-[12px] leading-5 text-black/40">
            Women&apos;s pieces only · {CLOSET_FREE_CAP} free on this device
          </p>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-black/35">
            <LockLine /> Your closet stays in this browser.
          </p>
        </ClosetChrome>
      </AppShell>
    );
  }

  const inventoryLine =
    addedSession > 0
      ? `${items.length} pieces · ${addedSession} added`
      : `${items.length} pieces · 0 added`;

  return (
    <AppShell tab="closet">
      <ClosetChrome addHref={addHref} cream>
        {activeBucket ? (
          <a href="/closet" className="mt-1 inline-flex items-center gap-1 text-[12px] text-black/45">
            <span aria-hidden>‹</span> Closet
          </a>
        ) : null}

        <h1 className="mt-5 font-serif text-[32px] leading-tight">
          {activeBucket ? activeBucket.label : "Closet"}
        </h1>
        <p className="mt-2 text-[13px] text-black/45">{inventoryLine}</p>
        <p className="mt-1 text-[11px] text-black/35">
          Women&apos;s apparel · this device
          {full ? " · free closet full" : ""}
        </p>

        <p className="mt-3 text-[12px] text-black/40">
          <a href={noteHref} className="underline decoration-black/20 underline-offset-2">
            Add by note
          </a>
          {" · "}Photo via +
        </p>

        {full ? (
          <a href="/closet/upgrade" className={`${ctaSecondary} mt-3`}>
            Free closet is full
          </a>
        ) : null}

        {!activeBucket ? <StyleMyClosetCta variant="primary" className="mt-5" /> : null}

        <QueueStatusBanner stats={queueStats} />

        {flatLayPending > 0 ? (
          <div className="mt-5 rounded-2xl bg-[#efe8dc] px-4 py-3.5">
            <p className="text-[13px] font-medium text-black/70">
              Polishing {flatLayPending} piece{flatLayPending === 1 ? "" : "s"} for your hang-rack…
            </p>
            <p className="mt-1 text-[12px] leading-5 text-black/50">
              Usually a few minutes. You can keep styling — tiles update when ready.
            </p>
            <a href="/style" className="mt-2.5 inline-block text-[12px] font-medium text-black/70 underline">
              Keep styling
            </a>
          </div>
        ) : null}

        <div className="mt-7 space-y-8">
          {buckets.map((bucket) => (
            <HangRackRow
              key={bucket.id}
              bucketId={bucket.id}
              label={bucket.label}
              items={bucket.items}
              showDrillIn={!activeBucket}
            />
          ))}
        </div>

        {activeBucket && buckets.length === 0 ? (
          <p className="mt-10 text-center text-[13px] text-black/40">No pieces in this category yet.</p>
        ) : null}
      </ClosetChrome>
    </AppShell>
  );
}

function ClosetChrome({
  children,
  addHref,
  cream = false,
}: {
  children: React.ReactNode;
  addHref: string;
  cream?: boolean;
}) {
  return (
    <div
      className="-mx-5 -mt-6 min-h-[calc(100dvh-7rem)] px-5 pt-6 pb-2"
      style={cream ? { backgroundColor: CLOSET_CREAM } : undefined}
    >
      <header
        className="sticky top-0 z-30 -mx-5 flex items-center justify-between px-5 py-3 backdrop-blur-md"
        style={{ backgroundColor: cream ? "rgba(244, 237, 227, 0.92)" : "rgba(243, 243, 243, 0.92)" }}
      >
        <BrandWord className="text-[20px]" />
        <a
          href={addHref}
          aria-label="Add photo to closet"
          className="flex size-9 items-center justify-center rounded-full bg-black text-[22px] leading-none text-white"
        >
          +
        </a>
      </header>
      {children}
    </div>
  );
}

function QueueStatusBanner({
  stats,
}: {
  stats: ReturnType<typeof cutoutQueueStats>;
}) {
  if (!stats.isCutting && !stats.hasReady && !stats.error) return null;
  return (
    <div className="mt-5 rounded-2xl bg-[#efe8dc] px-4 py-3.5">
      {stats.isCutting ? (
        <>
          <p className="text-[13px] font-medium text-black/70">
            Cutting {stats.cuttingOf} of {stats.cuttingTotal}…
          </p>
          <p className="mt-1 text-[12px] leading-5 text-black/50">{CUTOUT_WAIT_COPY}</p>
        </>
      ) : stats.hasReady ? (
        <>
          <p className="text-[13px] font-medium text-black/70">
            {stats.ready} photo{stats.ready === 1 ? "" : "s"} ready to confirm
          </p>
          <p className="mt-1 text-[12px] leading-5 text-black/50">
            Name, role, and color — then save into your closet.
          </p>
        </>
      ) : (
        <p className="text-[12px] leading-5 text-black/55">
          {stats.error} photo{stats.error === 1 ? "" : "s"} couldn&apos;t be cut out.
        </p>
      )}
      <a href="/closet/add/photo" className="mt-2.5 inline-block text-[12px] font-medium text-black/70 underline">
        {stats.hasReady ? "Continue confirming" : stats.isCutting ? "View progress" : "Review photos"}
      </a>
    </div>
  );
}

function AddTile({
  href,
  icon,
  title,
  caption,
  compact = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  caption: string;
  compact?: boolean;
}) {
  return (
    <a
      href={href}
      className={
        compact
          ? "flex flex-col items-center rounded-xl bg-white/80 px-2 py-3 text-center"
          : "flex flex-col items-center rounded-2xl bg-white/80 px-3 py-5 text-center"
      }
    >
      <span className="text-black/70">{icon}</span>
      <p className={`font-medium ${compact ? "mt-1.5 text-[12px]" : "mt-2.5 text-[13px]"}`}>{title}</p>
      <p className={`text-black/40 ${compact ? "mt-0.5 text-[10px] leading-tight" : "mt-1 text-[11px] leading-4"}`}>
        {caption}
      </p>
    </a>
  );
}
