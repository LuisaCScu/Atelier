import { redirect } from "next/navigation";

/** Public showcase is offline for Friend beta. Community feed is later. */
export default function LooksIndexPage() {
  redirect("/how");
}
