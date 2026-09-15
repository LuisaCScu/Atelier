const LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/disclosure", label: "Disclosure" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-black/8 bg-[#f3f3f3] px-5 pt-6 pb-28">
      <nav aria-label="Site" className="mx-auto flex max-w-[460px] flex-wrap justify-center gap-x-4 gap-y-2">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} className="text-[12px] text-black/45 hover:text-black">
            {link.label}
          </a>
        ))}
      </nav>
      <p className="mx-auto mt-3 max-w-[460px] text-center text-[11px] text-black/30">Atelier</p>
    </footer>
  );
}
