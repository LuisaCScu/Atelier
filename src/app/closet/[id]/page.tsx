import { ClosetEdit } from "@/components/closet/closet-edit";

export default async function ClosetItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ styling?: string; quota?: string; edit?: string }>;
}) {
  const { id } = await params;
  const { styling, quota, edit } = await searchParams;
  const editFlag = (edit ?? "").trim().toLowerCase();
  return (
    <ClosetEdit
      id={decodeURIComponent(id)}
      stylingRequestId={styling?.trim() || undefined}
      quotaExhausted={quota === "exhausted"}
      forceEdit={editFlag === "1" || editFlag === "true"}
    />
  );
}
