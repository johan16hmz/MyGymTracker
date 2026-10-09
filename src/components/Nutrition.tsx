import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { locale, t, useLanguage, useWeightUnit } from '../i18n';
import { estimateCalories, localDate } from '../nutrition';
import type { ActivityLevel, EquationSex, FoodEntry, Meal, NutritionDay, NutritionGoal, NutritionProfile } from '../nutrition';
import { loadNutritionDay, loadNutritionProfile, loadRecentFoods, saveNutritionDay, saveNutritionProfile } from '../nutritionService';
import type { Workout } from '../types';
import { DecimalInput } from './DecimalInput';
import { FoodComposer } from './NutritionFoodComposer';
import { NutritionDiary } from './NutritionDiary';

const Scanner=lazy(()=>import('./NutritionScanner').then(module=>({default:module.NutritionScanner})));
const round = (value: number) => Math.round(value * 10) / 10;
const number = (value: number) => Math.round(value).toLocaleString(locale());
const poundsPerKg = 2.2046226218;

export function ProfileForm({ initial, onSave, onCancel, saving }: {
  initial?: NutritionProfile;
  onSave: (profile: NutritionProfile) => Promise<void>;
  onCancel?: () => void;
  saving: boolean;
}) {
  useLanguage();
  const weightUnit = useWeightUnit();
  const previousUnit = useRef(weightUnit);
  const [goal, setGoal] = useState<NutritionGoal>(initial?.goal ?? 'lose');
  const [weightKg, setWeightKg] = useState(initial ? String(round(initial.weightKg * (weightUnit === 'lb' ? poundsPerKg : 1))) : '');
  const [targetKg, setTargetKg] = useState(initial ? String(round(initial.targetKg * (weightUnit === 'lb' ? poundsPerKg : 1))) : '');
  const [age, setAge] = useState(initial?.age?.toString() ?? '');
  const [heightCm, setHeightCm] = useState(initial?.heightCm?.toString() ?? '');
  const [equationSex, setEquationSex] = useState<EquationSex | ''>(initial?.equationSex ?? '');
  const [activity, setActivity] = useState<ActivityLevel>(initial?.activity ?? 'moderate');
  const [calorieOverride, setCalorieOverride] = useState(initial?.calorieOverride?.toString() ?? '');
  const [fiberGoal,setFiberGoal]=useState(String(initial?.fiberGoal ?? 30));
  const [stepGoal,setStepGoal]=useState(String(initial?.stepGoal ?? 10000));
  const [baselineSteps,setBaselineSteps]=useState(String(initial?.baselineSteps ?? 5000));
  const [adjustForSteps,setAdjustForSteps]=useState(initial?.adjustForSteps ?? false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (previousUnit.current === weightUnit) return;
    const factor = weightUnit === 'lb' ? poundsPerKg : 1 / poundsPerKg;
    setWeightKg(value => value ? String(round(Number(value) * factor)) : '');
    setTargetKg(value => value ? String(round(Number(value) * factor)) : '');
    previousUnit.current = weightUnit;
  }, [weightUnit]);
  const profile: NutritionProfile = { goal, weightKg: Number(weightKg) / (weightUnit === 'lb' ? poundsPerKg : 1), targetKg: Number(targetKg) / (weightUnit === 'lb' ? poundsPerKg : 1), age: Number(age), heightCm: Number(heightCm), equationSex: equationSex as EquationSex, activity, fiberGoal:Number(fiberGoal),stepGoal:Number(stepGoal),baselineSteps:Number(baselineSteps),adjustForSteps, ...(calorieOverride ? { calorieOverride: Number(calorieOverride) } : {}) };
  let estimate: ReturnType<typeof estimateCalories> | null = null;
  if (weightKg && targetKg && age && heightCm && equationSex) {
    try { estimate = estimateCalories(profile); } catch { /* Show validation on submit. */ }
  }

  return <form className="nutrition-setup nutrition-card" onSubmit={event => {
    event.preventDefault();
    try {
      if (!equationSex) throw new Error(t('Choisis une formule de calcul.'));
      estimateCalories(profile);
      if (calorieOverride && (!Number.isFinite(profile.calorieOverride) || profile.calorieOverride! < 1200 || profile.calorieOverride! > 6000)) throw new Error(t('Saisis un objectif calorique valide.'));
      if(!fiberGoal || Number(fiberGoal)<10 || Number(fiberGoal)>100 || !Number.isFinite(Number(fiberGoal)) || !Number.isInteger(Number(stepGoal)) || Number(stepGoal)<1000 || Number(stepGoal)>50000 || !baselineSteps || !Number.isInteger(Number(baselineSteps)) || Number(baselineSteps)<0 || Number(baselineSteps)>50000)throw new Error(t('Vérifie tes repères de fibres et de pas.'));
      setError('');
      void onSave(profile).catch(err => setError(err instanceof Error ? err.message : t('Enregistrement impossible.')));
    } catch (err) { setError(err instanceof Error ? t(err.message) : t('Vérifie les informations saisies.')); }
  }}>
    <fieldset disabled={saving} className="nutri-profile-fields">
    <div className="nutrition-card-heading"><div><p className="eyebrow">{t('TON POINT DE DÉPART')}</p><h2>{initial ? t('Modifier mon objectif') : t('Construisons ton objectif')}</h2><p>{t('Quelques informations pour estimer tes besoins quotidiens.')}</p></div></div>
    <fieldset className="nutrition-goals"><legend>{t('Quel est ton objectif ?')}</legend>
      {(['lose', 'maintain', 'gain'] as const).map(option => <label key={option} className={goal === option ? 'selected' : ''}><input type="radio" name="goal" checked={goal === option} onChange={() => setGoal(option)} />{t(option === 'lose' ? 'Perdre du poids' : option === 'gain' ? 'Prendre du poids' : 'Maintenir mon poids')}</label>)}
    </fieldset>
    <div className="nutrition-form-grid">
      <label>{t('Poids actuel')} ({weightUnit})<DecimalInput required min={weightUnit === 'lb' ? 55 : 25} max={weightUnit === 'lb' ? 882 : 400} step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} /></label>
      <label>{t('Poids visé')} ({weightUnit})<DecimalInput required min={weightUnit === 'lb' ? 55 : 25} max={weightUnit === 'lb' ? 882 : 400} step="0.1" value={targetKg} onChange={e => setTargetKg(e.target.value)} /></label>
      <label>{t('Âge (années)')}<input type="number" required min="18" max="100" step="1" value={age} onChange={e => setAge(e.target.value)} /></label>
      <label>{t('Taille (cm)')}<input type="number" required min="100" max="250" step="1" value={heightCm} onChange={e => setHeightCm(e.target.value)} /></label>
      <label>{t('Équation de calcul')}<select required value={equationSex} onChange={e => setEquationSex(e.target.value as EquationSex | '')}><option value="">{t('Choisir une formule')}</option><option value="male">{t('Formule homme')}</option><option value="female">{t('Formule femme')}</option></select></label>
      <label>{t('Entraînements par semaine')}<select value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)}><option value="low">{t('0–1 séance')}</option><option value="moderate">{t('2–3 séances')}</option><option value="active">{t('4–5 séances')}</option><option value="veryActive">{t('6 séances ou plus')}</option></select></label>
    </div>
    {estimate && <div className="nutrition-estimate"><span>{t('Maintien estimé')} <strong>{number(estimate.maintenance)} kcal</strong></span><span>{t('Objectif proposé')} <strong>{number(estimate.target)} kcal / {t('jour')}</strong></span></div>}
    <details className="nutrition-override"><summary>{t('Ajuster manuellement l’objectif calorique')}</summary><label>{t('Calories par jour (facultatif)')}<input type="number" min="1200" max="6000" step="10" value={calorieOverride} onChange={e => setCalorieOverride(e.target.value)} /></label></details>
    <details className="nutrition-override"><summary>{t('Fibres, pas et ajustement calorique')}</summary><div className="nutrition-form-grid"><label>{t('Repère de fibres (g / jour)')}<DecimalInput required min={10} max={100} value={fiberGoal} onChange={event=>setFiberGoal(event.target.value)}/></label><label>{t('Repère de pas / jour')}<input required type="number" min={1000} max={50000} step={1} value={stepGoal} onChange={event=>setStepGoal(event.target.value)}/></label><label>{t('Pas habituels déjà inclus')}<input required type="number" min={0} max={50000} step={1} value={baselineSteps} onChange={event=>setBaselineSteps(event.target.value)}/></label></div><label className="nutri-toggle"><input type="checkbox" checked={adjustForSteps} onChange={event=>setAdjustForSteps(event.target.checked)}/>{t('Ajuster les calories avec les pas supplémentaires')}</label><p className="nutri-hint">{t('Le calcul de base inclut déjà ton activité. Pour limiter le double comptage, seuls les pas au-delà de ton seuil habituel ajoutent une estimation de marche nette, plafonnée à 600 kcal. Ajustement désactivé par défaut.')}</p><p className="nutri-source-note"><a href="https://pacompendium.com/walking/" target="_blank" rel="noreferrer">2024 Adult Compendium</a> · <a href="https://www.ameli.fr/assure/sante/themes/alimentation/fibres-alimentaires/fibres-alimentaires-consommation" target="_blank" rel="noreferrer">{t('Repères de fibres')}</a> · {t('Repères personnalisables, non prescrits.')}</p></details>
    <p className="nutrition-disclaimer">{t('Estimation pour adultes : équation de Mifflin–St Jeor et facteur d’activité approximatif. Adapte-la selon ton évolution et tes besoins ; ce n’est pas un avis médical.')} <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">{t('Source du calcul')}</a></p>
    {error && <p className="nutrition-error" role="alert">{error}</p>}
    <div className="nutrition-actions"><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('Enregistrement…') : t('Enregistrer mon objectif')}</button>{onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>{t('Annuler')}</button>}</div>
    </fieldset>
  </form>;
}

export function Nutrition({ userId, focusWeight = false }: { userId: string; focusWeight?: boolean }) {
  useLanguage();
  const [profile,setProfile]=useState<NutritionProfile>();
  const [profileRecord,setProfileRecord]=useState<Workout>();
  const [date,setDate]=useState(localDate());
  const [day,setDay]=useState<NutritionDay>({date:localDate(),entries:[]});
  const [recent,setRecent]=useState<FoodEntry[]>([]);
  const [loadingProfile,setLoadingProfile]=useState(true);
  const [loadingDay,setLoadingDay]=useState(true);
  const [saving,setSaving]=useState(false);
  const [editingProfile,setEditingProfile]=useState(false);
  const [openWeight,setOpenWeight]=useState(focusWeight);
  const [composer,setComposer]=useState<{meal:Meal;entry?:FoodEntry}>();
  const [profileError,setProfileError]=useState('');
  const [dayError,setDayError]=useState('');
  const [reload,setReload]=useState(0);
  const [profileReload,setProfileReload]=useState(0);
  const busy=useRef(false);
  const scope=useRef('');
  const editing=useRef(false);
  const weightEditing=useRef(false);
  scope.current=userId+'|'+date;
  editing.current=!!composer || editingProfile;
  useEffect(()=>{
    let active=true;setLoadingProfile(true);setProfileError('');
    void loadNutritionProfile(userId).then(result=>{if(active){setProfile(result.profile);setProfileRecord(result.record);}}).catch(error=>{if(active)setProfileError(error.message);}).finally(()=>{if(active)setLoadingProfile(false);});
    void loadRecentFoods(userId).then(value=>{if(active)setRecent(value);}).catch(()=>{/* Recent foods are optional; the search remains available. */});
    return()=>{active=false;};
  },[userId,profileReload]);
  useEffect(()=>{
    let active=true;setLoadingDay(true);setDayError('');
    void loadNutritionDay(userId,date).then(result=>{if(active)setDay(result.day);}).catch(error=>{if(active)setDayError(error.message);}).finally(()=>{if(active)setLoadingDay(false);});
    return()=>{active=false;};
  },[userId,date,reload]);
  useEffect(()=>{setComposer(undefined);setEditingProfile(false);},[userId,date]);
  useEffect(()=>{
    // Pick up server-side Health deliveries on return to the app, without
    // replacing open form inputs or polling while the app is in the background.
    const refresh=()=>{if(document.visibilityState==='visible' && !busy.current && !editing.current && !weightEditing.current)setReload(value=>value+1);};
    window.addEventListener('focus',refresh);
    const timer=setInterval(refresh,60000);
    return()=>{window.removeEventListener('focus',refresh);clearInterval(timer);};
  },[]);
  const persistProfile=async(next:NutritionProfile)=>{
    if(busy.current)throw new Error(t('Un enregistrement est déjà en cours.'));
    const owner=scope.current;busy.current=true;setSaving(true);
    try{const saved=await saveNutritionProfile(userId,next,profileRecord);if(scope.current===owner){setProfile(saved.exercises.find(ex=>ex.nutritionProfile)?.nutritionProfile ?? next);setProfileRecord(saved);setEditingProfile(false);}}
    finally{busy.current=false;setSaving(false);}
  };
  const persistDay=async(change:(latest:NutritionDay)=>NutritionDay)=>{
    if(busy.current || loadingDay || dayError || day.date!==date)throw new Error(t('Attends le chargement de la journée avant de modifier le journal.'));
    const owner=scope.current;busy.current=true;setSaving(true);
    try{
      // Merge against the latest server record to retain new Health deliveries,
      // water changes and foods logged from another device.
      const latest=await loadNutritionDay(userId,date);
      if(scope.current!==owner)throw new Error(t('La journée a changé. Réessaie.'));
      const next=change(latest.day);await saveNutritionDay(userId,next,latest.record);
      if(scope.current===owner){setDay(next);setRecent(previous=>[...next.entries,...previous.filter(item=>!next.entries.some(entry=>entry.id===item.id))]);}
    }finally{busy.current=false;setSaving(false);}
  };
  if(loadingProfile)return <div className="loading-panel" role="status"><span className="loading-spinner"/>{t('Chargement de ton journal nutrition…')}</div>;
  if(profileError)return <div className="nutrition-error" role="alert">{profileError}<button className="btn btn-secondary" onClick={()=>setProfileReload(value=>value+1)}>{t('Réessayer')}</button></div>;
  if(!profile || editingProfile)return <section className="nutrition-page"><div className="nutrition-page-header"><p className="eyebrow">NUTRITION</p><h1>{t('Mange avec intention.')}</h1><p>{t('Ton objectif, tes repas, ta progression.')}</p></div><ProfileForm initial={profile} saving={saving} onSave={persistProfile} onCancel={profile?()=>setEditingProfile(false):undefined}/></section>;
  return <>
    <NutritionDiary profile={profile} day={day} date={date} busy={saving} loading={loadingDay} error={dayError} focusWeight={openWeight}
      onDate={next=>{if(!busy.current){setOpenWeight(false);setDate(next);}}} onProfile={()=>setEditingProfile(true)} onAdd={meal=>setComposer({meal})} onEdit={entry=>setComposer({meal:entry.meal,entry})}
      onRemove={entry=>{if(confirm(t('Retirer cet aliment du journal ?')))void persistDay(latest=>({...latest,entries:latest.entries.filter(item=>item.id!==entry.id)})).catch(error=>setDayError(error.message));}}
      onSteps={count=>persistDay(latest=>({...latest,steps:{count,source:'manual',updatedAt:new Date().toISOString()}}))}
      onWater={waterMl=>persistDay(latest=>({...latest,waterMl}))}
      onWeight={weightKg=>persistDay(latest=>({...latest,weightKg}))}
      onWeightEditingChange={active=>{weightEditing.current=active;}}
      onRefresh={()=>setReload(value=>value+1)}/>
    {composer && <FoodComposer key={composer.entry?.id ?? composer.meal} meal={composer.meal} existing={composer.entry} recent={recent}
      onSave={entry=>persistDay(latest=>({...latest,entries:[...latest.entries.filter(item=>item.id!==entry.id),entry]}))}
      onClose={()=>setComposer(undefined)} renderScanner={(onCode,onError)=><Suspense fallback={<p role="status">{t('Chargement de la caméra…')}</p>}><Scanner onCode={onCode} onError={onError}/></Suspense>}/>}
  </>;
}
