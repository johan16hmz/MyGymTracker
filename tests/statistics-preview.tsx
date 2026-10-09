import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StatisticsDashboard } from '../src/components/Statistics';
import { NutritionDiary } from '../src/components/NutritionDiary';
import { Icon } from '../src/components/Icon';
import { localDate } from '../src/nutrition';
import { setLanguage, setWeightUnit, useLanguage, useWeightUnit } from '../src/i18n';
import type { NutritionDay } from '../src/nutrition';
import { statisticsFixture } from './statistics-fixture';
import '../src/ui.css';

const demo=statisticsFixture();
function Preview() {
  const [view,setView]=useState<'statistics'|'nutrition'>('statistics');
  const [focusWeight,setFocusWeight]=useState(false);
  const [source,setSource]=useState(demo);
  const [empty,setEmpty]=useState(false);
  const [date,setDate]=useState(localDate());
  const [dark,setDark]=useState(false);
  const language=useLanguage();
  const unit=useWeightUnit();
  const day=source.days.find(day=>day.date===date) ?? {date,entries:[]};
  const saveDay=async(change:Partial<NutritionDay>)=>setSource(previous=>({...previous,days:[...previous.days.filter(day=>day.date!==date),{...day,...change}]}));
  document.documentElement.dataset.theme=dark?'dark':'light';
  return <div className="app">
    <header className="app-header">
      <button className="brand" onClick={()=>setView('statistics')}><span className="brand-mark"><img src="/brand-icon.svg" alt=""/></span><span>MyGym<span className="brand-light">Tracker</span><small>TRAINING JOURNAL</small></span></button>
      <p className="nav-caption">TON ESPACE</p>
      <nav className="app-sections">
        <button className="nav-item" onClick={()=>alert('Aperçu de la nouvelle partie Statistiques uniquement.')}><Icon name="workout"/>Séances</button>
        <button className="nav-item" onClick={()=>alert('Les performances de cet aperçu sont fictives.')}><Icon name="strength"/>Force</button>
        <button className={`nav-item ${view==='nutrition'?'active':''}`} onClick={()=>{setFocusWeight(false);setView('nutrition');}}><Icon name="nutrition"/>Nutrition</button>
        <button className={`nav-item ${view==='statistics'?'active':''}`} onClick={()=>setView('statistics')}><Icon name="statistics"/>Statistiques</button>
      </nav>
      <div className="sidebar-note"><Icon name="statistics" size={28}/><p>La régularité fait la différence.</p><span>Une séance à la fois.</span></div>
      <div className="header-user"><small>Aperçu local · données fictives</small></div>
    </header>
    <main className="app-main">
      <div className="workspace-topbar"><span>MYGYMTRACKER / {view==='statistics'?'Statistiques':'Nutrition'}</span><span className="workspace-status"><span/>Aperçu non publié</span></div>
      <div className="stats-preview-controls">
        <span>Données de démonstration · aucun enregistrement dans ton compte</span>
        <button className="btn btn-small" onClick={()=>setEmpty(value=>!value)}>{empty?'Afficher la démonstration':'Tester sans données'}</button>
        <button className="btn btn-small" onClick={()=>setDark(value=>!value)}>{dark?'Thème clair':'Thème sombre'}</button>
        <button className="btn btn-small" onClick={()=>setLanguage(language==='fr'?'en':'fr')}>{language==='fr'?'English':'Français'}</button>
        <button className="btn btn-small" onClick={()=>setWeightUnit(unit==='kg'?'lb':'kg')}>{unit==='kg'?'Passer en lb':'Passer en kg'}</button>
      </div>
      {view==='statistics'?<StatisticsDashboard source={empty?{workouts:[],days:[]}:source} onNutrition={()=>{setFocusWeight(true);setDate(localDate());setView('nutrition');setEmpty(false);}} onStrength={()=>alert('Les performances de cet aperçu sont fictives.')}/>:<NutritionDiary
        profile={source.profile!} day={day} date={date} busy={false} loading={false} error="" focusWeight={focusWeight}
        onDate={next=>{setFocusWeight(false);setDate(next);}} onProfile={()=>alert('Aperçu : objectif fictif.')}
        onAdd={()=>alert('Aperçu des statistiques : les repas restent inchangés.')} onEdit={()=>{}} onRemove={()=>{}}
        onSteps={async(count)=>saveDay({steps:{count,source:'manual',updatedAt:new Date().toISOString()}})}
        onWater={async(waterMl)=>saveDay({waterMl})} onWeight={async(weightKg)=>saveDay({weightKg})}
        onRefresh={()=>{}} onHealthConnect={()=>alert('Santé reste désactivé.')}/>}
    </main>
  </div>;
}
createRoot(document.getElementById('app')!).render(<Preview/>);
