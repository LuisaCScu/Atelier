export const budgetStops = [100,150,200,250,300,350,400,450,500,...Array.from({length:15},(_,i)=>600+i*100)];
export function budgetIndex(value:number){const safe=Number.isFinite(value)?value:300;return budgetStops.reduce((best,amount,index)=>Math.abs(amount-safe)<Math.abs(budgetStops[best]-safe)?index:best,0);}
export function normalizeBudget(value:number){return budgetStops[budgetIndex(value)];}
