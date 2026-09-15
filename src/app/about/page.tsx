import { TrustCard, TrustPage } from "@/components/trust-page";
import { ATELIER_CONTACT_EMAIL } from "@/lib/contact";

export const metadata = { title: "About · Atelier" };

export default function AboutPage() {
  return (
    <TrustPage
      title="About Atelier"
      lede="A digital stylist lookbook. You share a little about yourself. We return a few shoppable outfits that fit."
    >
      <TrustCard title="Who we are">
        <p>
          Atelier is a shopping tool — a quiet place to get dressed, not an influencer feed. Looks are built for your
          profile, then linked to pieces from a curated retailer catalog.
        </p>
      </TrustCard>
      <TrustCard title="How looks are made">
        <p>1. You create a profile — color, a few likes, occasions, and a budget.</p>
        <p>2. That profile goes to Atelier’s stylist. They compose four outfits inside the budget.</p>
        <p>3. Your lookbook opens with shoppable boards: the full look, then the pieces, with a short why for fit, color, and vibe.</p>
      </TrustCard>
      <TrustCard title="Contact">
        <p>
          Questions:{" "}
          <a className="underline underline-offset-2" href={`mailto:${ATELIER_CONTACT_EMAIL}`}>
            {ATELIER_CONTACT_EMAIL}
          </a>
        </p>
      </TrustCard>
    </TrustPage>
  );
}
