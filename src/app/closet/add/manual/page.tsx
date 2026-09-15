import { redirect } from "next/navigation";

/** Thin redirect — Manual renamed to Note. */
export default function ManualAddRedirectPage() {
  redirect("/closet/add/note");
}
