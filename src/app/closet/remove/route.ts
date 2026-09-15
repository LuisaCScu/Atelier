import { redirect } from "next/navigation";
import { readCloset, writeCloset } from "@/lib/closet-server";

export async function POST(request: Request) {
  const data = await request.formData();
  const id = String(data.get("id") ?? "");
  const current = await readCloset();
  await writeCloset(current.filter((item) => item.id !== id));
  redirect("/closet");
}
