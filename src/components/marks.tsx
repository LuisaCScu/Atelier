import { cn } from "cn";

type IconProps = { className?: string };

export function SlidersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="7" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="17" r="2.1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function CameraLine({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <path d="M4.5 8.2h3.1l1.2-2.2h6.4l1.2 2.2h3.1A1.5 1.5 0 0 1 21 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5V9.7a1.5 1.5 0 0 1 1.5-1.5Z" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="12" cy="14" r="3.1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function VideoLine({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <rect x="3.2" y="6.5" width="12.2" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M15.4 10.4 20.8 8v8l-5.4-2.4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function PencilLine({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <path d="M14.2 5.4 18.6 9.8 8 20.4H3.6V16Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="m12.6 7 4.4 4.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function BookmarkLine({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-4", className)} aria-hidden>
      <path d="M7 4.8h10v14.4L12 16.2 7 19.2V4.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function LockLine({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-3.5", className)} aria-hidden>
      <rect x="5" y="10" width="14" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 10V7.6a4 4 0 0 1 8 0V10" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function SparkleLine({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-3.5", className)} aria-hidden>
      <path d="M12 4.5 13.4 10 19 11.5 13.4 13 12 18.5 10.6 13 5 11.5 10.6 10Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function WardrobeEmpty({ className }: IconProps) {
  return (
    <svg viewBox="0 0 80 72" fill="none" className={cn("h-16 w-[72px]", className)} aria-hidden>
      <rect x="10" y="6" width="60" height="60" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M40 6v60" stroke="currentColor" strokeWidth="1.6" />
      <path d="M26 28v10M54 28v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M22 18h10M22 22c0 4 2.4 6 5 6s5-2 5-6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <rect x="48" y="46" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function OccasionGlyph({ name, className }: { name: string; className?: string }) {
  const cls = cn("size-5", className);
  if (name === "briefcase") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <rect x="3.5" y="8" width="17" height="11.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 8V6.4A1.4 1.4 0 0 1 9.4 5h5.2A1.4 1.4 0 0 1 16 6.4V8" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  if (name === "cup") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <path d="M6 8h9v6.2A3.8 3.8 0 0 1 11.2 18H9.8A3.8 3.8 0 0 1 6 14.2V8Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M15 9.4h2.4A2.2 2.2 0 0 1 19.6 11.6 2.2 2.2 0 0 1 17.4 13.8H15" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    );
  }
  if (name === "glass") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <path d="M7 5h10l-3.4 7.4A2.8 2.8 0 0 1 11 14.4 2.8 2.8 0 0 1 8.4 12.4L5 5h2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M12 14.4V19M9.5 19h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "plane") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <path d="M3.5 13.2 21 8.4l-2.2 8.2-4.2-2.4-3.2 3.6-.8-3.2-4.8 1.2 1.2-3.6-3.5 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
      <rect x="5" y="5.5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 10h4M8 13h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}


export function CherryMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn("size-8", className)} style={style} aria-hidden>
      <path
        d="M32 10c4.2-6.2 14.2-6.4 12.4 1.6-3.2.8-8.2 2.2-12.4-1.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M32 12.5c-.8 11-9.4 15.6-14.6 26" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M32 12.5c1.4 9.8 12.6 15.6 16.8 25.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="16.2" cy="47.2" r="10.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="49" cy="46.2" r="10.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function BrandMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <CherryMark className={className} style={style} />;
}

export const pageWrap = "mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 py-6";
export const ctaPrimary =
  "flex h-12 w-full items-center justify-center rounded-xl bg-black text-[15px] font-medium text-white";
export const ctaSecondary =
  "flex h-12 w-full items-center justify-center rounded-xl border border-black bg-white text-[15px] font-medium text-black";
export const sectionLabel = "text-[11px] tracking-[0.16em] text-black/40 uppercase";
