import { useState } from 'react';
import { foodTotals } from '../nutrition';
import type { FoodEntry, Meal } from '../nutrition';
import { foodHistory,searchFoodHistory } from '../nutritionHistory';
import type { FoodHistoryEntry } from '../nutritionHistory';
import { locale,t,useLanguage } from '../i18n';
import { Icon } from './Icon';
import { NutritionModal } from './NutritionModal';
import { mealNames } from './NutritionFoodComposer';

export function NutritionFoodHistory({entries,loading,error,onRetry,onSelect,onClose}:{
  entries:FoodHistoryEntry[];loading:boolean;error:string;onRetry:()=>void;
  onSelect:(entry:FoodEntry,meal:Meal)=>void;onClose:()=>void;
}) {
  useLanguage();
  const [query,setQuery]=useState('');const [meal,setMeal]=useState<Meal>('breakfast');const [limit,setLimit]=useState(24);
  const items=searchFoodHistory(foodHistory(entries),query);
  const format=(value:number)=>value.toLocaleString(locale(),{maximumFractionDigits:1});
  return <NutritionModal title={t('Historique alimentaire')} subtitle={t('RETROUVER ET RÉUTILISER')} onClose={onClose}>
    <p className="nutri-hint">{t('Tes aliments déjà enregistrés, avec leur marque et ta dernière quantité. Rien n’est ajouté avant ta confirmation.')}</p>
    <div className="nutri-history-controls"><label>{t('Ajouter au repas')}<select value={meal} onChange={event=>setMeal(event.target.value as Meal)}>{Object.entries(mealNames).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label><label>{t('Retrouver un aliment')}<div className="nutri-search"><Icon name="search"/><input value={query} placeholder={t('Nom de l’aliment ou marque…')} onChange={event=>{setQuery(event.target.value);setLimit(24);}}/></div></label></div>
    {loading?<div className="nutri-search-empty" role="status"><span className="loading-spinner"/>{t('Chargement de l’historique…')}</div>:error?<div className="nutrition-error" role="alert">{t(error)} <button className="btn btn-secondary" onClick={onRetry}>{t('Réessayer')}</button></div>:<>
      <div className="nutri-results-heading"><span>{items.length} {t(items.length===1?'aliment retrouvé':'aliments retrouvés')}</span><small>{t('Du plus récent au plus ancien')}</small></div>
      <div className="nutri-search-results">{items.slice(0,limit).map(item=>{
        const entry=item.entry;const date=new Date(`${item.lastDate}T12:00:00`);
        return <button key={item.key} className="nutri-food-result" onClick={()=>onSelect(entry,meal)} aria-label={`${t('Réutiliser')} ${entry.food.name}`}>
          <span className="nutri-food-avatar"><Icon name="nutrition"/></span><span className="nutri-food-result-copy"><small className={entry.food.brand?'nutri-food-brand':undefined}>{entry.food.brand || t('Sans marque')}</small><strong>{entry.food.name}</strong><small>{format(entry.quantity)} {entry.food.unit} · {t('Dernière quantité')}</small><span>{Number.isFinite(date.getTime())?date.toLocaleDateString(locale(),{day:'numeric',month:'short',year:'numeric'}):''} · {item.count} {t(item.count===1?'fois enregistré':'fois enregistrées')}</span></span><span className="nutri-food-result-end"><strong>{Math.round(foodTotals(entry.food,entry.quantity).kcal)} <small>kcal</small></strong><span className="nutri-plus" aria-hidden="true"><Icon name="plus" size={16}/></span></span>
        </button>;
      })}</div>
      {!items.length && <div className="nutri-search-empty"><Icon name="search" size={30}/><strong>{t(query?'Aucun aliment dans ton historique pour cette recherche.':'Ton historique apparaîtra après tes premiers repas enregistrés.')}</strong></div>}
      {items.length>limit && <button className="btn btn-secondary nutri-history-more" onClick={()=>setLimit(value=>value+24)}>{t('Voir plus d’aliments')}</button>}
    </>}
  </NutritionModal>;
}
