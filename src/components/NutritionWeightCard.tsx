import { useEffect, useRef, useState } from 'react';
import { locale, t, useLanguage, useWeightUnit } from '../i18n';
import { toDisplayWeight, toStoredWeight, parseDecimalInput, convertWeightInput } from '../weightUnits';
import { localDate } from '../nutrition';
import { DecimalInput } from './DecimalInput';
import { Icon } from './Icon';

export function NutritionWeightCard({ weightKg, date, disabled, onSave, autoOpen = false, onEditingChange }: {
  weightKg?: number; date: string; disabled: boolean; onSave: (weight: number) => Promise<void>;
  autoOpen?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  useLanguage();
  const unit = useWeightUnit();
  const [editing,setEditing]=useState(autoOpen && date<=localDate());
  const [value,setValue]=useState(weightKg===undefined?'':String(toDisplayWeight(weightKg,unit)));
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const previousUnit=useRef(unit);
  const editingCallback=useRef(onEditingChange);
  editingCallback.current=onEditingChange;
  useEffect(()=>{editingCallback.current?.(editing);return()=>editingCallback.current?.(false);},[editing]);
  const section=useRef<HTMLElement>(null);
  useEffect(()=>{if(autoOpen)section.current?.scrollIntoView({behavior:'instant',block:'center'});},[autoOpen]);
  useEffect(()=>{const previous=previousUnit.current;if(previous!==unit){setValue(value=>convertWeightInput(value,previous,unit));previousUnit.current=unit;}},[unit]);
  return <section className="nutri-activity-card" ref={section}><header><span className="nutri-activity-icon"><Icon name="weight"/></span><h3>{t('Ma pesée')}</h3></header><div className="nutri-step-count"><strong>{weightKg===undefined?'—':toDisplayWeight(weightKg,unit).toLocaleString(locale(),{maximumFractionDigits:1})}</strong><span>{unit}</span></div><p>{t('Une pesée datée pour suivre ton évolution dans Statistiques. Ton objectif calorique reste inchangé.')}</p>{editing?<form className="nutri-weight-form" onSubmit={event=>{
    event.preventDefault();const weight=toStoredWeight(parseDecimalInput(value),unit);
    if(!Number.isFinite(weight) || weight<25 || weight>400){setError(t('Vérifie les informations saisies.'));return;}
    setSaving(true);setError('');void onSave(weight).then(()=>setEditing(false)).catch(error=>setError(error instanceof Error?error.message:t('Enregistrement impossible.'))).finally(()=>setSaving(false));
  }}><label>{t('Poids du jour')} ({unit})<DecimalInput required autoFocus disabled={saving || disabled} min={unit==='kg'?25:55.12} max={unit==='kg'?400:881.85} value={value} onChange={event=>setValue(event.target.value)}/></label>{error && <p className="nutrition-error" role="alert">{error}</p>}<div className="nutrition-actions"><button className="btn btn-primary" disabled={saving || disabled}>{t(saving?'Enregistrement…':'Enregistrer')}</button><button type="button" className="btn btn-secondary" disabled={saving} onClick={()=>setEditing(false)}>{t('Annuler')}</button></div></form>:<button className="btn btn-secondary" disabled={disabled || date>localDate()} onClick={()=>{setValue(weightKg===undefined?'':String(toDisplayWeight(weightKg,unit)));setError('');setEditing(true);}}><Icon name="plus" size={16}/>{t(weightKg===undefined?'Ajouter une pesée':'Modifier la pesée')}</button>}</section>;
}
