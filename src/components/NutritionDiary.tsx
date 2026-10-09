import { useState } from 'react';
import { estimateCalories, foodTotals, localDate, stepEnergy, sumEntries } from '../nutrition';
import type { FoodEntry, Meal, NutritionDay, NutritionProfile } from '../nutrition';
import { locale, t, useLanguage } from '../i18n';
import { Icon } from './Icon';
import { mealNames } from './NutritionFoodComposer';
import { NutritionModal } from './NutritionModal';
import { NutritionHealthConnect } from './NutritionHealthConnect';
import { NutritionWeightCard } from './NutritionWeightCard';
import '../nutrition.css';

const format=(value:number,decimals=0)=>value.toLocaleString(locale(),{maximumFractionDigits:decimals});
const meals:Meal[]=['breakfast','lunch','snack','dinner'];
interface Props {
  profile:NutritionProfile;day:NutritionDay;date:string;busy:boolean;loading:boolean;error:string;
  onDate:(date:string)=>void;onProfile:()=>void;onAdd:(meal:Meal)=>void;onEdit:(entry:FoodEntry)=>void;
  onRemove:(entry:FoodEntry)=>void;onSteps:(count:number)=>Promise<void>;onWater:(amount:number)=>Promise<void>;onRefresh:()=>void;
  onHealthConnect?:()=>void;
  focusWeight?:boolean;
  onWeightEditingChange?:(editing:boolean)=>void;
  onWeight?:(weightKg:number)=>Promise<void>;
}

export function NutritionDiary({profile,day,date,busy,loading,error,onDate,onProfile,onAdd,onEdit,onRemove,onSteps,onWater,onRefresh,onHealthConnect,onWeight,focusWeight,onWeightEditingChange}:Props) {
  useLanguage();
  const [health,setHealth]=useState(false);
  const [stepEditor,setStepEditor]=useState(false);
  const [steps,setSteps]=useState('');
  const [stepSaving,setStepSaving]=useState(false);
  const [stepError,setStepError]=useState('');
  const [waterError,setWaterError]=useState('');
  const totals=sumEntries(day.entries);
  const base=profile.calorieOverride ?? estimateCalories(profile).target;
  const energy=stepEnergy(profile,day.steps?.count ?? 0);
  const target=base+energy.bonus;
  const remaining=target-totals.kcal;
  const ratio=Math.min(1,Math.max(0,totals.kcal/target));
  const circumference=2*Math.PI*72;
  const fiberGoal=profile.fiberGoal ?? 30;
  const stepGoal=profile.stepGoal ?? 10000;
  const missingFiber=day.entries.filter(entry=>entry.food.fiber100===undefined).length;
  const disabled=busy || loading;
  const shift=(offset:number)=>{const value=new Date(`${date}T12:00:00`);value.setDate(value.getDate()+offset);onDate(localDate(value));};
  const pretty=new Date(`${date}T12:00:00`).toLocaleDateString(locale(),{weekday:'long',day:'numeric',month:'long'});
  const nutrients=[{label:'Protéines',value:totals.protein,color:'protein',percent:target?totals.protein*4/target*100:0},{label:'Glucides',value:totals.carbs,color:'carbs',percent:target?totals.carbs*4/target*100:0},{label:'Lipides',value:totals.fat,color:'fat',percent:target?totals.fat*9/target*100:0},{label:'Fibres',value:totals.fiber,color:'fiber',percent:totals.fiber/fiberGoal*100}];
  return <section className="nutri-page">
    <header className="nutri-page-header"><div><p className="eyebrow">NUTRITION / {t('TON JOURNAL')}</p><h1>{t('Bien manger. À ton rythme.')}</h1><p>{t('Une vue claire de tes repas, de ton énergie et de ton activité.')}</p></div><button className="btn btn-secondary" disabled={disabled} onClick={onProfile}><Icon name="settings" size={17}/>{t('Mon objectif')}</button></header>
    <div className="nutri-date-bar"><div className="nutri-date-navigation"><button aria-label={t('Jour précédent')} disabled={busy} onClick={()=>shift(-1)}>‹</button><div><strong>{date===localDate()?t('Aujourd’hui'):t('Journal du jour')}</strong><span>{pretty}</span></div><button aria-label={t('Jour suivant')} disabled={busy} onClick={()=>shift(1)}>›</button></div><label className="nutri-date-picker"><Icon name="calendar" size={17}/><input type="date" aria-label={t('Choisir une date')} disabled={busy} value={date} onChange={event=>{if(/^\d{4}-\d{2}-\d{2}$/.test(event.target.value))onDate(event.target.value);}}/></label></div>
    {error && <div className="nutrition-error" role="alert">{error} <button className="btn btn-secondary" disabled={busy} onClick={onRefresh}>{t('Réessayer')}</button></div>}
    {loading ? <div className="loading-panel" role="status"><span className="loading-spinner"/>{t('Chargement de la journée…')}</div>:!error && <>
      <section className="nutri-overview" aria-label={t('Bilan de la journée')}>
        <div className="nutri-calorie-main"><div className="nutri-ring"><svg viewBox="0 0 168 168" aria-hidden="true"><circle cx="84" cy="84" r="72" className="nutri-ring-track"/><circle cx="84" cy="84" r="72" className="nutri-ring-value" strokeDasharray={circumference} strokeDashoffset={circumference*(1-ratio)}/></svg><div><strong>{format(Math.abs(Math.round(remaining)))}</strong><span>{t(remaining>=0?'kcal restantes':'kcal au-dessus')}</span></div></div><div className="nutri-calorie-copy"><span className="nutri-detail-badge">{t('TON ÉQUILIBRE DU JOUR')}</span><h2>{t(remaining>=0?'Chaque repas compte.':'Une journée, pas un verdict.')}</h2><div className="nutri-calorie-stats"><div><strong>{format(Math.round(totals.kcal))}</strong><span>{t('mangées')}</span></div><div><strong>{format(target)}</strong><span>{t('objectif kcal')}</span></div><div><strong>+{format(energy.bonus)}</strong><span>{t('activité kcal')}</span></div></div><small>{t('Objectif de base')} {format(base)} kcal {energy.bonus>0 && `+ ${energy.bonus} ${t('kcal de marche estimées')}`}</small></div></div>
        <div className="nutri-nutrients">{nutrients.map(nutrient=><div className={`nutri-nutrient ${nutrient.color}`} key={nutrient.color}><span>{t(nutrient.label)}</span><strong>{format(nutrient.value,1)} <small>g</small></strong><div className="nutri-meter"><span style={{width:`${Math.min(100,nutrient.percent)}%`}}/></div><small>{nutrient.color==='fiber'?`${t('Repère')} ${fiberGoal} g${missingFiber?` · ${t('partiel')}`:''}`:`${format(nutrient.percent)} % ${t('de l’objectif kcal')}`}</small></div>)}</div>
        {missingFiber>0 && <p className="nutri-hint nutri-fiber-warning">{t('Total de fibres partiel : valeurs absentes pour')} {missingFiber} {t(missingFiber===1?'aliment.':'aliments.')}</p>}
      </section>
      <div className="nutri-diary-layout"><div className="nutri-meals"><div className="nutri-section-title"><h2>{t('Mes repas')}</h2><span>{day.entries.length} {t('aliments aujourd’hui')}</span></div>{meals.map((meal,index)=>{
        const entries=day.entries.filter(entry=>entry.meal===meal);const amounts=sumEntries(entries);
        return <section className="nutri-meal-card" key={meal}><header><div className={`nutri-meal-avatar meal-${index}`}><Icon name="nutrition" size={23}/></div><div className="nutri-meal-heading"><h3>{t(mealNames[meal])}</h3><span>{format(Math.round(amounts.kcal))} kcal {entries.length>0 && `· ${format(amounts.protein,1)} g ${t('protéines')}`}</span></div><button className="nutri-add-circle" disabled={disabled} aria-label={`${t('Ajouter un aliment')} · ${t(mealNames[meal])}`} onClick={()=>onAdd(meal)}><Icon name="plus" size={21}/></button></header>
        {entries.length>0 ? <div className="nutri-meal-entries">{entries.map(entry=><div className="nutri-entry" key={entry.id}><button className="nutri-entry-copy" disabled={disabled} onClick={()=>onEdit(entry)} aria-label={`${t('Modifier')} ${entry.food.name}`}><strong>{entry.food.name}</strong><small>{format(entry.quantity,1)} {entry.food.unit}{entry.food.brand && ` · ${entry.food.brand}`}</small></button><strong className="nutri-entry-kcal">{format(Math.round(foodTotals(entry.food,entry.quantity).kcal))}<small>kcal</small></strong><button className="nutri-entry-delete" disabled={disabled} aria-label={`${t('Supprimer')} ${entry.food.name}`} onClick={()=>onRemove(entry)}><Icon name="trash" size={16}/></button></div>)}</div>:<button className="nutri-meal-empty" disabled={disabled} onClick={()=>onAdd(meal)}>{t('Qu’as-tu mangé ?')} <span>{t('Rechercher un aliment')} →</span></button>}
        </section>;
      })}</div><aside className="nutri-activity"><div className="nutri-section-title"><h2>{t('Mon activité')}</h2><span>{t('Au fil du jour')}</span></div>
        <section className="nutri-activity-card"><header><span className="nutri-activity-icon"><Icon name="steps"/></span><h3>{t('Mes pas')}</h3><span className="nutri-mini-label">{day.steps?.source==='apple-shortcuts'?t('Santé · importés'):t('Non connecté')}</span></header><div className="nutri-step-count"><strong>{format(day.steps?.count ?? 0)}</strong><span>/ {format(stepGoal)}</span></div><div className="nutri-meter"><span style={{width:`${Math.min(100,(day.steps?.count ?? 0)/stepGoal*100)}%`}}/></div><div className="nutri-step-detail"><span>≈ {format(energy.distanceKm,1)} km</span><span>+{energy.bonus} kcal</span></div><p>{t(profile.adjustForSteps?'Seuls les pas au-delà de ton activité habituelle ajustent l’objectif.':'L’ajustement calorique est désactivé. Tu peux l’activer dans Mon objectif.')}</p>{day.steps?.source==='apple-shortcuts' && <small>{t('Dernière mise à jour')} {new Date(day.steps.updatedAt).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit'})}</small>}<button className="btn btn-primary" disabled={disabled} onClick={()=>onHealthConnect?onHealthConnect():setHealth(true)}><Icon name="steps" size={16}/>{t('Connecter Santé')}</button><div className="nutri-activity-links"><button disabled={disabled} onClick={onRefresh}>{t('Actualiser')}</button><button disabled={disabled} onClick={()=>{setSteps(String(day.steps?.count ?? 0));setStepError('');setStepEditor(true);}}>{t('Corriger les pas')}</button></div></section>
        <section className="nutri-activity-card nutri-water"><header><span className="nutri-activity-icon"><Icon name="water"/></span><h3>{t('Hydratation')}</h3></header><div className="nutri-step-count"><strong>{format((day.waterMl ?? 0)/1000,2)}</strong><span>L {t('aujourd’hui')}</span></div><div className="nutri-water-drops" aria-hidden="true">{Array.from({length:10},(_,index)=><span className={index<(day.waterMl ?? 0)/250?'filled':''} key={index}><Icon name="water" size={15}/></span>)}</div><div className="nutri-water-actions">{[-250,250,500].map(amount=><button key={amount} disabled={disabled || (amount<0 && !(day.waterMl ?? 0)) || (amount>0 && (day.waterMl ?? 0)>=10000)} onClick={()=>{setWaterError('');void onWater(Math.max(0,Math.min(10000,(day.waterMl ?? 0)+amount))).catch(error=>setWaterError(error.message));}}>{amount<0?'−':`+ ${amount} ml`}</button>)}</div>{waterError && <p className="nutrition-error" role="alert">{waterError}</p>}<p>{t('Note tes verres d’eau, sans pression. Tes besoins varient selon ta journée.')}</p></section>
        {onWeight && <NutritionWeightCard key={date} weightKg={day.weightKg} date={date} disabled={disabled} onSave={onWeight} autoOpen={focusWeight} onEditingChange={onWeightEditingChange}/>}
        <div className="nutri-daily-note"><Icon name="leaf" size={23}/><h3>{t('La régularité, pas la perfection.')}</h3><p>{t('Les portions et calories sont des repères. Écoute aussi ta faim et ton énergie.')}</p></div>
      </aside></div>
      <p className="nutri-source-note">{t('Données alimentaires')} : <a href="https://doi.org/10.57745/RDMHWY" target="_blank" rel="noreferrer">ANSES-CIQUAL 2025</a> / <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a>. {t('Calculs indicatifs, pas un avis médical.')}</p>
    </>}
    {health && <NutritionHealthConnect onClose={()=>setHealth(false)}/>}
    {stepEditor && <NutritionModal title={t('Corriger mes pas')} subtitle={pretty} busy={stepSaving} onClose={()=>setStepEditor(false)}><p className="nutri-hint">{t('Correction ponctuelle du total du jour. Un prochain envoi Santé peut le remplacer.')}</p><form className="nutri-step-form" onSubmit={event=>{event.preventDefault();const count=Number(steps);if(!steps || !Number.isInteger(count) || count<0 || count>100000){setStepError(t('Saisis un nombre entier de pas entre 0 et 100 000.'));return;}setStepSaving(true);void onSteps(count).then(()=>setStepEditor(false)).catch(error=>setStepError(error.message)).finally(()=>setStepSaving(false));}}><label>{t('Total de pas')}<input type="number" inputMode="numeric" min={0} max={100000} step={1} required disabled={stepSaving} value={steps} onChange={event=>setSteps(event.target.value)}/></label>{stepError && <p className="nutrition-error" role="alert">{stepError}</p>}<button className="btn btn-primary" disabled={stepSaving}>{t(stepSaving?'Enregistrement…':'Enregistrer')}</button></form></NutritionModal>}
  </section>;
}
