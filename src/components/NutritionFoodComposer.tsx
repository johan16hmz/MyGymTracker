import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { locale, t, useLanguage } from '../i18n';
import { defaultPortions, foodTotals } from '../nutrition';
import type { Food, FoodEntry, Meal } from '../nutrition';
import { filterFoodCatalog, foodBrandLabel, foodKindLabel, loadFoodCatalog, lookupFood, rankFoodSearch, searchBrandedFoods } from '../nutritionFood';
import type { FoodCandidate } from '../nutritionFood';
import { DecimalInput } from './DecimalInput';
import { Icon } from './Icon';
import { NutritionModal } from './NutritionModal';

const format = (value:number) => rounded(value).toLocaleString(locale());
export const mealNames: Record<Meal,string> = {breakfast:'Petit-déjeuner',lunch:'Déjeuner',snack:'En-cas',dinner:'Dîner'};
const rounded = (value:number) => Math.round(value*10)/10;
export function FoodComposer({meal,existing,recent,onSave,onClose,renderScanner}: {meal:Meal;existing?:FoodEntry;recent:FoodEntry[];onSave:(entry:FoodEntry)=>Promise<void>;onClose:()=>void;renderScanner:(onCode:(code:string)=>void,onError:(message:string)=>void)=>ReactNode}) {
  const language = useLanguage();
  const [mode,setMode] = useState<'search'|'barcode'|'manual'>('search');
  const [scope,setScope] = useState<'all'|'common'|'brands'|'recent'>('all');
  const [query,setQuery] = useState('');
  const [catalog,setCatalog] = useState<FoodCandidate[]>([]);
  const [results,setResults] = useState<FoodCandidate[]>([]);
  const [brandsSearched,setBrandsSearched] = useState(false);
  const [catalogBusy,setCatalogBusy] = useState(true);
  const [lookupBusy,setLookupBusy] = useState(false);
  const [scanning,setScanning] = useState(false);
  const [barcode,setBarcode] = useState('');
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const [selected,setSelected] = useState<FoodCandidate | undefined>(existing?.food);
  const [name,setName] = useState(existing?.food.name ?? '');
  const [brand,setBrand] = useState(existing?.food.brand ?? '');
  const [unit,setUnit] = useState<'g'|'ml'>(existing?.food.unit ?? 'g');
  const [quantity,setQuantity] = useState(String(existing?.quantity ?? 100));
  const [values,setValues] = useState(() => ['kcal100','protein100','carbs100','fat100','fiber100'].map(key => existing?.food[key as keyof Food]?.toString() ?? ''));
  const abortRef = useRef<AbortController | undefined>(undefined);
  const autoSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastBrandSearchAt = useRef(0);
  const searchVersion = useRef(0);
  useEffect(() => {
    let active = true;
    void loadFoodCatalog().then(foods=>{if(active)setCatalog(foods);}).catch(()=>{if(active)setError(t('Catalogue alimentaire indisponible.'));}).finally(()=>{if(active)setCatalogBusy(false);});
    return()=>{active=false; searchVersion.current++; abortRef.current?.abort();clearTimeout(autoSearchTimer.current);};
  },[]);
  const cancelLookup = () => {
    clearTimeout(autoSearchTimer.current);abortRef.current?.abort();searchVersion.current++;setLookupBusy(false);
  };
  const changeQuery = (value:string) => {
    cancelLookup();setQuery(value);setResults([]);setBrandsSearched(false);setError('');
  };
  const changeMode = (next:'search'|'barcode'|'manual') => {
    cancelLookup();setMode(next);setScanning(false);setError('');
    if(next==='manual'){setName('');setBrand('');setValues(['','','','','']);}
  };
  const select = (food:FoodCandidate) => {
    cancelLookup();setSelected(food);setMode('search');setError('');setScanning(false);
    setName(language === 'en' && food.nameEn ? food.nameEn : food.name);setBrand(food.brand ?? '');setUnit(food.unit);
    setValues([food.kcal100,food.protein100,food.carbs100,food.fat100,food.fiber100].map(value=>value?.toString() ?? ''));
    setQuantity(String(defaultPortions(food)[0].quantity));
  };
  const selectResult = async (food:FoodCandidate) => {
    const missing=[food.kcal100,food.protein100,food.carbs100,food.fat100].some(value=>value===null);
    if(!missing || !food.barcode){select(food);return;}
    cancelLookup();const version=++searchVersion.current;setLookupBusy(true);setError('');
    try {const details=await lookupFood(food.barcode);if(version===searchVersion.current)select(details);}
    catch {if(version===searchVersion.current)select(food);} // Keep the name and request missing facts from the label.
    finally {if(version===searchVersion.current)setLookupBusy(false);}
  };
  const searchBrands = async () => {
    clearTimeout(autoSearchTimer.current);
    if(query.trim().length<2 || (scope!=='all' && scope!=='brands'))return;
    abortRef.current?.abort();const version=++searchVersion.current;const controller=new AbortController();abortRef.current=controller;
    setLookupBusy(true);setError('');
    lastBrandSearchAt.current=Date.now();
    try {const foods=await searchBrandedFoods(query,controller.signal);if(version===searchVersion.current){setResults(foods);setBrandsSearched(true);}}
    catch(error){if(version===searchVersion.current && !controller.signal.aborted)setError(error instanceof Error?t(error.message):t('Recherche indisponible.'));}
    finally{if(version===searchVersion.current)setLookupBusy(false);}
  };
  useEffect(()=>{
    if(mode!=='search' || selected || (scope!=='all' && scope!=='brands') || query.trim().length<3)return;
    // Debounce typing and space automatic requests to respect OFF's search limit.
    autoSearchTimer.current=setTimeout(()=>void searchBrands(),Math.max(900,6500-(Date.now()-lastBrandSearchAt.current)));
    return()=>clearTimeout(autoSearchTimer.current);
  },[query,scope,mode,selected]);
  const scan = async (code:string) => {
    abortRef.current?.abort();setBarcode(code);setScanning(false);setLookupBusy(true);setError('');const version=++searchVersion.current;
    try {const food=await lookupFood(code);if(version===searchVersion.current)select(food);}
    catch(error){if(version===searchVersion.current)setError(error instanceof Error?t(error.message):t('Recherche indisponible.'));}
    finally{if(version===searchVersion.current)setLookupBusy(false);}
  };
  const recentFoods = recent.filter((entry,index)=>recent.findIndex(other=>(other.food.barcode || other.food.id || `${other.food.name}|${other.food.brand}`)===(entry.food.barcode || entry.food.id || `${entry.food.name}|${entry.food.brand}`))===index).map(entry=>entry.food);
  const suggestions = query.trim() ? filterFoodCatalog(catalog,query) : ['Banane chair crue','Poulet filet grillé','Riz blanc cuit','Flocon avoine','Yaourt nature','Œuf dur'].flatMap(term=>filterFoodCatalog(catalog,term).slice(0,1));
  const includesBrands = scope==='all' || scope==='brands';
  const awaitingBrands = includesBrands && query.trim().length>=3 && !brandsSearched && !error;
  const displayed = scope==='all' ? rankFoodSearch([...results,...suggestions],query) : scope === 'brands' ? results : scope === 'recent' ? query.trim()?filterFoodCatalog(recentFoods,query):recentFoods.slice(0,30) : suggestions;
  const numeric = values.map(Number);
  const preview = foodTotals({name,source:selected?.source ?? 'manual',unit,kcal100:numeric[0]||0,protein100:numeric[1]||0,carbs100:numeric[2]||0,fat100:numeric[3]||0,fiber100:values[4] ? numeric[4]:undefined},Number(quantity)||0);
  const portions = defaultPortions({...selected,name:selected?.name || name,unit});
  const editing = !!selected || mode === 'manual';
  const incomplete = values.slice(0,4).some(value=>!value.trim());
  return <NutritionModal title={existing?t('Modifier un aliment'):editing?name || t('Nouvel aliment'):t('Ajouter un aliment')} subtitle={t(mealNames[meal])} onClose={onClose} busy={saving}>
    {!editing ? <>
      <div className="nutri-tool-tabs" aria-label={t('Mode d’ajout')}>
        <button type="button" aria-pressed={mode==='search'} onClick={()=>changeMode('search')}><Icon name="search"/><span>{t('Rechercher')}</span></button>
        <button type="button" aria-pressed={mode==='barcode'} onClick={()=>changeMode('barcode')}><Icon name="barcode"/><span>{t('Code-barres')}</span></button>
        <button type="button" aria-pressed={false} onClick={()=>changeMode('manual')}><Icon name="edit"/><span>{t('Créer un aliment')}</span></button>
      </div>
      {mode==='search' ? <>
        <form className="nutri-search" onSubmit={event=>{event.preventDefault();if(includesBrands)void searchBrands();}}><Icon name="search"/><input aria-label={t('Rechercher un aliment')} placeholder={t('Nom de l’aliment ou marque…')} autoComplete="off" maxLength={80} value={query} onChange={event=>changeQuery(event.target.value)}/>{query && <button type="button" aria-label={t('Effacer la recherche')} onClick={()=>changeQuery('')}>×</button>}{includesBrands && <button type="submit" className="nutri-search-submit" disabled={lookupBusy || query.trim().length<2}>{t('Chercher')}</button>}</form>
        <div className="nutri-filter-chips">{(['all','common','brands','recent'] as const).map(option=><button type="button" key={option} aria-pressed={scope===option} onClick={()=>{cancelLookup();setScope(option);setError('');}}>{t(option==='all'?'Tout':option==='common'?'Aliments courants':option==='brands'?'Produits de marque':'Récents')}</button>)}</div>
        {includesBrands && <p className="nutri-search-hint">{t('Recherche automatique par nom ou marque à partir de 3 caractères.')}</p>}
        <div className="nutri-results-heading"><span>{t(query?'Résultats':'Pour commencer')}</span><small>{scope==='recent'?t('Ton journal'):scope==='brands'?'Open Food Facts':scope==='all'?'CIQUAL · Open Food Facts':'ANSES · CIQUAL 2025'}</small></div>
        {(lookupBusy || awaitingBrands) && displayed.length>0 && <p className="nutri-hint" role="status">{t('Recherche des produits de marque…')}</p>}
        {scope==='all' && brandsSearched && !results.length && displayed.length>0 && <p className="nutri-hint" role="status">{t('Aucun produit emballé trouvé pour ce nom ou cette marque.')}</p>}
        {(catalogBusy && (scope==='all' || scope==='common')) || ((lookupBusy || awaitingBrands) && !displayed.length) ? <div className="nutri-search-empty" role="status"><span className="loading-spinner"/>{t('Recherche…')}</div> : <div className="nutri-search-results" aria-live="polite">{displayed.map((food,index)=>{
          const portion=defaultPortions(food)[0];
          const kindLabel=foodKindLabel(food);
          return <button type="button" key={`${food.id || food.barcode || food.name}-${index}`} className="nutri-food-result" disabled={lookupBusy} onClick={()=>void selectResult(food)}>
            <span className="nutri-food-avatar"><Icon name="nutrition" size={22}/></span><span className="nutri-food-result-copy"><small className={food.brand?'nutri-food-brand':undefined}>{food.brand ? food.brand : t(foodBrandLabel(food))}</small><strong>{language==='en' && food.nameEn ? food.nameEn : food.name}</strong>{kindLabel && <span className="nutri-food-kind">{t(kindLabel)}</span>}<small>{portion.quantity} {food.unit}{food.servingQuantity ? ` · ${t('Portion de l’étiquette')}`:''}</small><span>{[food.kcal100,food.protein100,food.carbs100,food.fat100].some(value=>value===null)?t('Valeurs nutritionnelles à compléter'):<>{food.protein100===null?'—':format(food.protein100*portion.quantity/100)} g {t('protéines')} · {food.fiber100===undefined?'—':format(food.fiber100*portion.quantity/100)} g {t('fibres')}</>}</span></span><span className="nutri-food-result-end"><strong>{food.kcal100===null?'—':Math.round(food.kcal100*portion.quantity/100)} <small>kcal</small></strong><span className="nutri-plus">+</span></span>
          </button>;
        })}{!displayed.length && <div className="nutri-search-empty"><Icon name="search" size={30}/><strong>{t(error?'Recherche indisponible pour le moment.':includesBrands && !brandsSearched?'Cherche ton produit par son nom.':scope==='recent'?'Tes aliments récents apparaîtront ici.':'Aucun résultat pour ce nom.')}</strong><p>{t(error?'La base des produits de marque ne répond pas. Réessaie ou utilise les aliments courants.':includesBrands && !brandsSearched?'Saisis au moins 3 caractères ou appuie sur Chercher.':'Essaie un autre nom ou ajoute-le manuellement.')}</p></div>}</div>}
      </> : <div className="nutri-barcode-panel"><p>{t('Scanne l’emballage pour retrouver ses valeurs nutritionnelles.')}</p><button type="button" className="btn btn-primary" onClick={()=>{setError('');setScanning(value=>!value);}} disabled={lookupBusy}><Icon name="camera"/>{t(scanning?'Arrêter la caméra':'Scanner avec la caméra')}</button>{scanning && renderScanner(code=>void scan(code),message=>{setScanning(false);setError(message);})}<p className="nutri-hint">{t('Autorise la caméra dans ton navigateur. Les images restent sur ton appareil.')}</p><form className="nutri-barcode-input" onSubmit={event=>{event.preventDefault();void scan(barcode);}}><label>{t('Ou saisis le code-barres')}<input value={barcode} inputMode="numeric" onChange={event=>setBarcode(event.target.value.replace(/\D/g,''))} placeholder="EAN / UPC"/></label><button className="btn btn-secondary" type="submit" disabled={lookupBusy || !/^\d{8,14}$/.test(barcode)}>{t(lookupBusy?'Recherche…':'Rechercher')}</button></form></div>}
    </> : <form onSubmit={event=>{
      event.preventDefault();
      if (!name.trim() || !quantity.trim() || incomplete || numeric.some((value,index)=>!Number.isFinite(value) || value<0 || (index>0 && value>100)) || !Number.isFinite(Number(quantity)) || Number(quantity)<=0 || Number(quantity)>10000 || numeric[0]>1000) {setError(t('Vérifie le nom, la quantité et les valeurs nutritionnelles.'));return;}
      const food:Food={...selected,name:name.trim(),brand:brand.trim() || undefined,source:selected?.source ?? 'manual',unit,kcal100:numeric[0],protein100:numeric[1],carbs100:numeric[2],fat100:numeric[3],fiber100:values[4].trim()?numeric[4]:undefined};
      setSaving(true);setError('');
      void onSave({id:existing?.id ?? crypto.randomUUID(),meal,food,quantity:Number(quantity),addedAt:existing?.addedAt ?? new Date().toISOString()}).then(onClose).catch(error=>setError(error instanceof Error?error.message:t('Enregistrement impossible. Tes saisies sont conservées ici. Vérifie ta connexion puis réessaie.'))).finally(()=>setSaving(false));
    }}>
      {!existing && <button type="button" className="nutri-back-link" disabled={saving} onClick={()=>{setSelected(undefined);setMode('search');setError('');}}>‹ {t('Retour à la recherche')}</button>}
      <div className="nutri-food-detail"><span className="nutri-detail-badge">{selected?.source==='ciqual'?'ANSES · CIQUAL':selected?.source==='openfoodfacts'?'Open Food Facts':t('Aliment personnel')}</span><h3>{name || t('Nouvel aliment')}</h3>{brand && <p>{brand}</p>}{selected && foodKindLabel(selected) && <span className="nutri-food-kind">{t(foodKindLabel(selected)!)}</span>}{selected?.description && <p className="nutri-food-description">{selected.description}</p>}<div className="nutri-food-macros"><div><strong>{Math.round(preview.kcal)}</strong><span>kcal</span></div><div><strong>{format(preview.protein)} g</strong><span>{t('Protéines')}</span></div><div><strong>{format(preview.carbs)} g</strong><span>{t('Glucides')}</span></div><div><strong>{format(preview.fat)} g</strong><span>{t('Lipides')}</span></div><div><strong>{values[4]?`${format(preview.fiber)} g`:'—'}</strong><span>{t('Fibres')}</span></div></div></div>
      <div className="nutri-portion-section"><div className="nutri-section-title"><h3>{t('Quelle quantité ?')}</h3><span>{t('Pour cette portion')}</span></div><div className="nutri-portions">{portions.map(portion=><button key={portion.quantity} type="button" disabled={saving} aria-pressed={Number(quantity)===portion.quantity} onClick={()=>setQuantity(String(portion.quantity))}><strong>{format(portion.quantity)} {unit}</strong>{portion.label!==`${portion.quantity} ${unit}` && <span>{t(portion.label)}</span>}</button>)}</div><p className="nutri-hint">{t(selected?.servingQuantity?'La portion de l’étiquette est proposée ; adapte-la à ce que tu as mangé.':'Portions indicatives, pas une prescription. Ajuste selon ce que tu as mangé.')}</p><div className="nutrition-form-grid nutrition-quantity"><label>{t('Quantité consommée')}<DecimalInput required min="0.1" max="10000" disabled={saving} value={quantity} onChange={event=>setQuantity(event.target.value)}/></label><label>{t('Unité')}<select disabled={saving || !!selected} value={unit} onChange={event=>setUnit(event.target.value as 'g'|'ml')}><option value="g">g</option><option value="ml">ml</option></select></label></div><div className="nutri-multipliers">{[0.5,1,2].map(multiplier=><button key={multiplier} type="button" disabled={saving} onClick={()=>setQuantity(String(rounded(portions[0].quantity*multiplier)))}>{multiplier===0.5?'½':multiplier} × {t('portion')}</button>)}</div></div>
      <details className="nutri-food-edit" open={mode==='manual' || incomplete || existing ? true:undefined}><summary>{t('Nom et valeurs nutritionnelles')}</summary><div className="nutrition-form-grid"><label className="nutrition-name">{t('Nom de l’aliment')}<input required disabled={saving} maxLength={150} value={name} onChange={event=>setName(event.target.value)}/></label><label>{t('Marque (facultatif)')}<input disabled={saving} maxLength={100} value={brand} onChange={event=>setBrand(event.target.value)}/></label></div><p className="nutrition-form-caption">{unit==='g'?t('Valeurs pour 100 g'):t('Valeurs pour 100 ml')}</p><div className="nutrition-form-grid nutri-nutrient-inputs">{['Calories (kcal)','Protéines (g)','Glucides (g)','Lipides (g)','Fibres (g)'].map((label,index)=><label key={label}>{t(label)}<DecimalInput required={index<4} min="0" max={index===0?1000:100} disabled={saving} value={values[index]} placeholder={index===4?t('Inconnues'):undefined} onChange={event=>setValues(previous=>previous.map((value,item)=>item===index?event.target.value:value))}/></label>)}</div>{incomplete && <p className="nutri-hint">{t('Certaines valeurs manquent. Complète-les avec l’étiquette avant l’ajout.')}</p>}</details>
      {values[4]==='' && <p className="nutri-hint">{t('Fibres non renseignées : elles ne seront pas comptées comme zéro connu.')}</p>}
      {error && <p className="nutrition-error" role="alert">{error}</p>}
      <footer className="nutri-sheet-footer"><div><strong>{Math.round(preview.kcal)} kcal</strong><small>{format(Number(quantity)||0)} {unit} · {t(mealNames[meal])}</small></div><button className="btn btn-primary" type="submit" disabled={saving}><Icon name="plus"/>{t(saving?'Enregistrement…':existing?'Enregistrer':'Ajouter au journal')}</button></footer>
    </form>}
    {!editing && error && <p className="nutrition-error" role="alert">{error}</p>}
    <p className="nutri-source-note">{t('Valeurs moyennes et données déclarées : vérifie le produit et son état cru ou cuit.')} <a href="https://doi.org/10.57745/RDMHWY" target="_blank" rel="noreferrer">ANSES-CIQUAL 2025</a> · <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a></p>
  </NutritionModal>;
}
