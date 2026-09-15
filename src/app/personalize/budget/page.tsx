import { BudgetStep } from "@/components/personalize/budget-step";
import { isProfileEdit } from "@/lib/profile-edit";
import { readSession } from "@/lib/session";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ quota?: string; from?: string; edit?: string }>;
}) {
  const session = await readSession();
  const params = await searchParams;
  return (
    <BudgetStep
      budgetMax={session?.budgetMax ?? 250}
      name={session?.name ?? "Alex"}
      generateUserKey={session?.generateUserKey}
      requestId={session?.stylistRequestId}
      quotaExhausted={params.quota === "exhausted"}
      fromProfile={isProfileEdit(params)}
    />
  );
}
