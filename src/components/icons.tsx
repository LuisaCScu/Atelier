import { cn } from "cn";

type IconProps = { className?: string };

export function StyleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <path
        d="M12 3.5v3.2M12 17.3V20.5M3.5 12h3.2M17.3 12H20.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M6.6 6.6 8.8 8.8M15.2 15.2l2.2 2.2M17.4 6.6 15.2 8.8M8.8 15.2 6.6 17.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function HangerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <path
        d="M12 4.5a1.6 1.6 0 0 1 1.55 2.02L9.2 12.2A1 1 0 0 0 10 13.8h10.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.8 13.8h16.4L20.8 16a1.2 1.2 0 0 1-1.1.8H4.3A1.2 1.2 0 0 1 3.2 16l.6-2.2Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WardrobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 3.5v17" stroke="currentColor" strokeWidth="1.4" />
      <path d="M9.2 11.5h.1M14.7 11.5h.1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function PersonIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-6", className)} aria-hidden>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.8 19.2c.7-3.2 3.1-5 6.2-5s5.5 1.8 6.2 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BackArrow({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <path d="M15 5.5 8.5 12 15 18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
