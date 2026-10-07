// Development-only, stateful fixture. No account writes or Health credentials.
import { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { NutritionDiary } from '../src/components/NutritionDiary';
import { FoodComposer } from '../src/components/NutritionFoodComposer';
import { ProfileForm } from '../src/components/Nutrition';
import { Icon } from '../src/components/Icon';
import { localDate } from '../src/nutrition';
import { setLanguage, t } from '../src/i18n';
import type { FoodEntry, Meal, NutritionDay, NutritionProfile } from '../src/nutrition';
import '../src/ui.css';

const Scanner=lazy(()=>import('../src/components/NutritionScanner').then(module=>({default:module.NutritionScanner})));

const profile:NutritionProfile={goal:'maintain',targetKg:80,age:25,heightCm:180,weightKg:80,activity:'active',equationSex:'male',calorieOverride:2650,adjustForSteps:true,baselineSteps:5000};
const entries:FoodEntry[]=[{id:'banana',meal:'breakfast',food:{name:'Banane, chair sans peau, crue',source:'ciqual',unit:'g',kcal100:87.6,protein100:1.06,carbs100:19.7,fat100:0.5,fiber100:2.7},quantity:120,addedAt:new Date().toISOString()},{id:'yogurt',meal:'breakfast',food:{name:'Yaourt nature au lait entier',source:'ciqual',unit:'g',kcal100:62.1,protein100:3.7,carbs100:4.7,fat100:3,fiber100:0},quantity:125,addedAt:new Date().toISOString()}];
function Preview(){
  const [day,setDay]=useState<NutritionDay>({date:localDate(),entries,steps:{count:8430,source:'apple-shortcuts',updatedAt:new Date().toISOString()},waterMl:750});
  const [currentProfile,setCurrentProfile]=useState(profile);
  const [editingProfile,setEditingProfile]=useState(false);
  const [composer,setComposer]=useState<{meal:Meal;entry?:FoodEntry}>();
  const [fail,setFail]=useState(false);
  const [dark,setDark]=useState(new URLSearchParams(location.search).get('theme')==='dark');
  document.documentElement.dataset.theme=dark?'dark':'light';
  return <div className="app"><header className="app-header"><button className="brand"><span className="brand-mark"><img src="/brand-icon.svg" alt=""/></span><span>MyGym<span className="brand-light">Tracker</span><small>TRAINING JOURNAL</small></span></button><p className="nav-caption">TON ESPACE</p><nav className="app-sections"><button className="nav-item"><Icon name="workout"/>Séances</button><button className="nav-item"><Icon name="strength"/>Force</button><button className="nav-item active"><Icon name="nutrition"/>Nutrition</button></nav><div className="header-user"><span>Aperçu · données fictives</span></div></header><main className="app-main"><div className="workspace-topbar" style={{flexWrap:'wrap',height:'auto',gap:8,paddingBottom:16}}>MYGYMTRACKER / Nutrition <button className="btn btn-small" onClick={()=>setDark(value=>!value)}>Changer le thème</button><button className="btn btn-small" onClick={()=>setLanguage('fr')}>Français</button><button className="btn btn-small" onClick={()=>setLanguage('en')}>English</button></div><div hidden={!editingProfile}><ProfileForm initial={currentProfile} saving={false} onCancel={()=>setEditingProfile(false)} onSave={async(next)=>{setCurrentProfile({...currentProfile,...next});setEditingProfile(false);}}/></div><div hidden={editingProfile}><NutritionDiary profile={currentProfile} day={day} date={day.date} busy={false} loading={false} error="" onDate={date=>setDay({...day,date,entries:[]})} onProfile={()=>setEditingProfile(true)} onAdd={meal=>setComposer({meal})} onEdit={entry=>setComposer({meal:entry.meal,entry})} onRemove={entry=>setDay({...day,entries:day.entries.filter(item=>item.id!==entry.id)})} onSteps={async(count)=>setDay({...day,steps:{count,source:'manual',updatedAt:new Date().toISOString()}})} onWater={async(waterMl)=>setDay({...day,waterMl})} onRefresh={()=>{}} onHealthConnect={()=>alert('Aperçu uniquement : les pas affichés sont fictifs. La synchronisation Santé n’est pas activée et aucun accès à ton compte n’est créé.')}/></div>{composer && <FoodComposer meal={composer.meal} existing={composer.entry} recent={day.entries} onSave={async(entry)=>{if(fail)throw new Error('Échec de test : tes saisies sont conservées, réessaie.');setDay({...day,entries:[...day.entries.filter(item=>item.id!==entry.id),entry]});}} onClose={()=>setComposer(undefined)} renderScanner={(onCode,onError)=><Suspense fallback={<p role="status">{t('Chargement de la caméra…')}</p>}><Scanner onCode={onCode} onError={onError}/></Suspense>}/>}<label style={{fontSize:12,display:'flex',gap:10,marginTop:25}}><input type="checkbox" checked={fail} onChange={event=>setFail(event.target.checked)}/>Simuler une erreur d’enregistrement (test local)</label></main></div>;
}
createRoot(document.getElementById('app')!).render(<Preview/>);
