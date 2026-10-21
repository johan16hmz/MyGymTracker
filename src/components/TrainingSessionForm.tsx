import { useEffect, useRef, useState } from 'react';
import type { TrainingSession, Workout } from '../types';
import { getStrengthWeeks, DEFAULT_STRENGTH_SETS } from '../strength';
import { localDate } from '../nutrition';
import { snapshotWorkout, validateTrainingSession } from '../trainingSessions';
import { t, useLanguage, useWeightUnit } from '../i18n';
import { convertWeightInput, parseDecimalInput, toDisplayWeight, toStoredWeight } from '../weightUnits';
import { DecimalInput } from './DecimalInput';
import { NutritionModal } from './NutritionModal';
import '../nutrition.css';
import '../training.css';

export function TrainingSessionForm({workout, initialWeek=1, initialPrescriptionId, onSave, onClose}: {
  workout:Workout; initialWeek?:number; initialPrescriptionId?:string;
  onSave:(session:TrainingSession)=>Promise<void>; onClose:()=>void;
}) {
  useLanguage();
  const unit=useWeightUnit();
  const block=workout.exercises.find(ex=>ex.strengthBlock)?.strengthBlock;
  const weeks=block?getStrengthWeeks(block):[];
  const [id]=useState(()=>crypto.randomUUID());
  const [date,setDate]=useState(localDate());
  const [week,setWeek]=useState(weeks.includes(initialWeek)?initialWeek:weeks[0] ?? 1);
  const [note,setNote]=useState('');
  const [bodyWeight,setBodyWeight]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const busy=useRef(false);
  const previousUnit=useRef(unit);
  const initialRows=()=>Object.fromEntries((block?.exercises ?? []).flatMap(ex=>ex.prescriptions.map(row=>[row.id,{
    selected:row.id===initialPrescriptionId,
    sets:Array.from({length:row.sets ?? DEFAULT_STRENGTH_SETS},()=>({done:true,weight:String(toDisplayWeight(row.weight,unit)),reps:String(row.reps),rpe:''}))
  }])));
  const [rows,setRows]=useState(initialRows);
  useEffect(()=>{
    const previous=previousUnit.current;
    if(previous===unit)return;
    setBodyWeight(value=>convertWeightInput(value,previous,unit));
    setRows(previousRows=>Object.fromEntries(Object.entries(previousRows).map(([key,row])=>[key,{...row,sets:row.sets.map(set=>({...set,weight:convertWeightInput(set.weight,previous,unit)}))}])));
    previousUnit.current=unit;
  },[unit]);
  const selectedCount=(block?.exercises ?? []).reduce((sum,ex)=>sum+ex.prescriptions.filter(row=>row.week===week && rows[row.id]?.selected).reduce((count,row)=>count+rows[row.id].sets.filter(set=>set.done).length,0),0);
  const weighted=(block?.exercises ?? []).some(ex=>ex.weighted && ex.prescriptions.some(row=>row.week===week && rows[row.id]?.selected));
  const setValue=(rowId:string,index:number,field:'weight'|'reps'|'rpe'|'done',value:string|boolean)=>setRows(previous=>({...previous,[rowId]:{...previous[rowId],sets:previous[rowId].sets.map((set,i)=>i===index?{...set,[field]:value}:set)}}));
  const close=()=>{if(!busy.current)onClose();};
  return <NutritionModal title={t(block?'Saisir mes performances Force':'Séance réalisée')} subtitle={workout.name} busy={saving} onClose={close}>
    <form className="training-form" onSubmit={event=>{
      event.preventDefault();if(busy.current)return;
      const session:TrainingSession={version:1,id,source:block?'strength':'workout',sourceId:workout.id,name:workout.name,date,recordedAt:new Date().toISOString(),note,
        ...(block?{week}:{workoutSnapshot:snapshotWorkout(workout)}),
        ...(weighted && bodyWeight.trim()?{bodyWeightKg:toStoredWeight(parseDecimalInput(bodyWeight),unit)}:{}),
        exercises:(block?.exercises ?? []).flatMap(ex=>{
          const sets=ex.prescriptions.filter(row=>row.week===week && rows[row.id]?.selected).flatMap(row=>rows[row.id].sets.filter(set=>set.done).map(set=>({weight:toStoredWeight(parseDecimalInput(set.weight),unit),reps:Number(set.reps),prescriptionId:row.id,...(set.rpe.trim()?{rpe:parseDecimalInput(set.rpe)}:{})})));
          return sets.length?[{id:ex.id,name:ex.name,weighted:ex.weighted,sets}]:[];
        })};
      try{validateTrainingSession(session);}catch(error){setError(t(error instanceof Error?error.message:'Vérifie les informations saisies.'));return;}
      busy.current=true;setSaving(true);setError('');
      void onSave(session).then(onClose).catch(error=>setError(t(error instanceof Error?error.message:'Enregistrement impossible. Réessaie.'))).finally(()=>{busy.current=false;setSaving(false);});
    }}>
      <fieldset disabled={saving}>
        <p className="training-hint">{t(block?'Sélectionne uniquement les séries faites et vérifie les valeurs préremplies. Ton programme reste inchangé.':'Valide l’utilisation de ce modèle. Sa date et son contenu restent inchangés. Les charges des séances ne servent pas aux courbes Force.')}</p>
        <div className="training-date-row"><label>{t('Date de l’entraînement')}<input type="date" value={date} max={localDate()} required onChange={event=>setDate(event.target.value)}/></label>
        {block && <label>{t('Semaine du bloc')}<select value={week} onChange={event=>setWeek(Number(event.target.value))}>{weeks.map(value=><option key={value} value={value}>{t('Semaine')} {value}</option>)}</select></label>}</div>
        {block && <div className="training-groups">{block.exercises.map(ex=><section key={ex.id} className="training-exercise"><h3>{t(ex.name)}<small>{t(ex.weighted?'Lest ajouté':'Charge totale')} ({unit})</small></h3>{ex.prescriptions.filter(row=>row.week===week).map(row=><div key={row.id} className="training-group">
          <label className="training-group-toggle"><input type="checkbox" checked={rows[row.id]?.selected ?? false} onChange={event=>setRows(previous=>({...previous,[row.id]:{...previous[row.id],selected:event.target.checked}}))}/><span>{t('Séries réalisées')} · {t(ex.name)} · {row.sets ?? DEFAULT_STRENGTH_SETS} × {row.reps}</span></label>
          {rows[row.id]?.selected && <div className="training-set-grid"><div className="training-set-head"><span>{t('Série')}</span><span>{t('Poids réalisé')} ({unit})</span><span>{t('Reps réalisées')}</span><span>RPE <small>{t('facultatif')}</small></span></div>{rows[row.id].sets.map((set,index)=><div className="training-set-row" key={index}>
            <label className="training-done"><input type="checkbox" aria-label={`${t('Série réalisée')} ${index+1} · ${t(ex.name)} · ${row.reps} reps`} checked={set.done} onChange={event=>setValue(row.id,index,'done',event.target.checked)}/><span>{index+1}</span></label>
            <DecimalInput aria-label={`${t('Poids réalisé')} · ${t(ex.name)} · ${row.reps} reps · ${t('Série')} ${index+1} (${unit})`} required={set.done} disabled={!set.done} min={0} value={set.weight} onChange={event=>setValue(row.id,index,'weight',event.target.value)}/>
            <input aria-label={`${t('Reps réalisées')} · ${t(ex.name)} · ${row.reps} reps · ${t('Série')} ${index+1}`} type="number" min={1} max={1000} step={1} required={set.done} disabled={!set.done} value={set.reps} onChange={event=>setValue(row.id,index,'reps',event.target.value)}/>
            <DecimalInput aria-label={`RPE · ${t(ex.name)} · ${row.reps} reps · ${t('Série')} ${index+1}`} disabled={!set.done} min={1} max={10} step={0.5} placeholder="—" value={set.rpe} onChange={event=>setValue(row.id,index,'rpe',event.target.value)}/>
          </div>)}</div>}
        </div>)}</section>)}</div>}
        {weighted && <label>{t('Poids du corps ce jour-là')} ({unit})<DecimalInput min={0} value={bodyWeight} onChange={event=>setBodyWeight(event.target.value)} placeholder={t('Facultatif')}/><small className="training-hint">{t('Nécessaire pour estimer le 1RM des exercices lestés. Une pesée Nutrition du même jour peut aussi être utilisée.')}</small></label>}
        <label>{t('Note')}<textarea maxLength={500} rows={2} value={note} onChange={event=>setNote(event.target.value)} placeholder={t('Ressenti, contexte…')}/></label>
      </fieldset>
      {error && <p className="training-error" role="alert">{error}</p>}
      <div className="training-form-footer"><span>{block?`${selectedCount} ${t('séries sélectionnées')}`:t('Un entraînement daté, sans nouvelle séance à créer.')}</span><button type="submit" className="btn btn-primary" disabled={saving || (!!block && !selectedCount)}>{t(saving?'Enregistrement…':block?'Enregistrer les performances':'Valider cet entraînement')}</button></div>
    </form>
  </NutritionModal>;
}
