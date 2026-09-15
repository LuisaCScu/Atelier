import {lookKey,type Look} from './stylist';
import type {ClosetPlan} from './closet-limits';
export const savedLookLimit=(plan:ClosetPlan)=>plan==='premium'?100:10;
export function saveToLookbook(saved:Look[],look:Look,plan:ClosetPlan,replaceId?:string):Look[]|null{
 if(saved.some(x=>lookKey(x)===lookKey(look)))return saved;
 if(replaceId&&!saved.some(x=>x.id===replaceId))return null;
 const retained=replaceId?saved.filter(x=>x.id!==replaceId):saved;
 if(retained.length>=savedLookLimit(plan))return null;
 return [look,...retained];
}
