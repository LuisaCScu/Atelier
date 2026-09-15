import { redirect } from "next/navigation";
import { closetItemFromForm, closetWouldExceedCap, readCloset, writeCloset } from "@/lib/closet-server";

export async function POST(request: Request) {
  const data = await request.formData();
  const names = data.getAll("name").map(String).map((value) => value.trim()).filter(Boolean);
  const current = await readCloset();
  if (names.length > 1) {
    redirect("/closet/add/video");
  }
  if (closetWouldExceedCap(current, 1)) {
    redirect("/closet/upgrade");
  }
  const item = closetItemFromForm(data);
  if (!item) redirect("/closet");
  await writeCloset([item, ...current]);
  redirect("/closet");
}
