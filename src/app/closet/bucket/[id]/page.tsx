import { ClosetScreen } from "@/components/closet/closet-grid";

export default async function ClosetBucketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClosetScreen bucketId={id} />;
}
