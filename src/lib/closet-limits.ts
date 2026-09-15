export type ClosetPlan = 'free' | 'premium';
export const closetLimit = (plan: ClosetPlan) => plan === 'premium' ? 100 : 10;
export function canAddPieces(plan: ClosetPlan, current: number, incoming: number) {
 return Number.isInteger(incoming) && incoming > 0 && current + incoming <= closetLimit(plan);
}
