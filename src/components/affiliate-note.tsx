export function AffiliateNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-[12px] leading-5 text-black/40 ${className}`}>
      Atelier may earn a commission if you shop through these links.{" "}
      <a href="/disclosure" className="underline underline-offset-2">
        Affiliate disclosure
      </a>
    </p>
  );
}
