"use client";

import { BrandWord } from "@/components/app-shell";
import { HangerIcon, PersonIcon, StyleIcon, WardrobeIcon } from "@/components/icons";
import { readPostProfileDemoDone, writePostProfileDemoDone } from "@/components/nav-tour";
import { preheatFirstBoardStoreFirst } from "@/lib/first-board-generate";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

type TourTab = "style" | "lookbook" | "closet" | "profile";
type Phase = "intro" | "tour";

const INTRO_COPY =
  "While we style your first looks, let us show you how to get the most out of Atelier";

const STEPS: Array<{
  id: TourTab;
  title: string;
  body: string;
  cta: string;
}> = [
  {
    id: "style",
    title: "Style",
    body: "Active board — Wear, Maybe, or No. Heart/X on the quiz and these votes teach the stylist; No removes; Wear + Maybe save to Lookbook.",
    cta: "Next",
  },
  {
    id: "lookbook",
    title: "Lookbook",
    body: "Wear and Maybe save here as a shoppable fashion book.",
    cta: "Next",
  },
  {
    id: "closet",
    title: "Closet",
    body: "Add pieces you own. Later boards can mix them with the store.",
    cta: "Next",
  },
  {
    id: "profile",
    title: "Profile",
    body: "Color, likes, occasions, budget — edit anytime.",
    cta: "See my looks",
  },
];

const TAB_META = [
  { id: "style" as const, label: "Style", Icon: StyleIcon },
  { id: "lookbook" as const, label: "Lookbook", Icon: HangerIcon },
  { id: "closet" as const, label: "Closet", Icon: WardrobeIcon },
  { id: "profile" as const, label: "Profile", Icon: PersonIcon },
];

/** Local lasting assets — product tiles only (fittings parked; not worn heroes). */
const STYLE_LOOKS = [
  {
    src: "/catalog/tiles/alex-mill-coco-sport-cardigan-in-black-alpha.png",
    title: "Harbor weekend denim",
    sub: "Soft knit · barrel jean",
  },
  {
    src: "/catalog/tiles/alex-mill-hudson-pant-in-cotton-twill-in-black-alpha.png",
    title: "Cigar polish column",
    sub: "Tailored pant · loafers",
  },
  {
    src: "/catalog/tiles/alex-mill-jo-shirt-in-cotton-poplin-in-dark-chocolate-alpha.png",
    title: "Harvest plum column",
    sub: "Satin · structured tote",
  },
  {
    src: "/catalog/tiles/anine-bing-cade-tee-melrose-stencil-washed-black-alpha.png",
    title: "Paddock boxy tote",
    sub: "Cashmere · wide pant",
  },
] as const;

const LOOKBOOK_PAGES = [
  {
    src: "/catalog/tiles/alex-mill-coco-sport-cardigan-in-black-alpha.png",
    title: "Cobalt brunch",
    tag: "Wear",
  },
  {
    src: "/catalog/tiles/blucher-sneakers-alpha.png",
    title: "Golden denim",
    tag: "Maybe",
  },
  {
    src: "/catalog/tiles/animal-print-striped-scarf-alpha.png",
    title: "Rust & olive",
    tag: "Wear",
  },
] as const;

const CLOSET_TILES = [
  "/catalog/tiles/alex-mill-coco-sport-cardigan-in-black-alpha.png",
  "/catalog/tiles/alex-mill-hudson-pant-in-cotton-twill-in-black-alpha.png",
  "/catalog/tiles/alex-mill-jo-shirt-in-cotton-poplin-in-dark-chocolate-alpha.png",
  "/catalog/tiles/anine-bing-cade-tee-melrose-stencil-washed-black-alpha.png",
  "/catalog/tiles/blucher-sneakers-alpha.png",
  "/catalog/tiles/animal-print-striped-scarf-alpha.png",
] as const;

function stylePath(requestId: string | null): string {
  if (requestId?.trim()) return `/style?requestId=${encodeURIComponent(requestId.trim())}`;
  return "/style";
}

type Spot = { top: number; left: number; width: number; height: number };

/**
 * After budget / profile complete: kick first storeFirst in the background,
 * run intro + spotlight coach-mark tour (Style → Lookbook → Closet → Profile)
 * with polished destination previews, then land on `/style`.
 */
export function PostProfileDemo({
  autoGenerate = true,
}: {
  autoGenerate?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const tabRefs = useRef<Partial<Record<TourTab, HTMLButtonElement | null>>>({});
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (readPostProfileDemoDone()) {
      router.replace("/style");
      return;
    }

    if (autoGenerate) {
      preheatFirstBoardStoreFirst((id) => setRequestId(id));
    }
    setOpen(true);
  }, [autoGenerate, router]);

  const measure = useCallback(() => {
    if (phase !== "tour") {
      setSpot(null);
      return;
    }
    const id = STEPS[step]?.id;
    const el = id ? tabRefs.current[id] : null;
    if (!el) {
      setSpot(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setSpot({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    });
  }, [phase, step]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, measure, phase, step]);

  function goStyle() {
    writePostProfileDemoDone();
    setOpen(false);
    router.push(stylePath(requestId));
  }

  function next() {
    if (phase === "intro") {
      setPhase("tour");
      setStep(0);
      return;
    }
    if (step >= STEPS.length - 1) {
      goStyle();
      return;
    }
    setStep((n) => n + 1);
  }

  const current = STEPS[step];

  if (!open) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col items-center justify-center px-6 py-16 text-center">
        <p className="font-serif text-[28px] leading-tight tracking-tight">Your profile is ready</p>
        <p className="mt-3 max-w-[300px] text-[14px] leading-6 text-black/50">Starting your first board…</p>
      </div>
    );
  }

  const pad = 6;
  const hole = spot
    ? {
        top: Math.max(0, spot.top - pad),
        left: Math.max(0, spot.left - pad),
        width: spot.width + pad * 2,
        height: spot.height + pad * 2,
      }
    : null;

  const tooltipStyle: CSSProperties | undefined =
    phase === "tour" && hole
      ? {
          position: "fixed",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: `calc(100vh - ${hole.top}px + 12px)`,
          width: "min(360px, calc(100vw - 32px))",
          zIndex: 80,
        }
      : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[#f3f3f3]" role="presentation">
      {/* Mock destination preview — visible under the dim while generate runs */}
      <div className="pointer-events-none mx-auto flex h-full w-full max-w-[460px] flex-col px-5 pb-28 pt-6">
        <header className="flex items-center justify-center">
          <BrandWord className="text-[20px]" height={40} />
        </header>
        {phase === "tour" ? <MockPreview step={current.id} /> : <MockPreview step="style" />}
      </div>

      {/* Real bottom tabs — spotlight targets (tour phase only) */}
      <nav className="fixed inset-x-0 bottom-0 z-[75] border-t border-black/8 bg-[#f3f3f3]">
        <div className="mx-auto grid max-w-[460px] grid-cols-4 px-3 pt-2.5 pb-3.5">
          {TAB_META.map(({ id, label, Icon }) => {
            const active = phase === "tour" && current.id === id;
            return (
              <button
                key={id}
                type="button"
                ref={(el) => {
                  tabRefs.current[id] = el;
                }}
                data-atelier-tour={id}
                onClick={() => {
                  if (phase !== "tour") return;
                  const idx = STEPS.findIndex((s) => s.id === id);
                  if (idx >= 0) setStep(idx);
                }}
                className={cn(
                  "relative z-[76] flex flex-col items-center gap-1 rounded-xl py-1 text-[11px]",
                  active ? "font-medium text-black" : "font-normal text-black/35"
                )}
              >
                <Icon className={cn("size-[22px]", active ? "stroke-[1.6]" : "stroke-[1.3]")} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Dim with cutout over the active tab (tour) or full dim (intro) */}
      {phase === "tour" && hole ? (
        <div className="pointer-events-none fixed inset-0 z-[72]" aria-hidden>
          <div className="absolute inset-x-0 top-0 bg-black/45" style={{ height: hole.top }} />
          <div
            className="absolute left-0 bg-black/45"
            style={{ top: hole.top, height: hole.height, width: hole.left }}
          />
          <div
            className="absolute right-0 bg-black/45"
            style={{
              top: hole.top,
              height: hole.height,
              left: hole.left + hole.width,
              right: 0,
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 bg-black/45"
            style={{ top: hole.top + hole.height }}
          />
          <div
            className="absolute rounded-2xl ring-2 ring-white shadow-[0_0_0_4px_rgba(0,0,0,0.35)]"
            style={{
              top: hole.top,
              left: hole.left,
              width: hole.width,
              height: hole.height,
            }}
          />
        </div>
      ) : (
        <div className="pointer-events-none fixed inset-0 z-[72] bg-black/45" aria-hidden />
      )}

      {phase === "intro" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-profile-demo-intro"
          className="fixed inset-x-4 top-1/2 z-[80] mx-auto max-w-[360px] -translate-y-1/2 rounded-2xl bg-white p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
        >
          <p className="text-[10px] tracking-[0.16em] text-black/35 uppercase">Quick tour</p>
          <p
            id="post-profile-demo-intro"
            className="mt-2 font-serif text-[22px] leading-snug tracking-tight"
          >
            {INTRO_COPY}
          </p>
          <button
            type="button"
            onClick={next}
            className="mt-5 flex h-10 w-full items-center justify-center rounded-xl bg-black px-3 text-[13px] font-medium text-white"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={goStyle}
            className="mt-1.5 flex h-9 w-full items-center justify-center text-[12px] text-black/45"
          >
            Skip
          </button>
        </div>
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-profile-demo-title"
          style={tooltipStyle}
          className={
            tooltipStyle
              ? "rounded-2xl bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
              : "fixed inset-x-4 bottom-28 z-[80] mx-auto max-w-[360px] rounded-2xl bg-white p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)]"
          }
        >
          <p className="text-[10px] tracking-[0.16em] text-black/35 uppercase">
            {step + 1} of {STEPS.length}
          </p>
          <p id="post-profile-demo-title" className="mt-1 font-serif text-[22px] leading-tight tracking-tight">
            {current.title}
          </p>
          <p className="mt-2 text-[13px] leading-5 text-black/55">{current.body}</p>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((item, index) => (
              <span
                key={item.id}
                className={`h-1 flex-1 rounded-full ${index <= step ? "bg-black" : "bg-black/12"}`}
                aria-hidden
              />
            ))}
          </div>
          <button
            type="button"
            onClick={next}
            className="mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-black px-3 text-[13px] font-medium text-white"
          >
            {current.cta}
          </button>
          <button
            type="button"
            onClick={goStyle}
            className="mt-1.5 flex h-9 w-full items-center justify-center text-[12px] text-black/45"
          >
            Skip
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

function MockPreview({ step }: { step: TourTab }) {
  if (step === "style") {
    return (
      <div className="mt-5 flex-1 overflow-hidden">
        <h1 className="font-serif text-[28px] leading-tight">Style</h1>
        <p className="mt-1 text-[13px] text-black/45">Active board · four looks</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {STYLE_LOOKS.map((look) => (
            <div key={look.src} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="relative aspect-[3/4] w-full bg-[#f6f3ee]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={look.src} alt="" className="absolute inset-0 h-full w-full object-contain p-3" />
              </div>
              <div className="space-y-1.5 px-2.5 py-2.5">
                <p className="truncate text-[12px] font-medium leading-tight">{look.title}</p>
                <p className="truncate text-[10px] text-black/40">{look.sub}</p>
                <div className="flex gap-1">
                  {["Wear", "Maybe", "No"].map((v) => (
                    <span
                      key={v}
                      className="rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[8px] tracking-wide text-black/40 uppercase"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "lookbook") {
    return (
      <div className="mt-5 flex-1 overflow-hidden">
        <h1 className="font-serif text-[28px] leading-tight">Lookbook</h1>
        <p className="mt-1 text-[13px] text-black/45">Saved Wear & Maybe</p>
        <div className="mt-4 space-y-3">
          {LOOKBOOK_PAGES.map((page) => (
            <div key={page.src} className="flex gap-3 overflow-hidden rounded-2xl bg-white p-2 shadow-sm">
              <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-xl bg-[#f6f3ee]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.src} alt="" className="absolute inset-0 h-full w-full object-contain p-2" />
              </div>
              <div className="flex flex-1 flex-col justify-center gap-1.5 py-1 pr-1">
                <span className="w-fit rounded-full bg-black/[0.05] px-2 py-0.5 text-[9px] tracking-wide text-black/45 uppercase">
                  {page.tag}
                </span>
                <p className="font-serif text-[17px] leading-tight">{page.title}</p>
                <p className="text-[11px] text-black/40">Shoppable page · open look</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "closet") {
    return (
      <div className="mt-5 flex-1 overflow-hidden">
        <h1 className="font-serif text-[28px] leading-tight">Closet</h1>
        <p className="mt-1 text-[13px] text-black/45">Pieces you already own</p>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {CLOSET_TILES.map((src) => (
            <div key={src} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="flex aspect-square w-full items-center justify-center bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="max-h-full max-w-full object-contain" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-dashed border-black/15 px-4 py-5 text-center text-[12px] text-black/35">
          Add a piece
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 flex-1 overflow-hidden">
      <h1 className="font-serif text-[28px] leading-tight">Profile</h1>
      <p className="mt-1 text-[13px] text-black/45">Your brief for new looks</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[
          { name: "Navy", hex: "#1e2a44" },
          { name: "Camel", hex: "#c4a574" },
          { name: "Ivory", hex: "#f3efe6" },
          { name: "Wine", hex: "#6b2d3c" },
        ].map((c) => (
          <span key={c.name} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] shadow-sm">
            <span className="size-2.5 rounded-full border border-black/10" style={{ background: c.hex }} />
            {c.name}
          </span>
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        {[
          { label: "Season", value: "True Autumn" },
          { label: "Styles", value: "Scandi · French girl" },
          { label: "Occasions", value: "Work · Weekend" },
          { label: "Budget", value: "$80 – $280" },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5 shadow-sm">
            <div>
              <p className="text-[14px] font-medium">{row.label}</p>
              <p className="text-[12px] text-black/45">{row.value}</p>
            </div>
            <span className="text-[18px] text-black/20">›</span>
          </div>
        ))}
      </div>
    </div>
  );
}
