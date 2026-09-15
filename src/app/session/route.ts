import { redirect } from "next/navigation";
import { defaultSession } from "@/lib/generate";
import { mergeSessionFromForm, readSession, writeSession } from "@/lib/session";

export async function POST(request: Request) {
  const data = await request.formData();
  const current = (await readSession()) ?? defaultSession();
  const next = mergeSessionFromForm(current, data);
  await writeSession(next);

  if (data.get("generate") === "1") {
    next.generated = true;
    next.seed = Date.now();
    await writeSession(next);
    redirect("/style");
  }

  const dest = String(data.get("next") || "/profile");
  if (!dest.startsWith("/")) redirect("/profile");
  redirect(dest);
}
