import { TrustCard, TrustPage } from "@/components/trust-page";
import { ATELIER_CONTACT_EMAIL } from "@/lib/contact";

export const metadata = { title: "Affiliate disclosure · Atelier" };

export default function DisclosurePage() {
  return (
    <TrustPage
      title="Affiliate disclosure"
      lede="Atelier is a shopping tool. Some links on this site are affiliate links."
    >
      <TrustCard title="Commissions">
        <p>
          Atelier may earn a commission if you click a shop link and buy — at no extra cost to you. We may join
          affiliate partners and networks; we’ll name live programs here once Store confirms them. Until then we
          describe them generically as affiliate partners / networks we join.
        </p>
      </TrustCard>
      <TrustCard title="How we choose pieces">
        <p>
          Looks start from your profile — fit, color, budget, and taste. An affiliate relationship can affect which
          retailer URL we attach to a piece. It should not change the styling advice.
        </p>
      </TrustCard>
      <TrustCard title="This notice">
        <p>
          This page is our FTC affiliate disclosure. Shop buttons on a look also carry a one-line reminder with a link
          back here.
        </p>
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
