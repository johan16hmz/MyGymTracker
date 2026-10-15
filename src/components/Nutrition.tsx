import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { locale, t, useLanguage, useWeightUnit } from '../i18n';
import { estimateCalories, goalDateInMonths, localDate, macroTargets, trainingActivity } from '../nutrition';
import type { DailyActivity, TrainingKind, EquationSex, FoodEntry, Meal, NutritionDay, NutritionGoal, NutritionProfile, SavedMeal } from '../nutrition';
import { loadNutritionDay, loadNutritionProfile, loadRecentFoods, loadSavedMeals, saveSavedMeal, saveNutritionDay, saveNutritionProfile } from '../nutritionService';
import type { Workout } from '../types';
import { DecimalInput } from './DecimalInput';
import { FoodComposer } from './NutritionFoodComposer';
import { NutritionDiary } from './NutritionDiary';
import { NutritionFoodHistory } from './NutritionFoodHistory';
import { mergeFoodHistory } from '../nutritionHistory';
import type { FoodHistoryEntry } from '../nutritionHistory';
import { appendMealEntries } from '../nutritionMeals';
import { NutritionSavedMeals } from './NutritionSavedMeals';
import { PageHeading } from './PageHeading';
import type { SavedMealDraft } from './NutritionSavedMeals';

const Scanner=lazy(()=>import('./NutritionScanner').then(module=>({default:module.NutritionScanner})));
const round = (value: number) => Math.round(value * 10) / 10;
const number = (value: number) => Math.round(value).toLocaleString(locale());
const monthsLabel = (value: number) => value.toLocaleString(locale(), { style: 'unit', unit: 'month', unitDisplay: 'long', maximumFractionDigits: 2 });
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
  const [goalDate, setGoalDate] = useState(initial?.goalDate ?? '');
  const [age, setAge] = useState(initial?.age?.toString() ?? '');
  const [heightCm, setHeightCm] = useState(initial?.heightCm?.toString() ?? '');
  const [equationSex, setEquationSex] = useState<EquationSex | ''>(initial?.equationSex ?? '');
  const [dailyActivity,setDailyActivity]=useState<DailyActivity|''>(initial?.dailyActivity ?? '');
  const [sessionsPerWeek,setSessionsPerWeek]=useState(String(initial?.sessionsPerWeek ?? ({low:1,moderate:3,active:5,veryActive:6}[initial?.activity ?? 'moderate'])));
  const [sessionMinutes,setSessionMinutes]=useState(initial?.sessionMinutes?.toString() ?? '');
  const [trainingKind,setTrainingKind]=useState<TrainingKind|''>(initial?.trainingKind ?? '');
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
  const profile: NutritionProfile = { goal, weightKg: Number(weightKg) / (weightUnit === 'lb' ? poundsPerKg : 1), targetKg: Number(targetKg) / (weightUnit === 'lb' ? poundsPerKg : 1), ...(goal!=='maintain' && goalDate?{goalDate}:{}), age: Number(age), heightCm: Number(heightCm), equationSex: equationSex as EquationSex, activity:trainingActivity(Number(sessionsPerWeek)),dailyActivity:dailyActivity || undefined,sessionsPerWeek:Number(sessionsPerWeek),...(Number(sessionsPerWeek)>0?{sessionMinutes:Number(sessionMinutes),trainingKind:trainingKind || undefined}:{}), fiberGoal:Number(fiberGoal),stepGoal:Number(stepGoal),baselineSteps:Number(baselineSteps),adjustForSteps, ...(calorieOverride ? { calorieOverride: Number(calorieOverride) } : {}) };
  let estimate: ReturnType<typeof estimateCalories> | null = null;
  if (weightKg && targetKg && age && heightCm && equationSex) {
    try { estimate = estimateCalories(profile); } catch { /* Show validation on submit. */ }
  }
  const automaticMacros=estimate?macroTargets(profile,Number(calorieOverride) || estimate.target):undefined;

  return <form className="nutrition-setup nutrition-card" onSubmit={event => {
    event.preventDefault();
    try {
      if (!equationSex) throw new Error(t('Choisis une formule de calcul.'));
      const checked = estimateCalories(profile);
      if(checked.timeline?.expired)throw new Error(t('Choisis une date cible après aujourd’hui, ou retire le délai.'));
      if (calorieOverride && (!Number.isFinite(profile.calorieOverride) || profile.calorieOverride! < 1200 || profile.calorieOverride! > 6000)) throw new Error(t('Saisis un objectif calorique valide.'));
      if(!fiberGoal || Number(fiberGoal)<10 || Number(fiberGoal)>100 || !Number.isFinite(Number(fiberGoal)) || !Number.isInteger(Number(stepGoal)) || Number(stepGoal)<1000 || Number(stepGoal)>50000 || !baselineSteps || !Number.isInteger(Number(baselineSteps)) || Number(baselineSteps)<0 || Number(baselineSteps)>50000)throw new Error(t('Vérifie tes repères de fibres et de pas.'));
      setError('');
      void onSave(profile).catch(err => setError(err instanceof Error ? err.message : t('Enregistrement impossible.')));
    } catch (err) { setError(err instanceof Error ? t(err.message) : t('Vérifie les informations saisies.')); }
  }}>
    <fieldset disabled={saving} className="nutri-profile-fields">
    <div className="nutrition-card-heading"><div><p className="eyebrow">{t('TON POINT DE DÉPART')}</p><h2>{initial ? t('Modifier mon objectif') : t('Construisons ton objectif')}</h2><p>{t('Quelques informations pour estimer tes besoins quotidiens.')}</p></div></div>
    <fieldset className="nutrition-goals"><legend>{t('Quel est ton objectif ?')}</legend>
      {(['lose', 'maintain', 'gain'] as const).map(option => <label key={option} className={goal === option ? 'selected' : ''}><input type="radio" name="goal" checked={goal === option} onChange={() => setGoal(option)} />{t(option === 'lose' ? 'Perdre du poids' : option === 'gain' ? 'Prendre du muscle' : 'Maintenir mon poids')}</label>)}
    </fieldset>
    <div className="nutrition-form-grid">
      <h3 className="profile-section-heading">{t('Tes caractéristiques')}</h3>
      <label>{t('Poids actuel')} ({weightUnit})<DecimalInput required min={weightUnit === 'lb' ? 55 : 25} max={weightUnit === 'lb' ? 882 : 400} step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} /></label>
      <label>{t('Poids visé')} ({weightUnit})<DecimalInput required min={weightUnit === 'lb' ? 55 : 25} max={weightUnit === 'lb' ? 882 : 400} step="0.1" value={targetKg} onChange={e => setTargetKg(e.target.value)} /></label>
      <label>{t('Âge (années)')}<input type="number" required min="18" max="100" step="1" value={age} onChange={e => setAge(e.target.value)} /></label>
      <label>{t('Taille (cm)')}<input type="number" required min="100" max="250" step="1" value={heightCm} onChange={e => setHeightCm(e.target.value)} /></label>
      <label>{t('Sexe utilisé pour le calcul')}<select required value={equationSex} onChange={e => setEquationSex(e.target.value as EquationSex | '')}><option value="">{t('Choisir une formule')}</option><option value="male">{t('Formule homme')}</option><option value="female">{t('Formule femme')}</option></select></label>
      <h3 className="profile-section-heading">{t('Ton activité')}</h3>
      <label>{t('Activité quotidienne hors sport')}<select required value={dailyActivity} onChange={event=>setDailyActivity(event.target.value as DailyActivity|'')}><option value="">{t('Choisir mon activité')}</option><option value="sedentary">{t('Principalement assis · peu de déplacements')}</option><option value="light">{t('Un peu de marche · activité légère')}</option><option value="moderate">{t('Souvent debout · marche régulière')}</option><option value="high">{t('Travail physique · déplacements fréquents')}</option></select></label>
      <label>{t('Séances par semaine')}<input required type="number" inputMode="numeric" min={0} max={14} step={1} value={sessionsPerWeek} onChange={event=>setSessionsPerWeek(event.target.value)}/></label>
      {Number(sessionsPerWeek)>0 && <>
        <label>{t('Durée moyenne d’une séance (min)')}<input required type="number" inputMode="numeric" min={10} max={180} step={1} value={sessionMinutes} onChange={event=>setSessionMinutes(event.target.value)}/><small>{t('Pauses comprises. Indique ta durée habituelle, pas seulement le temps sous effort.')}</small></label>
        <label>{t('Type d’entraînement habituel')}<select required value={trainingKind} onChange={event=>setTrainingKind(event.target.value as TrainingKind|'')}><option value="">{t('Choisir le type')}</option><option value="strength">{t('Musculation classique · avec pauses')}</option><option value="strengthHard">{t('Force / musculation vigoureuse')}</option><option value="cardio">{t('Cardio modéré')}</option><option value="mixed">{t('Musculation et cardio')}</option></select></label>
      </>}
    </div>
    {initial && !initial.dailyActivity && <p className="nutri-hint">{t('Complète l’activité hors sport, le type et la durée habituelle. Le nombre de séances est prérempli depuis ton ancien profil : vérifie-le.')}</p>}
    {goal!=='maintain' && <fieldset className="nutri-goal-timeline"><legend>{t('Quand souhaites-tu atteindre ce poids ?')}</legend>
      <p>{t('Une durée plus longue propose un ajustement plus léger. Choisis un délai ou une date ; tu peux aussi rester sans échéance.')}</p>
      <div className="nutri-timeline-presets">{[1,2,4,6,8,12].map(months=><button type="button" className="btn btn-secondary" key={months} aria-pressed={goalDate===goalDateInMonths(months)} onClick={()=>setGoalDate(goalDateInMonths(months))}>{monthsLabel(months)}</button>)}</div>
      <label>{t('Date cible (facultative)')}<input type="date" value={goalDate} min={localDate()} max={goalDateInMonths(36)} onChange={event=>setGoalDate(event.target.value)}/></label>
      {goalDate && <button type="button" className="nutri-timeline-clear" onClick={()=>setGoalDate('')}>{t('Sans échéance')}</button>}
      {estimate?.timeline && <div className="nutri-timeline-feedback" role="status">
        {estimate.timeline.expired ? <p className="nutrition-error">{t('Échéance dépassée : actualise la date. Le calcul revient au maintien estimé, sans rattrapage automatique.')}</p> : <>
          <div className="nutri-timeline-metrics"><span>{t('Temps restant')}<strong>{monthsLabel(estimate.timeline.monthsRemaining)}</strong></span><span>{t('Rythme demandé')}<strong>{(estimate.timeline.requestedMonthlyKg*(weightUnit==='lb'?poundsPerKg:1)).toLocaleString(locale(),{maximumFractionDigits:2})} {weightUnit} {t('par mois')}</strong><small>{estimate.timeline.requestedMonthlyPercent.toLocaleString(locale(),{maximumFractionDigits:2})} % {t('du poids par mois')}</small></span><span>{t(goal==='gain'?'Surplus proposé':'Déficit proposé')}<strong>{estimate.adjustment>0?'+':''}{number(estimate.adjustment)} kcal / {t('jour')}</strong></span></div>
          {estimate.timeline.limited && <p className="nutrition-error">{t('Délai ambitieux : l’ajustement proposé est plafonné. Allonge le délai ou revois le poids visé ; ce calcul ne valide pas cette échéance.')}</p>}
        </>}
      </div>}
      <details><summary>{t('Comprendre le lien entre délai et calories')}</summary><p>{t('Le rythme demandé est l’écart de poids divisé par le temps restant. L’application utilise ce rythme pour choisir un ajustement calorique de départ, limité à 10 % du maintien en prise de poids ou 20 % en perte, et à 500 kcal par jour. Le déficit conserve aussi le plancher calorique du calcul. Cette règle simplifiée n’est pas un modèle prédictif du métabolisme.')}</p><p>{t('La date et le rythme expriment ton souhait, pas un résultat garanti. La prise de poids ne correspond pas uniquement au muscle. Réévalue les apports selon la tendance du poids sur plusieurs semaines ; en cas de besoin particulier, demande un avis professionnel.')}</p><p className="nutri-source-note"><a href="https://link.springer.com/article/10.1186/s40798-023-00651-y" target="_blank" rel="noreferrer">{t('Étude sur les surplus caloriques')}</a> · <a href="https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner" target="_blank" rel="noreferrer">NIDDK · Body Weight Planner</a></p></details>
    </fieldset>}
    {estimate && <div className="nutrition-estimate"><span>{t('Maintien estimé')} <strong>{number(estimate.maintenance)} kcal</strong></span><span>{t('Objectif proposé')} <strong>{number(estimate.target)} kcal / {t('jour')}</strong></span></div>}
    <details className="nutrition-override"><summary>{t('Ajuster manuellement l’objectif calorique')}</summary><label>{t('Calories par jour (facultatif)')}<input type="number" min="1200" max="6000" step="10" value={calorieOverride} onChange={e => setCalorieOverride(e.target.value)} /></label></details>
    <p className="nutri-hint">{t('Le maintien combine la formule de Mifflin–St Jeor, l’activité hors sport et la dépense moyenne des séances sur la semaine. Ce sont des approximations : ajuste le profil selon ta routine et observe ton évolution sur plusieurs semaines.')}{calorieOverride && ` ${t('Ton objectif calorique manuel reste prioritaire tant que ce champ est renseigné.')}`} <a href="https://pacompendium.com/conditioning-exercise/" target="_blank" rel="noreferrer">2024 Adult Compendium</a></p>
    <details className="nutrition-override"><summary>{t('Comment mes cibles de macros sont calculées')}</summary>
      {automaticMacros && <div className="nutri-auto-macro-preview">{[{label:'Protéines',value:automaticMacros.protein},{label:'Glucides',value:automaticMacros.carbs},{label:'Lipides',value:automaticMacros.fat}].map(item=><div key={item.label}><span>{t(item.label)}</span><strong>{item.value} g / {t('jour')}</strong></div>)}</div>}
      <p className="nutri-hint">{t('Tes cibles sont estimées automatiquement : protéines selon ton poids, ton objectif et tes entraînements ; lipides selon l’activité et les calories ; glucides avec l’énergie restante. Ton âge, ta taille et la formule choisie interviennent déjà dans le calcul calorique.')}</p>
      <p className="nutri-hint">{t('Méthode de l’application : 1,2 à 2 g de protéines/kg selon le profil, plafonnés à 35 % des calories ; 30 % des calories en lipides pour une activité régulière, 35 % pour 0–1 séance. Les fibres restent un repère général. Ces estimations ne garantissent pas une prise de muscle et ne remplacent pas un suivi personnalisé.')}</p>
      {automaticMacros?.proteinLimited && <p className="nutri-hint">{t('La cible de protéines est limitée par ton budget calorique. Un avis professionnel est préférable si ton profil demande des apports particuliers.')}</p>}
      <p className="nutri-source-note"><a href="https://link.springer.com/article/10.1186/s12970-017-0177-8" target="_blank" rel="noreferrer">ISSN · Protein and exercise</a> · <a href="https://link.springer.com/article/10.1186/s12970-018-0242-y" target="_blank" rel="noreferrer">ISSN · Sports nutrition</a> · <a href="https://www.anses.fr/sites/default/files/NUT2012SA0103Ra-1.pdf" target="_blank" rel="noreferrer">ANSES</a></p>
    </details>
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
  const [recent,setRecent]=useState<FoodHistoryEntry[]>([]);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [savedMeals,setSavedMeals]=useState<SavedMeal[]>([]);
  const [savedMealsLoading,setSavedMealsLoading]=useState(true);
  const [savedMealsError,setSavedMealsError]=useState('');
  const [savedMealsReload,setSavedMealsReload]=useState(0);
  const [savedMealDialog,setSavedMealDialog]=useState<{meal:Meal;initial?:SavedMealDraft}>();
  const [historyLoading,setHistoryLoading]=useState(true);
  const [historyError,setHistoryError]=useState('');
  const [historyReload,setHistoryReload]=useState(0);
  const [loadingProfile,setLoadingProfile]=useState(true);
  const [loadingDay,setLoadingDay]=useState(true);
  const [saving,setSaving]=useState(false);
  const [editingProfile,setEditingProfile]=useState(false);
  const [openWeight,setOpenWeight]=useState(focusWeight);
  const [composer,setComposer]=useState<{meal:Meal;entry?:FoodEntry;initial?:FoodEntry}>();
  const [profileError,setProfileError]=useState('');
  const [dayError,setDayError]=useState('');
  const [reload,setReload]=useState(0);
  const [profileReload,setProfileReload]=useState(0);
  const busy=useRef(false);
  const scope=useRef('');
  const editing=useRef(false);
  const weightEditing=useRef(false);
  scope.current=userId+'|'+date;
  editing.current=!!composer || editingProfile || historyOpen || !!savedMealDialog;
  useEffect(()=>{
    let active=true;setLoadingProfile(true);setProfileError('');
    void loadNutritionProfile(userId).then(result=>{if(active){setProfile(result.profile);setProfileRecord(result.record);}}).catch(error=>{if(active)setProfileError(error.message);}).finally(()=>{if(active)setLoadingProfile(false);});
    return()=>{active=false;};
  },[userId,profileReload]);
  useEffect(()=>{
    let active=true;setRecent([]);setHistoryLoading(true);setHistoryError('');
    void loadRecentFoods(userId).then(value=>{if(active)setRecent(value);}).catch(error=>{if(active)setHistoryError(error.message);}).finally(()=>{if(active)setHistoryLoading(false);});
    return()=>{active=false;};
  },[userId,historyReload]);
  useEffect(()=>{
    let active=true;setSavedMeals([]);setSavedMealsLoading(true);setSavedMealsError('');
    void loadSavedMeals(userId).then(value=>{if(active)setSavedMeals(value);}).catch(error=>{if(active)setSavedMealsError(error.message);}).finally(()=>{if(active)setSavedMealsLoading(false);});
    return()=>{active=false;};
  },[userId,savedMealsReload]);
  useEffect(()=>{
    let active=true;setLoadingDay(true);setDayError('');
    void loadNutritionDay(userId,date).then(result=>{if(active)setDay(result.day);}).catch(error=>{if(active)setDayError(error.message);}).finally(()=>{if(active)setLoadingDay(false);});
    return()=>{active=false;};
  },[userId,date,reload]);
  useEffect(()=>{setComposer(undefined);setHistoryOpen(false);setEditingProfile(false);setSavedMealDialog(undefined);},[userId,date]);
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
      if(scope.current!==owner)throw new Error(t('La journée a changé. Réessaie.'));
      if(scope.current===owner){setDay(next);setRecent(previous=>mergeFoodHistory(previous,next.date,next.entries));}
    }finally{busy.current=false;setSaving(false);}
  };
  const persistSavedMeal=async(next:SavedMeal)=>{
    if(busy.current)throw new Error(t('Un enregistrement est déjà en cours.'));
    const owner=scope.current;busy.current=true;setSaving(true);
    try{
      await saveSavedMeal(userId,next);
      if(scope.current!==owner)throw new Error(t('La journée a changé. Réessaie.'));
      setSavedMeals(previous=>[next,...previous.filter(item=>item.id!==next.id)]);
    }finally{busy.current=false;setSaving(false);}
  };
  const openSavedMeals=(meal:Meal,save=false)=>{
    const items=day.entries.filter(entry=>entry.meal===meal).map(({food,quantity})=>({food:structuredClone(food),quantity}));
    setSavedMealDialog({meal,...(save?{initial:{meal,items}}:{})});
    setSavedMealsReload(value=>value+1);
  };
  if(loadingProfile)return <div className="loading-panel" role="status"><span className="loading-spinner"/>{t('Chargement de ton journal nutrition…')}</div>;
  if(profileError)return <div className="nutrition-error" role="alert">{profileError}<button className="btn btn-secondary" onClick={()=>setProfileReload(value=>value+1)}>{t('Réessayer')}</button></div>;
  if(!profile || editingProfile)return <section className="nutrition-page"><PageHeading eyebrow="Nutrition" title="Mon profil nutrition" description="Tes repères, adaptés à ton quotidien."/><ProfileForm initial={profile} saving={saving} onSave={persistProfile} onCancel={profile?()=>setEditingProfile(false):undefined}/></section>;
  return <>
    <NutritionDiary profile={profile} day={day} date={date} busy={saving} loading={loadingDay} error={dayError} focusWeight={openWeight}
      onHistory={()=>setHistoryOpen(true)}
      onSavedMeals={meal=>openSavedMeals(meal)} onSaveMeal={meal=>openSavedMeals(meal,true)}
      onDate={next=>{if(!busy.current){setOpenWeight(false);setDate(next);}}} onProfile={()=>setEditingProfile(true)} onAdd={meal=>setComposer({meal})} onEdit={entry=>setComposer({meal:entry.meal,entry})}
      onRemove={entry=>{if(confirm(t('Retirer cet aliment du journal ?')))void persistDay(latest=>({...latest,entries:latest.entries.filter(item=>item.id!==entry.id)})).catch(error=>setDayError(error.message));}}
      onSteps={count=>persistDay(latest=>({...latest,steps:{count,source:'manual',updatedAt:new Date().toISOString()}}))}
      onWater={waterMl=>persistDay(latest=>({...latest,waterMl}))}
      onWeight={weightKg=>persistDay(latest=>({...latest,weightKg}))}
      onWeightEditingChange={active=>{weightEditing.current=active;}}
      onRefresh={()=>setReload(value=>value+1)}/>
    {historyOpen && <NutritionFoodHistory entries={recent} loading={historyLoading} error={historyError} onRetry={()=>setHistoryReload(value=>value+1)} onClose={()=>setHistoryOpen(false)} onSelect={(entry,meal)=>{setHistoryOpen(false);setComposer({meal,initial:entry});}}/>}
    {savedMealDialog && <NutritionSavedMeals meals={savedMeals} meal={savedMealDialog.meal} initial={savedMealDialog.initial} loading={savedMealsLoading} error={savedMealsError} onRetry={()=>setSavedMealsReload(value=>value+1)} onSave={persistSavedMeal} onAdd={entries=>persistDay(latest=>appendMealEntries(latest,entries))} onClose={()=>setSavedMealDialog(undefined)}/>}
    {composer && <FoodComposer key={composer.entry?.id ?? composer.initial?.id ?? composer.meal} meal={composer.meal} existing={composer.entry} initial={composer.initial} recent={recent}
      onSave={entry=>persistDay(latest=>({...latest,entries:[...latest.entries.filter(item=>item.id!==entry.id),entry]}))}
      onClose={()=>setComposer(undefined)} renderScanner={(onCode,onError)=><Suspense fallback={<p role="status">{t('Chargement de la caméra…')}</p>}><Scanner onCode={onCode} onError={onError}/></Suspense>}/>}
  </>;
}
