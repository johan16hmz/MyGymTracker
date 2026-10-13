import type { Food, FoodEntry } from './nutrition';
export type FoodHistoryEntry=FoodEntry & {diaryDate?:string};
export interface FoodHistoryItem {key:string;entry:FoodHistoryEntry;count:number;lastDate:string}

export function foodHistoryKey(food:Pick<Food,'name'|'id'|'barcode'|'brand'|'unit'>):string {
  return JSON.stringify([food.barcode || food.id || food.name.trim().toLocaleLowerCase(),food.brand?.trim().toLocaleLowerCase() || '',food.unit]);
}
export function foodHistory(entries:FoodHistoryEntry[]):FoodHistoryItem[] {
  const groups=new Map<string,FoodHistoryItem>();
  const seen=new Set<string>();
  const sorted=[...entries].sort((a,b)=>(b.diaryDate ?? b.addedAt.slice(0,10)).localeCompare(a.diaryDate ?? a.addedAt.slice(0,10)) || b.addedAt.localeCompare(a.addedAt));
  for(const entry of sorted) {
    if(seen.has(entry.id) || !entry.food?.name || !Number.isFinite(entry.quantity) || entry.quantity<=0)continue;
    seen.add(entry.id);
    const key=foodHistoryKey(entry.food);const item=groups.get(key);
    if(item)item.count++;
    else groups.set(key,{key,entry,count:1,lastDate:entry.diaryDate ?? entry.addedAt.slice(0,10)});
  }
  return [...groups.values()];
}
export function mergeFoodHistory(previous:FoodHistoryEntry[],date:string,entries:FoodEntry[]):FoodHistoryEntry[] {
  return [...entries.map(entry=>({...entry,diaryDate:date})),...previous.filter(entry=>entry.diaryDate!==date && !entries.some(item=>item.id===entry.id))];
}
export function searchFoodHistory(items:FoodHistoryItem[],query:string):FoodHistoryItem[] {
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
  return items.filter(item=>terms.every(term=>normalize(`${item.entry.food.name} ${item.entry.food.brand ?? ''}`).includes(term)));
}
