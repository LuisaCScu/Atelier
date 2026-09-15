import { redirect } from "next/navigation";

/** Old path-fork URL. The fork now lives on `/`. */
export default function StartPage() {
  redirect("/");
}
