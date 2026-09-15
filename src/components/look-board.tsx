"use client";

import { mvpItemById, pieceCollageImage, pieceImageAlpha } from "@/lib/mvp-catalog";
import type { StylistLookV1, StylistPieceV1 } from "@/lib/stylist-contract";

/**
 * Board tile image resolution (Luisa 2026-09-12):
 * 1) Prefer piece.image (Store SKUs, bags, closet cutouts — even when not in MVP catalog)
 * 2) Else collage-safe catalog tile (isolated transparent / white-plate)
 * 3) Reject lifestyle / on-model only when there is no piece.image and catalog says so
 */
export function resolveBoardPieceImage(piece: StylistPieceV1): string | null {
  const pieceImg = (piece.image ?? "").trim();
  if (pieceImg) return pieceImg;
  return pieceCollageImage(mvpItemById(piece.id));
}

/**
 * Keep every piece with a usable board image.
 * Bags / accessories with piece.image are never dropped (mvpItemById may be undefined).
 */
export function collagePieces(pieces: StylistPieceV1[] | undefined): StylistPieceV1[] {
  return (pieces ?? []).filter((piece) => {
    if (resolveBoardPieceImage(piece)) return true;
    if ((piece.role === "bag" || piece.role === "accessory") && (piece.image ?? "").trim()) {
      return true;
    }
    return false;
  });
}

/** Transparent first (visual priority), white-plate last. */
function stackPieces(pieces: StylistPieceV1[]): StylistPieceV1[] {
  const rank = (id: string) => {
    const a = pieceImageAlpha(mvpItemById(id));
    if (a === "transparent") return 0;
    if (a === "opaque-other" || a === "unknown") return 1;
    return 2; // white-plate
  };
  return [...pieces].sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}

type Placement = { span: string; rotate: string; z: number; overlap?: string };

/**
 * Slight alpha overlap (Luisa 2026-09-12 size+name lock):
 * transparent tiles may share space; white-plate / opaque stay more separated and lower.
 */
function placements(
  total: number,
  alphas: Array<"transparent" | "white-plate" | "opaque-other" | "unknown">
): Placement[] {
  const zFor = (i: number) => {
    const a = alphas[i] ?? "unknown";
    if (a === "transparent") return 30 + i;
    if (a === "white-plate") return 5 + i;
    return 10 + i;
  };

  if (total <= 1) {
    return [{ span: "col-span-8 col-start-3", rotate: "-2deg", z: zFor(0) }];
  }
  if (total === 2) {
    return [
      {
        span: "col-span-7 col-start-1",
        rotate: "-3.5deg",
        z: zFor(0),
        overlap: alphas[0] === "transparent" ? "-mr-6" : undefined,
      },
      {
        span: "col-span-7 col-start-6",
        rotate: "4deg",
        z: zFor(1),
        overlap: alphas[1] === "transparent" ? "-ml-6" : undefined,
      },
    ];
  }
  if (total === 3) {
    return [
      {
        span: "col-span-6 col-start-1",
        rotate: "-3.5deg",
        z: zFor(0),
        overlap: alphas[0] === "transparent" ? "-mr-8" : undefined,
      },
      {
        span: "col-span-6 col-start-7",
        rotate: "4deg",
        z: zFor(1),
        overlap: alphas[1] === "transparent" ? "-ml-8" : undefined,
      },
      { span: "col-span-7 col-start-3 -mt-4", rotate: "2deg", z: zFor(2) },
    ];
  }
  if (total === 4) {
    return [
      {
        span: "col-span-6 col-start-1",
        rotate: "-3.5deg",
        z: zFor(0),
        overlap: alphas[0] === "transparent" ? "-mr-10" : undefined,
      },
      {
        span: "col-span-6 col-start-7",
        rotate: "4deg",
        z: zFor(1),
        overlap: alphas[1] === "transparent" ? "-ml-10" : undefined,
      },
      {
        span: "col-span-6 col-start-1 -mt-6",
        rotate: "2deg",
        z: zFor(2),
        overlap: alphas[2] === "transparent" ? "-mr-8" : undefined,
      },
      {
        span: "col-span-6 col-start-7 -mt-6",
        rotate: "-2.5deg",
        z: zFor(3),
        overlap: alphas[3] === "transparent" ? "-ml-8" : undefined,
      },
    ];
  }
  if (total === 5) {
    return [
      {
        span: "col-span-5 col-start-1",
        rotate: "-3deg",
        z: zFor(0),
        overlap: alphas[0] === "transparent" ? "-mr-6" : undefined,
      },
      {
        span: "col-span-5 col-start-7",
        rotate: "3.5deg",
        z: zFor(1),
        overlap: alphas[1] === "transparent" ? "-ml-6" : undefined,
      },
      { span: "col-span-5 col-start-4 -mt-5", rotate: "2deg", z: zFor(2) },
      {
        span: "col-span-5 col-start-1 -mt-4",
        rotate: "-2deg",
        z: zFor(3),
        overlap: alphas[3] === "transparent" ? "-mr-6" : undefined,
      },
      {
        span: "col-span-5 col-start-7 -mt-4",
        rotate: "4deg",
        z: zFor(4),
        overlap: alphas[4] === "transparent" ? "-ml-6" : undefined,
      },
    ];
  }
  return [
    {
      span: "col-span-6 col-start-1",
      rotate: "-3.5deg",
      z: zFor(0),
      overlap: alphas[0] === "transparent" ? "-mr-8" : undefined,
    },
    {
      span: "col-span-5 col-start-8",
      rotate: "4deg",
      z: zFor(1),
      overlap: alphas[1] === "transparent" ? "-ml-8" : undefined,
    },
    { span: "col-span-5 col-start-2 -mt-5", rotate: "2deg", z: zFor(2) },
    { span: "col-span-6 col-start-7 -mt-5", rotate: "-2.5deg", z: zFor(3) },
    { span: "col-span-4 col-start-1 -mt-3", rotate: "3deg", z: zFor(4) },
    { span: "col-span-4 col-start-5 -mt-3", rotate: "-4deg", z: zFor(5) },
    { span: "col-span-3 col-start-10 -mt-3", rotate: "5deg", z: zFor(6) },
    { span: "col-span-5 col-start-3 -mt-2", rotate: "-1.5deg", z: zFor(7) },
  ].slice(0, total);
}

/**
 * Tiles-only board (fittings parked 2026-09-12).
 * Size+name lock: ~half viewport for spotlight/Style; slight alpha overlap on collage.
 * `fittingLocked` kept for call-site compat; worn heroes / See it on are never shown.
 */
export function LookBoard({
  look,
  compact = false,
  fittingLocked: _fittingLocked = false,
}: {
  look: StylistLookV1;
  compact?: boolean;
  /** @deprecated Fittings parked — ignored; boards are always tiles-only. */
  fittingLocked?: boolean;
}) {
  const core = stackPieces(collagePieces(look.pieces));
  const elevate = stackPieces(collagePieces(look.levelUp));
  // Compact tiles (Lookbook archive): one collage strip — core + elevate bags.
  if (compact) {
    const flat = stackPieces([...core, ...elevate]);
    return (
      <article className="flex min-h-[148px] flex-col overflow-hidden bg-white">
        <div className="relative isolate flex min-h-[148px] flex-1 flex-col justify-center bg-white">
          <PieceSection label={null} pieces={flat} compact padBottom />
        </div>
      </article>
    );
  }

  return (
    <article className="flex min-h-[50vh] flex-col overflow-hidden bg-white">
      <div className="relative isolate flex min-h-[50vh] flex-1 flex-col justify-center bg-white">
        <PieceSection
          label={elevate.length ? "Core" : null}
          pieces={core}
          padBottom={!elevate.length}
        />
        {elevate.length ? (
          <PieceSection label="Elevate" pieces={elevate} padBottom elevate />
        ) : null}
      </div>
    </article>
  );
}

function PieceSection({
  label,
  pieces,
  compact,
  padBottom,
  elevate = false,
}: {
  label: string | null;
  pieces: StylistPieceV1[];
  compact?: boolean;
  padBottom?: boolean;
  elevate?: boolean;
}) {
  if (!pieces.length) return null;
  const alphas = pieces.map((piece) => pieceImageAlpha(mvpItemById(piece.id)));
  const slots = placements(pieces.length, alphas);
  return (
    <div className={elevate ? "border-t border-black/8" : undefined}>
      {label ? (
        <p
          className={`px-3 text-[9px] tracking-[0.22em] uppercase ${
            elevate ? "pt-2.5 text-black/45" : "pt-2 text-black/55"
          }`}
        >
          {label}
        </p>
      ) : null}
      <div
        className={`grid grid-cols-12 items-center ${
          compact ? "gap-x-0 gap-y-1 px-2.5" : "gap-x-0 gap-y-2 px-4"
        } ${label ? "pt-1.5" : compact ? "pt-2" : "pt-3"} ${
          padBottom ? (compact ? "pb-3" : "pb-6") : "pb-2"
        }`}
      >
        {pieces.map((piece, index) => (
          <BoardCutout
            key={`${elevate ? "elevate" : "core"}:${piece.id}`}
            piece={piece}
            placement={slots[index] ?? slots[slots.length - 1]}
            elevate={elevate}
            compact={compact}
            alpha={alphas[index] ?? "unknown"}
          />
        ))}
      </div>
    </div>
  );
}

function BoardCutout({
  piece,
  placement,
  elevate = false,
  compact = false,
  alpha,
}: {
  piece: StylistPieceV1;
  placement: Placement;
  elevate?: boolean;
  compact?: boolean;
  alpha: "transparent" | "white-plate" | "opaque-other" | "unknown";
}) {
  const src = resolveBoardPieceImage(piece);
  if (!src) return null;
  // Multiply only for known white-plate catalog tiles — store/bag piece.image stays clean
  const blend = alpha === "white-plate" ? "multiply" : undefined;
  return (
    <div
      className={`relative min-w-0 ${placement.span} ${placement.overlap ?? ""}`}
      style={{ transform: `rotate(${placement.rotate})`, zIndex: placement.z }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`block w-full bg-transparent object-contain ${compact ? "max-h-[112px]" : "max-h-[42vh]"}`}
        style={blend ? { mixBlendMode: blend } : undefined}
      />
      {elevate && !compact ? (
        <span className="pointer-events-none absolute -top-1 left-0 rounded-full bg-black/70 px-1.5 py-0.5 text-[8px] tracking-[0.14em] text-white uppercase">
          Elevate
        </span>
      ) : null}
    </div>
  );
}
