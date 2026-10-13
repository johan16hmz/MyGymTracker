import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Workout } from '../types';
import { isTrainingSessionRecord } from '../trainingSessions';
import { sortWorkoutsByLastModified } from '../workoutOrder';
import { t,useLanguage } from '../i18n';
import { Icon } from './Icon';
import { NutritionModal } from './NutritionModal';
import '../nutrition.css';
import '../training.css';

export function TrainingQuickAction({workouts,disabled=false,onChoose}:{workouts:Workout[];disabled?:boolean;onChoose:(workout:Workout)=>void}) {
  useLanguage();
  const [open,setOpen]=useState(false);
  const templates=sortWorkoutsByLastModified(workouts.filter(workout=>!isTrainingSessionRecord(workout) && !workout.exercises.some(ex=>ex.nutritionProfile || ex.nutritionDay)));
  const models=templates.filter(workout=>!workout.exercises.some(ex=>ex.strengthBlock));
  const blocks=templates.filter(workout=>workout.exercises.some(ex=>ex.strengthBlock));
  const choose=(workout:Workout)=>{if(disabled)return;setOpen(false);onChoose(workout);};
  return <>
    <button type="button" className="nav-item nav-complete" disabled={disabled} onClick={()=>setOpen(true)} aria-haspopup="dialog"><Icon name="check"/><span>{t('Séance réalisée')}</span></button>
    {open && createPortal(<NutritionModal title={t('Quelle séance as-tu réalisée ?')} subtitle={t('VALIDATION RAPIDE')} onClose={()=>setOpen(false)}>
      <p className="training-hint">{t('Choisis ton modèle, puis confirme la date. Pour Force, indique les séries réellement faites.')}</p>
      {!templates.length && <p className="training-empty">{t('Crée d’abord une séance ou un bloc Force pour enregistrer un entraînement.')}</p>}
      {([{title:'Séances',items:models,force:false},{title:'Force',items:blocks,force:true}] as const).filter(group=>group.items.length).map(group=><section className="training-quick-group" key={group.title}><h3>{t(group.title)}</h3><div>{group.items.map(workout=><button key={workout.id} type="button" className="training-quick-choice" disabled={disabled} onClick={()=>choose(workout)}><Icon name={group.force?'strength':'workout'}/><span><strong>{workout.name}</strong><small>{t(group.force?'Enregistrer les performances':'Valider la séance')}</small></span><Icon name="arrow" size={18}/></button>)}</div></section>)}
    </NutritionModal>,document.body)}
  </>;
}
