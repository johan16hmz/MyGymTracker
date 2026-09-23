import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { useEffect, useRef, useState } from 'react';
import { locale, t, useLanguage, useWeightUnit } from '../i18n';
import { estimateCalories, foodTotals, localDate, sumEntries } from '../nutrition';
import type { ActivityLevel, EquationSex, Food, FoodEntry, Meal, NutritionDay, NutritionGoal, NutritionProfile } from '../nutrition';
import { lookupFood } from '../nutritionFood';
import { foodCodeFromScan } from '../nutritionScan';
import { loadNutritionDay, loadNutritionProfile, saveNutritionDay, saveNutritionProfile } from '../nutritionService';
import type { Workout } from '../types';
import { Icon } from './Icon';

const meals: Meal[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const mealNames: Record<Meal, string> = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', snack: 'En-cas', dinner: 'Dîner' };
const round = (value: number) => Math.round(value * 10) / 10;
const number = (value: number) => Math.round(value).toLocaleString(locale());
const poundsPerKg = 2.2046226218;

function ProfileForm({ initial, onSave, onCancel, saving }: {
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
  const [error, setError] = useState('');
  useEffect(() => {
    if (previousUnit.current === weightUnit) return;
    const factor = weightUnit === 'lb' ? poundsPerKg : 1 / poundsPerKg;
    setWeightKg(value => value ? String(round(Number(value) * factor)) : '');
    setTargetKg(value => value ? String(round(Number(value) * factor)) : '');
    previousUnit.current = weightUnit;
  }, [weightUnit]);
  const profile: NutritionProfile = { goal, weightKg: Number(weightKg) / (weightUnit === 'lb' ? poundsPerKg : 1), targetKg: Number(targetKg) / (weightUnit === 'lb' ? poundsPerKg : 1), age: Number(age), heightCm: Number(heightCm), equationSex: equationSex as EquationSex, activity, ...(calorieOverride ? { calorieOverride: Number(calorieOverride) } : {}) };
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
      setError('');
      void onSave(profile).catch(err => setError(err instanceof Error ? err.message : t('Enregistrement impossible.')));
    } catch (err) { setError(err instanceof Error ? t(err.message) : t('Vérifie les informations saisies.')); }
  }}>
    <div className="nutrition-card-heading"><div><p className="eyebrow">{t('TON POINT DE DÉPART')}</p><h2>{initial ? t('Modifier mon objectif') : t('Construisons ton objectif')}</h2><p>{t('Quelques informations pour estimer tes besoins quotidiens.')}</p></div><span className="nutrition-badge">01 / 02</span></div>
    <fieldset className="nutrition-goals"><legend>{t('Quel est ton objectif ?')}</legend>
      {(['lose', 'maintain', 'gain'] as const).map(option => <label key={option} className={goal === option ? 'selected' : ''}><input type="radio" name="goal" checked={goal === option} onChange={() => setGoal(option)} />{t(option === 'lose' ? 'Perdre du poids' : option === 'gain' ? 'Prendre du poids' : 'Maintenir mon poids')}</label>)}
    </fieldset>
    <div className="nutrition-form-grid">
      <label>{t('Poids actuel')} ({weightUnit})<input type="number" required min={weightUnit === 'lb' ? 55 : 25} max={weightUnit === 'lb' ? 882 : 400} step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} /></label>
      <label>{t('Poids visé')} ({weightUnit})<input type="number" required min={weightUnit === 'lb' ? 55 : 25} max={weightUnit === 'lb' ? 882 : 400} step="0.1" value={targetKg} onChange={e => setTargetKg(e.target.value)} /></label>
      <label>{t('Âge (années)')}<input type="number" required min="18" max="100" step="1" value={age} onChange={e => setAge(e.target.value)} /></label>
      <label>{t('Taille (cm)')}<input type="number" required min="100" max="250" step="1" value={heightCm} onChange={e => setHeightCm(e.target.value)} /></label>
      <label>{t('Équation de calcul')}<select required value={equationSex} onChange={e => setEquationSex(e.target.value as EquationSex | '')}><option value="">{t('Choisir une formule')}</option><option value="male">{t('Formule homme')}</option><option value="female">{t('Formule femme')}</option></select></label>
      <label>{t('Entraînements par semaine')}<select value={activity} onChange={e => setActivity(e.target.value as ActivityLevel)}><option value="low">{t('0–1 séance')}</option><option value="moderate">{t('2–3 séances')}</option><option value="active">{t('4–5 séances')}</option><option value="veryActive">{t('6 séances ou plus')}</option></select></label>
    </div>
    {estimate && <div className="nutrition-estimate"><span>{t('Maintien estimé')} <strong>{number(estimate.maintenance)} kcal</strong></span><span>{t('Objectif proposé')} <strong>{number(estimate.target)} kcal / {t('jour')}</strong></span></div>}
    <details className="nutrition-override"><summary>{t('Ajuster manuellement l’objectif calorique')}</summary><label>{t('Calories par jour (facultatif)')}<input type="number" min="1200" max="6000" step="10" value={calorieOverride} onChange={e => setCalorieOverride(e.target.value)} /></label></details>
    <p className="nutrition-disclaimer">{t('Estimation pour adultes : équation de Mifflin–St Jeor et facteur d’activité approximatif. Adapte-la selon ton évolution et tes besoins ; ce n’est pas un avis médical.')} <a href="https://pubmed.ncbi.nlm.nih.gov/2305711/" target="_blank" rel="noreferrer">{t('Source du calcul')}</a></p>
    {error && <p className="nutrition-error" role="alert">{error}</p>}
    <div className="nutrition-actions"><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('Enregistrement…') : t('Enregistrer mon objectif')}</button>{onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel}>{t('Annuler')}</button>}</div>
  </form>;
}

function Scanner({ onCode, onError }: { onCode: (code: string) => void; onError: (message: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const callbackRef = useRef({ onCode, onError });
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const controlsRef = useRef<IScannerControls | undefined>(undefined);
  callbackRef.current = { onCode, onError };
  useEffect(() => {
    let stopped = false;
    let nativeTimer: ReturnType<typeof setInterval> | undefined;
    let lastUnusableValue = '';
    const hints = new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128]],
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 300, delayBetweenScanSuccess: 350 });
    const video = videoRef.current;
    if (!video) return;

    const handleValue = (raw: string) => {
      if (stopped) return;
      const code = foodCodeFromScan(raw);
      if (!code) {
        if (raw !== lastUnusableValue) {
          lastUnusableValue = raw;
          setScanMessage(t('QR lu, mais aucun code produit reconnu. Essaie le code-barres EAN sur l’emballage.'));
        }
        return;
      }
      stopped = true;
      if (nativeTimer) clearInterval(nativeTimer);
      controlsRef.current?.stop();
      callbackRef.current.onCode(code);
    };

    const onResult = (result: { getText(): string } | undefined) => {
      if (result) handleValue(result.getText());
    };

    const start = async () => {
      try {
        // Prefer the rear camera and a detailed frame for small food labels.
        const controls = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }, video, onResult);
        if (stopped) { controls.stop(); return; }
        controlsRef.current = controls;
      } catch {
        if (stopped) return;
        try {
          const controls = await reader.decodeFromVideoDevice(undefined, video, onResult);
          if (stopped) { controls.stop(); return; }
          controlsRef.current = controls;
        } catch {
          if (!stopped) callbackRef.current.onError(t('Caméra indisponible. Autorise son accès ou saisis le code-barres.'));
          return;
        }
      }

      setTorchAvailable(Boolean(controlsRef.current?.switchTorch));

      // Browser-native decoding is especially helpful for QR codes on supported phones.
      type NativeDetector = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>> };
      type NativeDetectorClass = {
        new(options: { formats: string[] }): NativeDetector;
        getSupportedFormats(): Promise<string[]>;
      };
      const Detector = (window as Window & { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector;
      if (!Detector) return;
      try {
        const supported = await Detector.getSupportedFormats();
        if (stopped) return;
        const formats = ['qr_code', 'data_matrix', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'].filter(format => supported.includes(format));
        if (!formats.length) return;
        const detector = new Detector({ formats });
        let detecting = false;
        nativeTimer = setInterval(() => {
          if (stopped || detecting || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          detecting = true;
          void detector.detect(video).then(results => {
            for (const result of results) { handleValue(result.rawValue); if (stopped) break; }
          }).catch(() => { /* ZXing continues scanning if native detection fails. */ }).finally(() => { detecting = false; });
        }, 350);
      } catch { /* Native API is optional; ZXing remains active. */ }
    };

    void start();
    return () => {
      stopped = true;
      if (nativeTimer) clearInterval(nativeTimer);
      controlsRef.current?.stop();
      controlsRef.current = undefined;
    };
  }, []);
  return <div className="nutrition-scanner"><div className="nutrition-scanner-preview"><video ref={videoRef} autoPlay muted playsInline aria-label={t('Aperçu de la caméra')} /><span>{t('Place le QR ou le code-barres dans le cadre')}</span></div>{torchAvailable && <button type="button" className="btn btn-secondary nutrition-torch" onClick={() => {
    const next = !torchOn;
    void controlsRef.current?.switchTorch?.(next).then(() => setTorchOn(next)).catch(() => setScanMessage(t('Lampe indisponible sur cet appareil.')));
  }}>{torchOn ? t('Éteindre la lampe') : t('Allumer la lampe')}</button>}{scanMessage && <p className="nutrition-scan-message" role="status">{scanMessage}</p>}</div>;
}

function FoodComposer({ meal, existing, onSave, onClose }: {
  meal: Meal;
  existing?: FoodEntry;
  onSave: (entry: FoodEntry) => Promise<void>;
  onClose: () => void;
}) {
  useLanguage();
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState(existing?.food.name ?? '');
  const [brand, setBrand] = useState(existing?.food.brand ?? '');
  const [quantity, setQuantity] = useState(existing?.quantity.toString() ?? '100');
  const [unit, setUnit] = useState<'g' | 'ml'>(existing?.food.unit ?? 'g');
  const [kcal, setKcal] = useState(existing?.food.kcal100.toString() ?? '');
  const [protein, setProtein] = useState(existing?.food.protein100.toString() ?? '');
  const [carbs, setCarbs] = useState(existing?.food.carbs100.toString() ?? '');
  const [fat, setFat] = useState(existing?.food.fat100.toString() ?? '');
  const [source, setSource] = useState<Food['source']>(existing?.food.source ?? 'manual');
  const [foodBarcode, setFoodBarcode] = useState(existing?.food.barcode);

  const search = async (code: string) => {
    setScanning(false); setLookupBusy(true); setError('');
    try {
      const found = await lookupFood(code);
      setName(found.name); setBrand(found.brand ?? ''); setUnit(found.unit);
      setKcal(found.kcal100?.toString() ?? ''); setProtein(found.protein100?.toString() ?? '');
      setCarbs(found.carbs100?.toString() ?? ''); setFat(found.fat100?.toString() ?? '');
      setFoodBarcode(found.barcode ?? code); setSource('openfoodfacts');
    } catch (err) { setError(err instanceof Error ? t(err.message) : t('Recherche indisponible.')); }
    finally { setLookupBusy(false); }
  };

  return <div className="nutrition-modal-backdrop" onClick={onClose}><section className="nutrition-modal" role="dialog" aria-modal="true" aria-labelledby="food-title" onClick={event => event.stopPropagation()}>
    <div className="nutrition-modal-header"><div><p className="eyebrow">{t(mealNames[meal])}</p><h2 id="food-title">{existing ? t('Modifier un aliment') : t('Ajouter un aliment')}</h2></div><button className="btn btn-icon" type="button" onClick={onClose} aria-label={t('Fermer')}>×</button></div>
    <div className="nutrition-lookup"><label>{t('Code-barres du produit')}<div className="nutrition-barcode-row"><input inputMode="numeric" autoComplete="off" placeholder="EAN / UPC" value={barcode} onChange={e => setBarcode(e.target.value.replace(/\D/g, ''))} /><button className="btn btn-secondary" type="button" disabled={lookupBusy || !/^\d{8,14}$/.test(barcode)} onClick={() => void search(barcode)}>{lookupBusy ? t('Recherche…') : t('Rechercher')}</button></div></label><button className="btn btn-secondary" type="button" onClick={() => { setError(''); setScanning(!scanning); }}>{scanning ? t('Arrêter la caméra') : t('Scanner avec la caméra')}</button></div>
    {scanning && <Scanner onCode={code => { setBarcode(code); void search(code); }} onError={setError} />}
    <p className="nutrition-helper">{t('Tu peux aussi saisir un aliment et ses valeurs nutritionnelles manuellement.')}</p>
    <form onSubmit={event => {
      event.preventDefault();
      const values = [quantity, kcal, protein, carbs, fat].map(Number);
      if (!name.trim() || values.some(value => !Number.isFinite(value) || value < 0) || values[0] <= 0) { setError(t('Vérifie le nom, la quantité et les valeurs nutritionnelles.')); return; }
      const food: Food = { name: name.trim(), brand: brand.trim() || undefined, barcode: foodBarcode, source, unit, kcal100: values[1], protein100: values[2], carbs100: values[3], fat100: values[4] };
      const entry: FoodEntry = { id: existing?.id ?? crypto.randomUUID(), meal, food, quantity: values[0], addedAt: existing?.addedAt ?? new Date().toISOString() };
      setSaving(true); setError('');
      void onSave(entry).then(onClose).catch(err => setError(err instanceof Error ? err.message : t('Enregistrement impossible.'))).finally(() => setSaving(false));
    }}>
      <div className="nutrition-form-grid"><label className="nutrition-name">{t('Nom de l’aliment')}<input required maxLength={150} value={name} onChange={e => setName(e.target.value)} placeholder={t('Ex. yaourt nature')} /></label><label>{t('Marque (facultatif)')}<input maxLength={100} value={brand} onChange={e => setBrand(e.target.value)} /></label></div>
      <div className="nutrition-form-grid nutrition-quantity"><label>{t('Quantité consommée')}<input type="number" required min="0.1" max="10000" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /></label><label>{t('Unité')}<select value={unit} onChange={e => setUnit(e.target.value as 'g' | 'ml')}><option value="g">g</option><option value="ml">ml</option></select></label></div>
      <p className="nutrition-form-caption">{t('Valeurs pour 100 g ou 100 ml')}</p>
      <div className="nutrition-form-grid nutrition-macro-inputs"><label>{t('Calories (kcal)')}<input type="number" required min="0" step="any" value={kcal} onChange={e => setKcal(e.target.value)} /></label><label>{t('Protéines (g)')}<input type="number" required min="0" step="any" value={protein} onChange={e => setProtein(e.target.value)} /></label><label>{t('Glucides (g)')}<input type="number" required min="0" step="any" value={carbs} onChange={e => setCarbs(e.target.value)} /></label><label>{t('Lipides (g)')}<input type="number" required min="0" step="any" value={fat} onChange={e => setFat(e.target.value)} /></label></div>
      {source === 'openfoodfacts' && <p className="nutrition-attribution">{t('Données issues d’')}<a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer">Open Food Facts</a> · {t('Vérifie toujours l’étiquette du produit.')}</p>}
      {error && <p className="nutrition-error" role="alert">{error}</p>}
      <div className="nutrition-actions"><button className="btn btn-primary" type="submit" disabled={saving}>{saving ? t('Enregistrement…') : t('Ajouter au journal')}</button><button className="btn btn-secondary" type="button" onClick={onClose}>{t('Annuler')}</button></div>
    </form>
  </section></div>;
}

export function Nutrition({ userId }: { userId: string }) {
  useLanguage();
  const weightUnit = useWeightUnit();
  const [profile, setProfile] = useState<NutritionProfile>();
  const [profileRecord, setProfileRecord] = useState<Workout>();
  const [dayRecord, setDayRecord] = useState<Workout>();
  const [date, setDate] = useState(localDate());
  const [day, setDay] = useState<NutritionDay>({ date: localDate(), entries: [] });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingDay, setLoadingDay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [composer, setComposer] = useState<{ meal: Meal; entry?: FoodEntry }>();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void loadNutritionProfile(userId).then(result => { if (active) { setProfile(result.profile); setProfileRecord(result.record); } }).catch(err => { if (active) setError(err instanceof Error ? err.message : t('Chargement impossible.')); }).finally(() => { if (active) setLoadingProfile(false); });
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    let active = true;
    setLoadingDay(true); setError('');
    void loadNutritionDay(userId, date).then(result => { if (active) { setDay(result.day); setDayRecord(result.record); } }).catch(err => { if (active) setError(err instanceof Error ? err.message : t('Chargement impossible.')); }).finally(() => { if (active) setLoadingDay(false); });
    return () => { active = false; };
  }, [userId, date]);

  const persistProfile = async (next: NutritionProfile) => {
    setSaving(true); setError('');
    try { const saved = await saveNutritionProfile(userId, next, profileRecord); setProfile(next); setProfileRecord(saved); setEditingProfile(false); }
    finally { setSaving(false); }
  };
  const persistDay = async (next: NutritionDay) => {
    setSaving(true); setError('');
    try { const saved = await saveNutritionDay(userId, next, dayRecord); setDay(next); setDayRecord(saved); }
    finally { setSaving(false); }
  };
  const saveEntry = async (entry: FoodEntry) => persistDay({ ...day, entries: [...day.entries.filter(item => item.id !== entry.id), entry] });
  const removeEntry = async (entry: FoodEntry) => {
    if (!confirm(t('Retirer cet aliment du journal ?'))) return;
    try { await persistDay({ ...day, entries: day.entries.filter(item => item.id !== entry.id) }); }
    catch (err) { setError(err instanceof Error ? err.message : t('Suppression impossible.')); }
  };
  const shiftDate = (days: number) => {
    const value = new Date(`${date}T12:00:00`);
    value.setDate(value.getDate() + days);
    setDate(localDate(value));
  };

  if (loadingProfile) return <div className="loading-panel" role="status"><span className="loading-spinner" />{t('Chargement de ton journal nutrition…')}</div>;
  if (!profile || editingProfile) return <section className="nutrition-page"><div className="nutrition-page-header"><p className="eyebrow">NUTRITION</p><h1>{t('Mange avec intention.')}</h1><p>{t('Ton objectif, tes repas, ta progression.')}</p></div><ProfileForm initial={profile} saving={saving} onSave={persistProfile} onCancel={profile ? () => setEditingProfile(false) : undefined} />{error && <p className="nutrition-error" role="alert">{error}</p>}</section>;

  const estimate = estimateCalories(profile);
  const calorieGoal = profile.calorieOverride ?? estimate.target;
  const totals = sumEntries(day.entries);
  const remaining = Math.round(calorieGoal - totals.kcal);
  const progress = Math.min(100, Math.round(totals.kcal / calorieGoal * 100));
  const prettyDate = new Date(`${date}T12:00:00`).toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' });

  return <section className="nutrition-page">
    <div className="nutrition-page-header"><div><p className="eyebrow">NUTRITION · {t('TON JOURNAL')}</p><h1>{t('Ton assiette, ton rythme.')}</h1><p>{t('Suis tes repas et avance vers ton objectif, un jour à la fois.')}</p><p>{t('Poids visé')} : {round(profile.targetKg * (weightUnit === 'lb' ? poundsPerKg : 1))} {weightUnit}</p></div><button className="btn btn-secondary" onClick={() => setEditingProfile(true)}><Icon name="settings" size={17} />{t('Mon objectif')}</button></div>
    <div className="nutrition-datebar"><button type="button" aria-label={t('Jour précédent')} disabled={saving} onClick={() => shiftDate(-1)}>‹</button><div><span>{date === localDate() ? t('Aujourd’hui') : t('Journal du jour')}</span><strong>{prettyDate}</strong></div><button type="button" aria-label={t('Jour suivant')} disabled={saving} onClick={() => shiftDate(1)}>›</button><input type="date" aria-label={t('Choisir une date')} disabled={saving} value={date} onChange={e => setDate(e.target.value)} /></div>
    {error && <p className="nutrition-error" role="alert">{error}</p>}
    {loadingDay ? <div className="loading-panel" role="status"><span className="loading-spinner" />{t('Chargement de la journée…')}</div> : <>
      <div className="nutrition-summary nutrition-card"><div className="nutrition-ring" style={{ background: `conic-gradient(var(--primary) ${progress}%, var(--border) ${progress}% 100%)` }}><div><strong>{number(totals.kcal)}</strong><span>kcal {t('consommées')}</span></div></div><div className="nutrition-summary-main"><span className="nutrition-kicker">{t('OBJECTIF DU JOUR')}</span><h2>{number(calorieGoal)} <small>kcal</small></h2><p>{remaining >= 0 ? `${number(remaining)} kcal ${t('restantes')}` : `${number(-remaining)} kcal ${t('au-dessus de l’objectif')}`}</p><div className="nutrition-progress"><span style={{ width: `${progress}%` }} /></div><small>{t('Objectif estimé à partir de ton profil. Tu peux l’ajuster dans « Mon objectif ».')}</small></div></div>
      <div className="nutrition-macros"><div><span>{t('Protéines')}</span><strong>{round(totals.protein)} g</strong></div><div><span>{t('Glucides')}</span><strong>{round(totals.carbs)} g</strong></div><div><span>{t('Lipides')}</span><strong>{round(totals.fat)} g</strong></div></div>
      <div className="nutrition-meal-grid">{meals.map(meal => {
        const entries = day.entries.filter(entry => entry.meal === meal);
        const mealTotal = sumEntries(entries);
        return <section className="nutrition-meal nutrition-card" key={meal}><div className="nutrition-meal-header"><div><span className="nutrition-meal-icon"><Icon name="nutrition" size={19} /></span><div><h2>{t(mealNames[meal])}</h2><span>{number(mealTotal.kcal)} kcal · {entries.length} {t(entries.length === 1 ? 'aliment' : 'aliments')}</span></div></div><button className="btn btn-icon" type="button" onClick={() => setComposer({ meal })} aria-label={`${t('Ajouter un aliment')} · ${t(mealNames[meal])}`}><Icon name="plus" size={18} /></button></div>
          {entries.length ? <div className="nutrition-entry-list">{entries.map(entry => {
            const amount = foodTotals(entry.food, entry.quantity);
            return <div className="nutrition-entry" key={entry.id}><div><strong>{entry.food.name}</strong><small>{entry.food.brand && `${entry.food.brand} · `}{round(entry.quantity)} {entry.food.unit} · P {round(amount.protein)} / G {round(amount.carbs)} / L {round(amount.fat)} g</small></div><strong>{number(amount.kcal)} kcal</strong><div className="nutrition-entry-actions"><button type="button" aria-label={`${t('Modifier')} ${entry.food.name}`} onClick={() => setComposer({ meal, entry })}><Icon name="edit" size={15} /></button><button type="button" aria-label={`${t('Supprimer')} ${entry.food.name}`} disabled={saving} onClick={() => void removeEntry(entry)}><Icon name="trash" size={15} /></button></div></div>;
          })}</div> : <p className="nutrition-empty">{t('Aucun aliment ajouté pour ce repas.')}</p>}
          <button className="nutrition-add" type="button" onClick={() => setComposer({ meal })}><Icon name="plus" size={17} />{t('Ajouter un aliment')}</button>
        </section>;
      })}</div>
      <p className="nutrition-disclaimer nutrition-footer">{t('Les valeurs des produits proviennent d’')}<a href="https://world.openfoodfacts.org/" target="_blank" rel="noreferrer">Open Food Facts</a>. {t('Vérifie l’étiquette et ajuste les quantités si besoin.')}</p>
    </>}
    {composer && <FoodComposer key={composer.entry?.id ?? composer.meal} meal={composer.meal} existing={composer.entry} onSave={saveEntry} onClose={() => setComposer(undefined)} />}
  </section>;
}
