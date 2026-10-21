// Isolated demo: production components, fictional data and memory-only writes.
import { useState } from 'react';
import { NutritionDiary } from '../src/components/NutritionDiary';
import { NutritionFoodHistory } from '../src/components/NutritionFoodHistory';
import { FoodComposer } from '../src/components/NutritionFoodComposer';
import { ProfileForm } from '../src/components/Nutrition';
import { PageHeading } from '../src/components/PageHeading';
import { NutritionSavedMeals } from '../src/components/NutritionSavedMeals';
import type { SavedMealDraft } from '../src/components/NutritionSavedMeals';
import { NutritionScanner } from '../src/components/NutritionScanner';
import { appendMealEntries } from '../src/nutritionMeals';
import { datedWeights, goalDateInMonths, localDate } from '../src/nutrition';
import { mergeFoodHistory } from '../src/nutritionHistory';
import type { FoodHistoryEntry } from '../src/nutritionHistory';
import type { FoodEntry, Meal, NutritionDay, NutritionProfile, SavedMeal } from '../src/nutrition';

const today=localDate();
const profile:NutritionProfile={goal:'gain',targetKg:84,age:25,heightCm:180,weightKg:80,activity:'active',equationSex:'male',dailyActivity:'sedentary',sessionsPerWeek:4,sessionMinutes:60,trainingKind:'strength',goalDate:goalDateInMonths(4)};
const food=(id:string,meal:Meal,name:string,brand:string,quantity:number,kcal100:number,protein100:number,carbs100:number,fat100:number,fiber100:number):FoodEntry=>({id,meal,food:{name,brand,source:'manual',unit:'g',kcal100,protein100,carbs100,fat100,fiber100},quantity,addedAt:new Date().toISOString()});
const entries=[food('oats','breakfast','Flocons d’avoine','Quaker',60,370,13,58,7,10),food('skyr','breakfast','Skyr nature','Danone',150,60,10,4,0.2,0),food('banana','breakfast','Banane','',120,87.6,1.06,19.7,0.5,2.7),food('rice','lunch','Riz basmati, cuit','',200,130,2.7,28,0.3,0.4),food('chicken','lunch','Filet de poulet, cuit','',160,165,31,0,3.6,0),food('almonds','snack','Amandes nature','Carrefour',25,620,21,7,55,12)];
export function PremiumNutritionDemo({focusWeight=false}:{focusWeight?:boolean}) {
  const [day,setDay]=useState<NutritionDay>({date:today,entries,waterMl:1250,weightKg:80.2});
  const [recent,setRecent]=useState<FoodHistoryEntry[]>(entries.map(entry=>({...entry,diaryDate:today})));
  const [days,setDays]=useState<Record<string,NutritionDay>>({});
  const [composer,setComposer]=useState<{meal:Meal;entry?:FoodEntry;initial?:FoodEntry}>();
  const [historyOpen,setHistoryOpen]=useState(false);
  const [savedMeals,setSavedMeals]=useState<SavedMeal[]>([{id:'usual-breakfast',name:'Mon petit-déjeuner habituel',meal:'breakfast',items:entries.filter(item=>item.meal==='breakfast').map(({food,quantity})=>({food,quantity})),updatedAt:new Date().toISOString()}]);
  const [savedDialog,setSavedDialog]=useState<{meal:Meal;initial?:SavedMealDraft}>();
  const [currentProfile,setCurrentProfile]=useState(profile);
  const [editingProfile,setEditingProfile]=useState(false);
  const saveDay=(next:NutritionDay)=>{setDay(next);setRecent(previous=>mergeFoodHistory(previous,next.date,next.entries));};
  const openSaved=(meal:Meal,save=false)=>setSavedDialog({meal,...(save?{initial:{meal,items:day.entries.filter(entry=>entry.meal===meal).map(({food,quantity})=>({food,quantity}))}}:{})});
  const latestWeight=datedWeights(currentProfile,[...Object.values(days),day]).at(-1)?.weightKg ?? currentProfile.weightKg;
  const profileForEdit={...currentProfile,weightKg:latestWeight,...(currentProfile.goal==='maintain'?{targetKg:latestWeight}:{})};
  return <>
    {editingProfile ? <section className="nutrition-page"><PageHeading eyebrow="Nutrition" title="Mon profil nutrition" description="Tes repères, adaptés à ton quotidien."/><ProfileForm initial={profileForEdit} saving={false} onCancel={()=>setEditingProfile(false)} onSave={async next=>{setCurrentProfile(next);setEditingProfile(false);}}/></section> : <NutritionDiary profile={currentProfile} day={day} date={day.date} busy={false} loading={false} error="" focusWeight={focusWeight} weightHistory={Object.values(days).filter((item):item is NutritionDay & {weightKg:number}=>item.weightKg!==undefined)}
      onDate={date=>{setDays(previous=>({...previous,[day.date]:day}));setDay(days[date] ?? {date,entries:[]});}}
      onHistory={()=>setHistoryOpen(true)} onProfile={()=>setEditingProfile(true)} onAdd={meal=>setComposer({meal})} onEdit={entry=>setComposer({meal:entry.meal,entry})}
      onSavedMeals={meal=>openSaved(meal)} onSaveMeal={meal=>openSaved(meal,true)} onWeight={async weightKg=>saveDay({...day,weightKg})}
      onRemove={entry=>saveDay({...day,entries:day.entries.filter(item=>item.id!==entry.id)})} onSteps={async count=>saveDay({...day,steps:{count,source:'manual',updatedAt:new Date().toISOString()}})} onWater={async waterMl=>saveDay({...day,waterMl})} onRefresh={()=>{}} onHealthConnect={()=>alert('Démonstration : la connexion Santé reste désactivée.')}/>}
    {historyOpen && <NutritionFoodHistory entries={recent} loading={false} error="" onRetry={()=>{}} onClose={()=>setHistoryOpen(false)} onSelect={(entry,meal)=>{setHistoryOpen(false);setComposer({meal,initial:entry});}}/>}
    {savedDialog && <NutritionSavedMeals meals={savedMeals} meal={savedDialog.meal} initial={savedDialog.initial} loading={false} error="" onRetry={()=>{}} onSave={async saved=>setSavedMeals(previous=>[saved,...previous.filter(item=>item.id!==saved.id)])} onAdd={async items=>saveDay(appendMealEntries(day,items))} onClose={()=>setSavedDialog(undefined)}/>}
    {composer && <FoodComposer meal={composer.meal} existing={composer.entry} initial={composer.initial} recent={recent} onSave={async entry=>saveDay({...day,entries:[...day.entries.filter(item=>item.id!==entry.id),entry]})} onClose={()=>setComposer(undefined)} renderScanner={(onCode,onError)=><NutritionScanner onCode={onCode} onError={onError}/>}/>}
  </>;
}
