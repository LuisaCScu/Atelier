import { BrandWord, ScreenHeader } from "@/components/app-shell";
import { ctaPrimary, pageWrap } from "@/components/marks";

export const metadata = { title: "What is Atelier" };

const STEPS = [
  {
    title: "A short profile",
    body: "Color, a few likes, occasions, and a budget. Optional daylight face photo stays on this device. No body photos.",
  },
  {
    title: "Looks styled for you",
    body: "A stylist composes outfits from a curated catalog for your body, colors, and preferences — inside your budget. Each look is a shoppable tile board with a recipe and price.",
  },
  {
    title: "Shop, then keep",
    body: "Each board is shoppable. Wear or Maybe saves a look to your lookbook. Add what you already own and mix it next time.",
  },
];

const BENEFITS = [
  { title: "Not a feed", body: "No scrolling other people’s closets. Your board is yours." },
  { title: "Fits the budget", body: "Looks are built to a number you set, then linked to real pieces." },
  { title: "Closet, later", body: "Photograph what you own. Generate can mix it with the store." },
  { title: "Tiles you can shop", body: "Every look is cutouts, formula, and price — tap through to the pieces." },
];

const SPREADS = [
  {
    src: "/style-cards/sc-navy-blazer-tee.jpg",
    kicker: "Scandi Clean",
    title: "Navy blazer, white tee",
  },
  {
    src: "/style-cards/fg-breton-trench.jpg",
    kicker: "French Girl Ease",
    title: "Breton, trench, jeans",
  },
  {
    src: "/style-cards/am-leopard-scarf.jpg",
    kicker: "Animal Mark",
    title: "Leopard scarf, leather",
  },
  {
    src: "/style-cards/ba-cobalt-elevate.jpg",
    kicker: "Bright Accent",
    title: "Black column, cobalt",
  },
] as const;

export default function WhatIsAtelierPage() {
  return (
    <div className={pageWrap}>
      <ScreenHeader backHref="/" />
      <p className="text-[11px] tracking-[0.22em] text-black/40 uppercase">Editorial</p>
      <h1 className="mt-3 font-serif text-[40px] leading-[1.05] tracking-tight">What is Atelier</h1>
      <p className="mt-4 font-serif text-[20px] leading-7 text-black/70">
        A private stylist lookbook — looks styled for you, then you shop them. Not a community feed.
      </p>

      <figure className="-mx-5 mt-8 overflow-hidden bg-[#ececec]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/style-cards/ps-eyelet-midi.jpg"
          alt="Cream eyelet blouse and beige midi skirt"
          className="aspect-[4/5] w-full object-cover object-top"
        />
        <figcaption className="px-5 py-3 text-[12px] tracking-[0.14em] text-black/40 uppercase">
          Poet Soft · eyelet and midi
        </figcaption>
      </figure>

      <h2 className="mt-12 font-serif text-[28px] leading-tight">How it works</h2>
      <ol className="mt-5 space-y-5">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <p className="text-[11px] tracking-[0.18em] text-black/35 uppercase">{String(index + 1).padStart(2, "0")}</p>
            <h3 className="mt-1 font-serif text-[22px] leading-tight">{step.title}</h3>
            <p className="mt-2 text-[15px] leading-6 text-black/55">{step.body}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-12 font-serif text-[28px] leading-tight">Why people stay</h2>
      <ul className="mt-5 space-y-6">
        {BENEFITS.map((item) => (
          <li key={item.title}>
            <h3 className="font-serif text-[20px] leading-tight">{item.title}</h3>
            <p className="mt-1 text-[14px] leading-6 text-black/55">{item.body}</p>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 font-serif text-[28px] leading-tight">Looks we are proud of</h2>
      <p className="mt-2 text-[14px] leading-6 text-black/50">
        Curated looks from Atelier — not a public showcase of other people’s boards.
      </p>
      <div className="-mx-5 mt-6 columns-2 gap-2 px-0">
        {SPREADS.map((shot) => (
          <figure key={shot.src} className="mb-2 break-inside-avoid bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shot.src} alt={shot.title} className="w-full object-cover object-top" />
            <figcaption className="px-3 py-2.5">
              <p className="text-[10px] tracking-[0.16em] text-black/40 uppercase">{shot.kicker}</p>
              <p className="mt-0.5 font-serif text-[15px] leading-tight">{shot.title}</p>
            </figcaption>
          </figure>
        ))}
      </div>

      <a href="/personalize" className={`${ctaPrimary} mt-10`}>
        Create profile
      </a>
      <div className="mt-8 flex justify-center">
        <BrandWord height={36} />
      </div>
    </div>
  );
}
