import { redirect } from "next/navigation";

/** Legacy You tab → Profile (four-bucket IA). */
export default function YouRedirectPage() {
  redirect("/profile");
}
