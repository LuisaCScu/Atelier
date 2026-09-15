"use client";

import { OnceForm } from "@/components/once-form";
import { ctaPrimary } from "@/components/marks";

/**
 * How to style it — styleThisPiece generate.
 * Manual How to style it CTA. Piece detail auto-starts via piece-style-cache; keep for reuse.
 */
export function StyleThisPieceCta({
  pieceId,
  pieceName,
  className,
}: {
  pieceId: string;
  pieceName?: string;
  className?: string;
}) {
  if (!pieceId.trim()) return null;
  return (
    <div className={className}>
      <OnceForm
        action="/generate"
        generateMode="styleThisPiece"
        closetPieceId={pieceId}
        className="w-full"
      >
        <button type="submit" className={ctaPrimary}>
          How to style it
        </button>
      </OnceForm>
      <p className="mt-2 text-center text-[12px] leading-5 text-black/45">
        Outfit ideas around{pieceName ? ` “${pieceName}”` : " this piece"} — not a full-wardrobe Style my
        closet. Tiles only · no fittings.
      </p>
    </div>
  );
}

/** Compact chip/link on Closet grid tile — opens piece detail (CTA lives there). */
export function StyleThisPieceChip({ pieceId }: { pieceId: string }) {
  if (!pieceId.trim()) return null;
  return (
    <span className="pointer-events-none absolute top-1.5 right-1.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[9px] font-medium tracking-wide text-white uppercase">
      Style
    </span>
  );
}
