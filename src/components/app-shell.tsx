"use client";

import { HangerIcon, PersonIcon, StyleIcon, WardrobeIcon } from "@/components/icons";
import { CherryMark } from "@/components/marks";
import { cn } from "cn";
import { useRouter } from "next/navigation";

const TABS = [
  { href: "/style", label: "Style", icon: StyleIcon, id: "style" },
  { href: "/lookbook", label: "Lookbook", icon: HangerIcon, id: "lookbook" },
  { href: "/closet", label: "Closet", icon: WardrobeIcon, id: "closet" },
  { href: "/profile", label: "Profile", icon: PersonIcon, id: "profile" },
] as const;

export type AppTab = (typeof TABS)[number]["id"];

export function AppShell({
  children,
  tab,
  hideTabs = false,
}: {
  children: React.ReactNode;
  tab?: AppTab;
  hideTabs?: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5 pb-28 pt-6">
      {children}
      {hideTabs ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-black/8 bg-[#f3f3f3]">
          <div className="mx-auto grid max-w-[460px] grid-cols-4 px-3 pt-2.5 pb-3.5">
            {TABS.map((item) => {
              const active = tab === item.id;
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  data-atelier-tour={item.id}
                  className={cn(
                    "flex flex-col items-center gap-1 py-1 text-[11px]",
                    active ? "font-medium text-black" : "font-normal text-black/35"
                  )}
                >
                  <Icon className={cn("size-[22px]", active ? "stroke-[1.6]" : "stroke-[1.3]")} />
                  {item.label}
                </a>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}

export function ScreenHeader({
  backHref,
  closeHref,
  title,
  right,
}: {
  backHref?: string;
  /** Isolated Profile editor — Close returns to Profile (no onboarding Back). */
  closeHref?: string;
  title?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  const href = closeHref || backHref;
  const closeMode = Boolean(closeHref);
  return (
    <header className="mb-6 flex items-center justify-between">
      {href ? (
        <button
          type="button"
          onClick={() => router.push(href)}
          className={
            closeMode
              ? "flex h-9 items-center px-1 text-[13px] text-black/55"
              : "flex size-9 items-center justify-center text-black"
          }
          aria-label={closeMode ? "Close" : "Back"}
        >
          {closeMode ? (
            "Close"
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path d="M15 5.5 8.5 12 15 18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ) : (
        <span className="size-9" />
      )}
      {title ? (
        <p className="font-serif text-[13px] tracking-[0.28em] uppercase">{title}</p>
      ) : (
        <BrandWord height={40} />
      )}
      {right ?? <span className="size-9" />}
    </header>
  );
}

export function BrandWord({ className, height = 48 }: { className?: string; height?: number }) {
  const mark = Math.round(height * 0.72);
  const type = Math.max(13, Math.round(height * 0.36));
  return (
    <a
      href="/"
      aria-label="Atelier"
      className={cn("inline-flex items-center gap-2.5 text-current", className)}
    >
      <CherryMark className="shrink-0" style={{ height: mark, width: mark }} />
      <span className="font-serif tracking-[0.2em]" style={{ fontSize: type }}>
        ATELIER
      </span>
    </a>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-12 w-full items-center justify-center rounded-xl bg-black text-[15px] font-medium text-white disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-12 w-full items-center justify-center rounded-xl border border-black/80 bg-white text-[15px] font-medium text-black disabled:opacity-40",
        className
      )}
    >
      {children}
    </button>
  );
}
