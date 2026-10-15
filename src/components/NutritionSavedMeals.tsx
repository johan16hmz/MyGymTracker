import { useRef, useState } from 'react';
import type { FoodEntry, Meal, SavedMeal } from '../nutrition';
import { sumEntries } from '../nutrition';
import { createSavedMeal, savedMealEntries } from '../nutritionMeals';
import { locale, t, useLanguage } from '../i18n';
import { DecimalInput } from './DecimalInput';
import { NutritionModal } from './NutritionModal';
import { mealNames } from './NutritionFoodComposer';
import { Icon } from './Icon';

export interface SavedMealDraft { meal: Meal; items: SavedMeal['items'] }
export function NutritionSavedMeals({ meals, meal, initial, loading, error:loadError, onRetry, onSave, onAdd, onClose }: {
  meals: SavedMeal[]; meal: Meal; initial?: SavedMealDraft; loading:boolean; error:string;
  onRetry:()=>void; onSave:(meal:SavedMeal)=>Promise<void>; onAdd:(entries:FoodEntry[])=>Promise<void>; onClose:()=>void;
}) {
  useLanguage();
  const [draft,setDraft]=useState<SavedMeal|undefined>(()=>initial?{id:crypto.randomUUID(),name:'',meal:initial.meal,items:structuredClone(initial.items),updatedAt:new Date().toISOString()}:undefined);
  const [quantities,setQuantities]=useState<string[]>(()=>initial?.items.map(item=>String(item.quantity)) ?? []);
  const [destination,setDestination]=useState(meal);
  const [query,setQuery]=useState('');
  const [archived,setArchived]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const operation=useRef(false);
  const pendingAdd=useRef<{id:string;meal:Meal;entries:FoodEntry[]}|undefined>(undefined);
  const run=async(action:()=>Promise<void>)=>{
    if(operation.current)return;
    operation.current=true;setBusy(true);setError('');setMessage('');
    try{await action();}catch(error){setError(error instanceof Error?t(error.message):t('Enregistrement impossible.'));}
    finally{operation.current=false;setBusy(false);}
  };
  const edit=(saved:SavedMeal)=>{pendingAdd.current=undefined;setDraft(structuredClone(saved));setQuantities(saved.items.map(item=>String(item.quantity)));setError('');setMessage('');};
  const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const shown=meals.filter(saved=>!!saved.archived===archived && normalize(saved.name+' '+saved.items.map(item=>item.food.name+' '+(item.food.brand ?? '')).join(' ')).includes(normalize(query.trim())));
  const format=(value:number)=>value.toLocaleString(locale(),{maximumFractionDigits:1});
  return <NutritionModal title={t(draft?'Enregistrer un repas':'Mes repas enregistrés')} subtitle={t('TES REPAS HABITUELS')} onClose={onClose} busy={busy}>
    {draft ? <form onSubmit={event=>{event.preventDefault();void run(async()=>{
      const next=createSavedMeal(draft.name,draft.meal,draft.items.map((item,index)=>({...item,quantity:quantities[index]?.trim()?Number(quantities[index]):NaN})),draft.id);
      await onSave(next);pendingAdd.current=undefined;setDraft(undefined);setArchived(false);setQuery('');setMessage(t('Repas enregistré. Tu pourras le réutiliser sans tout ressaisir.'));
    });}}>
      <p className="nutri-hint">{t('Ce modèle conserve les aliments, les marques et les quantités. L’enregistrer n’ajoute rien de plus au journal.')}</p>
      <fieldset disabled={busy || loading} className="nutri-profile-fields">
        <label className="nutri-saved-name">{t('Nom du repas')}<input required maxLength={100} placeholder={t('Ex. Mon déjeuner habituel')} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})}/></label>
        <div className="nutri-saved-items">{draft.items.map((item,index)=><div className="nutri-saved-item" key={index}>
          <div><strong>{item.food.name}</strong><small>{item.food.brand || t('Sans marque')}</small></div>
          <label><span className="sr-only">{t('Quantité')} · {item.food.name} ({item.food.unit})</span><DecimalInput required min="0.1" max="10000" value={quantities[index] ?? ''} onChange={event=>setQuantities(previous=>previous.map((value,i)=>i===index?event.target.value:value))}/><small>{item.food.unit}</small></label>
          <button type="button" className="nutri-icon-button" disabled={busy || draft.items.length===1} aria-label={`${t('Retirer du modèle')} · ${item.food.name}`} onClick={()=>{setDraft({...draft,items:draft.items.filter((_,i)=>i!==index)});setQuantities(previous=>previous.filter((_,i)=>i!==index));}}><Icon name="trash" size={17}/></button>
        </div>)}</div>
        <p className="nutri-hint">{t('Ces modifications ne changent pas les repas déjà consommés.')}</p>
        {error && <p role="alert" className="nutrition-error">{error}</p>}
        <footer className="nutri-sheet-footer"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>{setDraft(undefined);setError('');}}>{t('Annuler')}</button><button type="submit" className="btn btn-primary" disabled={busy || loading}>{t(busy?'Enregistrement…':'Enregistrer le repas')}</button></footer>
      </fieldset>
    </form> : <>
      <p className="nutri-hint">{t('Ajoute tous les aliments d’un repas en une fois, sans remplacer ce qui est déjà dans ton journal.')}</p>
      <div className="nutri-history-controls"><label>{t('Ajouter au repas')}<select disabled={busy} value={destination} onChange={event=>{setDestination(event.target.value as Meal);pendingAdd.current=undefined;}}>{Object.entries(mealNames).map(([value,label])=><option value={value} key={value}>{t(label)}</option>)}</select></label><label>{t('Retrouver un repas')}<input value={query} disabled={busy} placeholder={t('Nom du repas ou aliment…')} onChange={event=>setQuery(event.target.value)}/></label></div>
      <label className="nutri-toggle"><input type="checkbox" checked={archived} disabled={busy} onChange={event=>setArchived(event.target.checked)}/>{t('Afficher les repas archivés')}</label>
      {message && <p className="nutri-added-message" role="status">{message}</p>}
      {error && <p className="nutrition-error" role="alert">{error}</p>}
      {loading?<div className="loading-panel" role="status">{t('Chargement des repas enregistrés…')}</div>:loadError?<p className="nutrition-error" role="alert">{t(loadError)} <button className="btn btn-secondary" onClick={onRetry}>{t('Réessayer')}</button></p>:<div className="nutri-saved-list">{shown.map(saved=>{
        const totals=sumEntries(saved.items);
        return <article className="nutri-saved-card" key={saved.id}><header><div><small>{t(mealNames[saved.meal])}</small><h3>{saved.name}</h3></div><strong>{format(Math.round(totals.kcal))} kcal</strong></header>
          <ul>{saved.items.map((item,index)=><li key={index}><span>{item.food.name}{item.food.brand?` · ${item.food.brand}`:''}</span><strong>{format(item.quantity)} {item.food.unit}</strong></li>)}</ul>
          <p className="nutri-hint">{format(totals.protein)} g {t('protéines')} · {format(totals.fiber)} g {t('fibres')}{saved.items.some(item=>item.food.fiber100===undefined)?` · ${t('partiel')}`:''}</p>
          <footer>{saved.archived ? <button className="btn btn-secondary" disabled={busy} onClick={()=>void run(async()=>{await onSave({...saved,archived:false,updatedAt:new Date().toISOString()});setMessage(t('Repas restauré.'));})}>{t('Restaurer')}</button> : <>
            <button className="btn btn-primary" disabled={busy} aria-label={`${t('Ajouter ce repas')} · ${saved.name}`} onClick={()=>void run(async()=>{
              if(!pendingAdd.current || pendingAdd.current.id!==saved.id || pendingAdd.current.meal!==destination)pendingAdd.current={id:saved.id,meal:destination,entries:savedMealEntries(saved,destination)};
              await onAdd(pendingAdd.current.entries);pendingAdd.current=undefined;onClose();
            })}><Icon name="plus" size={17}/>{t('Ajouter ce repas')}</button>
            <button className="btn btn-secondary" disabled={busy} aria-label={`${t('Modifier')} · ${saved.name}`} onClick={()=>edit(saved)}><Icon name="edit" size={16}/>{t('Modifier')}</button>
            <button className="btn btn-secondary" disabled={busy} aria-label={`${t('Archiver')} · ${saved.name}`} onClick={()=>void run(async()=>{await onSave({...saved,archived:true,updatedAt:new Date().toISOString()});pendingAdd.current=undefined;setMessage(t('Repas archivé. Tu peux le restaurer à tout moment.'));})}>{t('Archiver')}</button>
          </>}</footer>
        </article>;
      })}{!shown.length && <div className="nutri-search-empty"><Icon name="nutrition" size={30}/><strong>{t('Aucun repas enregistré ici.')}</strong><p>{t('Compose un repas dans le journal, puis clique sur « Enregistrer ce repas » pour le retrouver ici.')}</p></div>}</div>}
    </>}
  </NutritionModal>;
}
