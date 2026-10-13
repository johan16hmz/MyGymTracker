// Development-only fixture. All writes remain in memory, never in an account.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NutritionDiary } from '../src/components/NutritionDiary';
import { NutritionFoodHistory } from '../src/components/NutritionFoodHistory';
import { FoodComposer } from '../src/components/NutritionFoodComposer';
import { localDate } from '../src/nutrition';
import { mergeFoodHistory } from '../src/nutritionHistory';
import type { FoodHistoryEntry } from '../src/nutritionHistory';
import { setLanguage } from '../src/i18n';
import type { FoodEntry, Meal, NutritionDay, NutritionProfile } from '../src/nutrition';
import '../src/ui.css';

const profile:NutritionProfile={goal:'maintain',targetKg:80,age:25,heightCm:180,weightKg:80,activity:'active',equationSex:'male',calorieOverride:2650};
const today=localDate();
const entries:FoodEntry[]=[{id:'banana',meal:'breakfast',food:{name:'Banane, chair sans peau, crue',source:'ciqual',unit:'g',kcal100:87.6,protein100:1.06,carbs100:19.7,fat100:0.5,fiber100:2.7},quantity:120,addedAt:new Date().toISOString()},{id:'yogurt',meal:'breakfast',food:{name:'Yaourt nature au lait entier',brand:'Carrefour',source:'manual',unit:'g',kcal100:62.1,protein100:3.7,carbs100:4.7,fat100:3,fiber100:0},quantity:125,addedAt:new Date().toISOString()}];
const history:FoodHistoryEntry[]=[...entries.map(entry=>({...entry,diaryDate:today})),{...entries[1],id:'old-yogurt',quantity:250,diaryDate:'2026-09-01',addedAt:'2026-09-01T08:00:00Z'},{id:'oats',meal:'breakfast',quantity:65,diaryDate:'2026-08-25',addedAt:'2026-08-25T08:00:00Z',food:{name:'Flocons d’avoine',brand:'Quaker',source:'manual',unit:'g',kcal100:370,protein100:13,carbs100:58,fat100:7,fiber100:10}}];
function Preview(){
  const [day,setDay]=useState<NutritionDay>({date:today,entries,waterMl:750});
  const [recent,setRecent]=useState(history);
  const [days,setDays]=useState<Record<string,NutritionDay>>({});
  const [composer,setComposer]=useState<{meal:Meal;entry?:FoodEntry;initial?:FoodEntry}>();
  const [historyOpen,setHistoryOpen]=useState(false);
  const [fail,setFail]=useState(false);
  const [dark,setDark]=useState(false);
  const saveDay=(next:NutritionDay)=>{setDay(next);setRecent(previous=>mergeFoodHistory(previous,next.date,next.entries));};
  document.documentElement.dataset.theme=dark?'dark':'light';
  return <div className="app"><header className="app-header"><h2>MyGymTracker</h2><p className="nav-caption">APERÇU LOCAL</p><p>Données fictives uniquement</p></header><main className="app-main">
    <div className="stats-preview-controls">Nutrition · aucun envoi vers ton compte<button className="btn btn-small" onClick={()=>setDark(value=>!value)}>Changer le thème</button><button className="btn btn-small" onClick={()=>setLanguage('fr')}>Français</button><button className="btn btn-small" onClick={()=>setLanguage('en')}>English</button></div>
    <NutritionDiary profile={profile} day={day} date={day.date} busy={false} loading={false} error=""
      onDate={date=>{setDays(previous=>({...previous,[day.date]:day}));setDay(days[date] ?? {date,entries:[]});}}
      onHistory={()=>setHistoryOpen(true)} onProfile={()=>alert('Profil fictif, non modifié dans cet aperçu.')} onAdd={meal=>setComposer({meal})} onEdit={entry=>setComposer({meal:entry.meal,entry})}
      onRemove={entry=>saveDay({...day,entries:day.entries.filter(item=>item.id!==entry.id)})} onSteps={async(count)=>saveDay({...day,steps:{count,source:'manual',updatedAt:new Date().toISOString()}})} onWater={async(waterMl)=>saveDay({...day,waterMl})} onRefresh={()=>{}} onHealthConnect={()=>alert('Démo locale : Santé reste désactivée.')}/>
    {historyOpen && <NutritionFoodHistory entries={recent} loading={false} error="" onRetry={()=>{}} onClose={()=>setHistoryOpen(false)} onSelect={(entry,meal)=>{setHistoryOpen(false);setComposer({meal,initial:entry});}}/>}
    {composer && <FoodComposer meal={composer.meal} existing={composer.entry} initial={composer.initial} recent={recent} onSave={async(entry)=>{if(fail)throw new Error('Échec de test : tes saisies sont conservées, réessaie.');saveDay({...day,entries:[...day.entries.filter(item=>item.id!==entry.id),entry]});}} onClose={()=>setComposer(undefined)} renderScanner={()=><p>Caméra non nécessaire pour cet aperçu.</p>}/>}
    <label style={{fontSize:12,display:'flex',gap:10,marginTop:25}}><input type="checkbox" checked={fail} onChange={event=>setFail(event.target.checked)}/>Simuler une erreur d’enregistrement</label>
  </main></div>;
}
createRoot(document.getElementById('app')!).render(<Preview/>);
