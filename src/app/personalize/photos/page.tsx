import { redirect } from "next/navigation";

/** Body-angle photos are gone. Face lives on the unknown-season color step. */
export default function PhotosPage() {
  redirect("/personalize/color");
}
