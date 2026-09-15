import { redirect } from "next/navigation";
import { defaultSession } from "@/lib/generate";
import { readSession, writeSession } from "@/lib/session";

/** Mock Premium unlock — no Stripe. Create/shop stay free; worn fittings remain parked sitewide. */
export async function POST(request: Request) {
  const current = (await readSession()) ?? defaultSession();
  await writeSession({ ...current, hasPremium: true });
  let next = "/style";
  try {
    const data = await request.formData();
    const raw = data.get("next");
    if (typeof raw === "string" && raw.startsWith("/")) next = raw;
  } catch {
    /* keep lookbook */
  }
  redirect(next);
}

export function GET() {
  redirect("/upgrade");
}
