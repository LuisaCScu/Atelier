import { redirect } from "next/navigation";
import { closetItemFromForm, closetWouldExceedCap, readCloset, writeCloset } from "@/lib/closet-server";

export async function POST(request: Request) {
  const data = await request.formData();
  const names = data.getAll("name").map(String).map((value) => value.trim()).filter(Boolean);
  const current = await readCloset();
  if (names.length > 1) {
    redirect("/closet/add/video");
  }
  // Freemium: 10 closet items on free (CLOSET_FREE_CAP / FREE_CLOSET_ITEM_CAP).
  if (closetWouldExceedCap(current, 1)) {
    redirect("/closet/upgrade");
  }
  const item = closetItemFromForm(data);
  if (!item) redirect("/closet");
  await writeCloset([item, ...current]);
  redirect("/closet");
}
