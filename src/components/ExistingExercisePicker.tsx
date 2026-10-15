import { useState } from 'react';
import type { Exercise, ExerciseVariant, Workout } from '../types';
import { exerciseVariants, workoutExerciseBank } from '../exerciseVariants';
import { t, useLanguage, formatWeight, useWeightUnit } from '../i18n';
import { NutritionModal } from './NutritionModal';

export function ExistingExercisePicker({ workouts, current, targetId, onChoose, onClose }: {
  workouts:Workout[]; current:Workout; targetId:string;
  onChoose:(workout:Workout,exercise:Exercise,variant:ExerciseVariant)=>void; onClose:()=>void;
}) {
  useLanguage();useWeightUnit();
  const bank=workoutExerciseBank([current,...workouts.filter(item=>item.id!==current.id)]).filter(workout=>workout.exercises.some(exercise=>(workout.id!==current.id || exercise.id!==targetId) && exercise.name.trim()));
  const [workoutId,setWorkoutId]=useState(bank[0]?.id ?? '');
  const [choice,setChoice]=useState('');
  const [error,setError]=useState('');
  const source=bank.find(workout=>workout.id===workoutId);
  const options=(source?.exercises ?? []).filter(exercise=>(source?.id!==current.id || exercise.id!==targetId) && exercise.name.trim()).flatMap(exercise=>(source?.id===current.id?exerciseVariants(exercise).slice(0,1):exerciseVariants(exercise)).filter(variant=>variant.name.trim()).map(variant=>({key:JSON.stringify([exercise.id,variant.id]),exercise,variant})));
  const selected=options.find(item=>item.key===choice);
  return <NutritionModal title={t('Associer un exercice existant')} subtitle={current.exercises.find(exercise=>exercise.id===targetId)?.name} onClose={onClose}>
    <div className="existing-exercise-picker">
      <p>{t('Choisis une séance, puis l’exercice à utiliser comme alternative.')}</p>
      <label>{t('Séance source')}<select value={workoutId} disabled={!bank.length} onChange={event=>{setWorkoutId(event.target.value);setChoice('');setError('');}}>{bank.map(workout=><option key={workout.id} value={workout.id}>{workout.name}{workout.id===current.id?` · ${t('Séance actuelle')}`:''}</option>)}</select></label>
      <label>{t('Exercice à ajouter')}<select value={choice} disabled={!options.length} onChange={event=>{setChoice(event.target.value);setError('');}}><option value="">{t('Choisir un exercice…')}</option>{options.map(({key,exercise,variant})=><option key={key} value={key}>{variant.name} · {variant.sets.length} {t('séries')}{source?.id===current.id && exercise.alternatives?.length?` · ${exercise.alternatives.length+1} ${t('variantes')}`:''}</option>)}</select></label>
      {!bank.length && <p role="status">{t('Aucun autre exercice disponible dans tes séances.')}</p>}
      {selected && <div className="existing-exercise-preview"><strong>{selected.variant.name}</strong><div>{selected.variant.sets.map((set,index)=><span key={set.id}>S{index+1} · {formatWeight(set.weight)} × {set.repsMin && set.repsMax?`${set.repsMin}–${set.repsMax}`:set.reps || '?'}</span>)}</div><p>{t(source?.id===current.id?'L’exercice et ses variantes seront regroupés ici, sans cumuler leurs séries.':'Les charges et répétitions seront copiées. La séance source reste inchangée et les deux copies évoluent indépendamment.')}</p></div>}
      {error && <p className="force-error" role="alert">{error}</p>}
      <div className="existing-exercise-footer"><button type="button" className="btn btn-secondary" onClick={onClose}>{t('Annuler')}</button><button type="button" className="btn btn-primary" disabled={!source || !selected} onClick={()=>{if(!source || !selected)return;try{onChoose(source,selected.exercise,selected.variant);}catch(error){setError(t(error instanceof Error?error.message:'Vérifie les informations saisies.'));}}}>{t('Ajouter cette alternative')}</button></div>
    </div>
  </NutritionModal>;
}
