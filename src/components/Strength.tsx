import { t, useLanguage, locale, useWeightUnit } from '../i18n';
import type { WeightUnit } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import type { Workout } from '../types';
import { createStrengthBlock, DEFAULT_SET_REDUCTION_PERCENT, DEFAULT_STRENGTH_SETS, DEFAULT_STRENGTH_EXERCISES, getCurrentStrengthBlockIndex, getStrengthWeeks, MAX_BLOCK_WEEKS, MAX_STRENGTH_SETS, nextCurrentStrengthRank, planStrengthLoads, RPE_TABLE, STRENGTH_EXERCISES, strengthVolumeFactor, updateStrengthLoads, updateStrengthSets, WEEK_RPES } from '../strength';
import type { StrengthBlock, StrengthExercise, StrengthExerciseId, StrengthPrescription, StrengthPerformance, StrengthSetsByReps } from '../strength';
import { getStrengthBlock, saveStrengthBlock } from '../strengthService';
import { convertWeightInput, parseDecimalInput, toDisplayWeight, toStoredWeight } from '../weightUnits';

interface Props {
  userId: string;
  workouts: Workout[];
  onSaved: (workout: Workout) => void;
  onPendingChange: (pending: boolean) => void;
}

const n = (value: number) => value.toLocaleString(locale());
const weightText = (kg: number, unit: WeightUnit) => `${n(toDisplayWeight(kg, unit))} ${unit}`;
const emptyTargets = (): Record<string, string> => Object.fromEntries(STRENGTH_EXERCISES.map(ex => [ex.id, '0']));
const decimalPattern = '(?:[0-9]+(?:[.,][0-9]+)?|[.,][0-9]+)';
const alignedToStep = (value: number, step: number) => Math.abs(value / step - Math.round(value / step)) < 1e-8;

function StrengthSummaryTable({ block, caption, unit }: { block: StrengthBlock; caption: string; unit: WeightUnit }) {
  const weeks = getStrengthWeeks(block);
  return <div className="force-table-scroll force-preview"><table>
    <caption>{caption} ({unit})</caption>
    <thead><tr><th scope="col">{t("Exercice")}</th>{weeks.map(week => <th key={week} scope="col">{t("Sem.")} {week}<small>RPE {n(block.exercises.flatMap(ex => ex.prescriptions).find(row => row.week === week)?.rpe ?? 0)}</small></th>)}</tr></thead>
    <tbody>{block.exercises.flatMap(ex => [5, 3].map(reps => <tr key={`${ex.id}-${reps}`}><th scope="row">{t(ex.name)} ×{reps}</th>{weeks.map(week => {
      const row = ex.prescriptions.find(item => item.week === week && item.reps === reps);
      return <td key={week}>{row ? <>{n(toDisplayWeight(row.weight, unit))}<small>{row.sets ?? DEFAULT_STRENGTH_SETS} × {row.reps}</small></> : '—'}</td>;
    })}</tr>))}</tbody>
  </table></div>;
}

function PerformanceForm({ prescription, onAdd }: {
  prescription: StrengthPrescription;
  onAdd: (performance: StrengthPerformance) => void;
}) {
  useLanguage();
  const weightUnit = useWeightUnit();
  const [open, setOpen] = useState(false);
  const [inputUnit, setInputUnit] = useState(weightUnit);
  const [weightInput, setWeightInput] = useState(String(toDisplayWeight(prescription.weight, weightUnit)));
  const [rpeInput, setRpeInput] = useState(String(prescription.rpe));
  const parsedWeight = parseDecimalInput(weightInput);
  const parsedRpe = parseDecimalInput(rpeInput);
  const validWeight = Number.isFinite(parsedWeight) && parsedWeight >= 0;
  const validRpe = Number.isFinite(parsedRpe) && parsedRpe >= 1 && parsedRpe <= 10 && alignedToStep(parsedRpe, 0.5);
  useEffect(() => {
    if (weightUnit === inputUnit) return;
    setWeightInput(value => convertWeightInput(value, inputUnit, weightUnit));
    setInputUnit(weightUnit);
  }, [weightUnit, inputUnit]);
  return <>
    <button type="button" className="btn btn-secondary btn-small" onClick={() => setOpen(!open)}>
      {open ? t("Annuler la saisie") : t("+ Enregistrer une série")}
    </button>
    {open && <form className="force-performance" onSubmit={event => {
      event.preventDefault();
      if (!validWeight || !validRpe) return;
      const values = new FormData(event.currentTarget);
      onAdd({ weight: toStoredWeight(parsedWeight, inputUnit), reps: Number(values.get('reps')), rpe: parsedRpe, note: String(values.get('note')), date: new Date().toISOString() });
      setWeightInput(String(toDisplayWeight(prescription.weight, inputUnit)));
      setOpen(false);
    }}>
      <label>{t("Poids réalisé")} ({inputUnit})<input name="weight" type="text" inputMode="decimal" pattern={decimalPattern} value={weightInput} onChange={event => setWeightInput(event.target.value)} required /></label>
      <label>{t("Reps réalisées")}<input name="reps" type="number" min="1" step="1" defaultValue={prescription.reps} required /></label>
      <label>{t("RPE ressenti")}<input name="rpe" type="text" inputMode="decimal" pattern={decimalPattern} value={rpeInput} onChange={event => setRpeInput(event.target.value)} required /></label>
      <label className="force-note">Note<input name="note" placeholder={t("Ex. : dur, propre, marge…")} maxLength={500} /></label>
      <button className="btn btn-primary" type="submit" disabled={!validWeight || !validRpe}>{t("Ajouter au bloc")}</button>
    </form>}
  </>;
}

function StrengthLoadEditor({ exercise, bodyWeight, saving, onApply }: {
  exercise: StrengthExercise;
  bodyWeight?: number;
  saving: boolean;
  onApply: (target: number, bodyWeight?: number, setReductionPercent?: number) => void;
}) {
  useLanguage();
  const weightUnit = useWeightUnit();
  const [inputUnit, setInputUnit] = useState(weightUnit);
  const [target, setTarget] = useState(String(toDisplayWeight(exercise.target, weightUnit)));
  const [bodyWeightInput, setBodyWeightInput] = useState(bodyWeight === undefined ? '' : String(toDisplayWeight(bodyWeight, weightUnit)));
  const [reductionInput, setReductionInput] = useState(String(exercise.setReductionPercent ?? DEFAULT_SET_REDUCTION_PERCENT));
  useEffect(() => {
    if (weightUnit === inputUnit) return;
    setTarget(value => convertWeightInput(value, inputUnit, weightUnit));
    setBodyWeightInput(value => convertWeightInput(value, inputUnit, weightUnit));
    setInputUnit(weightUnit);
  }, [weightUnit, inputUnit]);
  const recalculated = planStrengthLoads(exercise, bodyWeight ?? 0);
  const parsedTarget = parseDecimalInput(target);
  const parsedBodyWeight = parseDecimalInput(bodyWeightInput);
  const reductionPercent = parseDecimalInput(reductionInput);
  const validInputs = Number.isFinite(reductionPercent) && reductionPercent >= 0 && reductionPercent <= 5 && Number.isFinite(parsedTarget) && parsedTarget >= (exercise.weighted ? 0 : toDisplayWeight(exercise.step, inputUnit)) && (!exercise.weighted || (Number.isFinite(parsedBodyWeight) && parsedBodyWeight >= toDisplayWeight(1, inputUnit)));
  const changed = reductionPercent !== (exercise.setReductionPercent ?? DEFAULT_SET_REDUCTION_PERCENT) || parsedTarget !== toDisplayWeight(exercise.target, inputUnit) || (exercise.weighted && parsedBodyWeight !== (bodyWeight === undefined ? undefined : toDisplayWeight(bodyWeight, inputUnit))) || recalculated.some((row, index) => row.weight !== exercise.prescriptions[index].weight);
  return <form className="force-load-editor" onSubmit={event => {
    event.preventDefault();
    if (!changed || !validInputs) return;
    onApply(toStoredWeight(parsedTarget, inputUnit), exercise.weighted ? toStoredWeight(parsedBodyWeight, inputUnit) : undefined, reductionPercent);
  }}>
    <label>{t("1RM visé")} ({exercise.weighted ? t("lest ajouté") : t("charge totale")}, {inputUnit})
      <input type="text" inputMode="decimal" pattern={decimalPattern} required disabled={saving} value={target} onChange={event => setTarget(event.target.value)} />
    </label>
    {exercise.weighted && <label>{t("Poids du corps")} ({inputUnit})
      <input type="text" inputMode="decimal" pattern={decimalPattern} required disabled={saving} value={bodyWeightInput} onChange={event => setBodyWeightInput(event.target.value)} />
    </label>}
    <label>{t("Réduction par série au-delà de 3 (%)")}
      <input type="text" inputMode="decimal" pattern={decimalPattern} required disabled={saving} value={reductionInput} onChange={event => setReductionInput(event.target.value)} />
      <small>{t("Réglable de 0 à 5 % selon ton ressenti.")}</small>
    </label>
    <button className="btn btn-secondary btn-small" type="submit" disabled={!changed || !validInputs || saving}>{t("Recalculer les charges")}</button>
    <small>{exercise.weighted ? t("Le poids du corps est commun aux dips, tractions et muscle-ups. Les charges prévues sont recalculées ; les performances enregistrées restent intactes.") : t("Les charges prévues de cet exercice sont recalculées ; les performances enregistrées restent intactes.")}</small>
  </form>;
}

export function Strength({ userId, workouts, onSaved, onPendingChange }: Props) {
  useLanguage();
  const weightUnit = useWeightUnit();
  const records = workouts.filter(workout => getStrengthBlock(workout));
  const recordBlocks = records.map(record => getStrengthBlock(record)!);
  const currentIndex = getCurrentStrengthBlockIndex(recordBlocks);
  const currentRecord = records[currentIndex];
  const currentRank = recordBlocks[currentIndex]?.currentRank ?? 0;
  const hasCurrentChoice = Number.isSafeInteger(currentRank) && currentRank > 0;
  const [selected, setSelected] = useState<Workout | undefined>(currentRecord);
  const [block, setBlock] = useState<StrengthBlock | undefined>(() => currentRecord && getStrengthBlock(currentRecord));
  const [creating, setCreating] = useState(!records.length);
  const [exerciseId, setExerciseId] = useState('pullup');
  const [activeWeek, setActiveWeek] = useState(1);
  const [targets, setTargets] = useState<Record<string, string>>(emptyTargets);
  const [entryUnit, setEntryUnit] = useState(weightUnit);
  const [exerciseIds, setExerciseIds] = useState<StrengthExerciseId[]>([...DEFAULT_STRENGTH_EXERCISES]);
  const [setsByExercise, setSetsByExercise] = useState<Record<string, StrengthSetsByReps>>({});
  const [weekRpes, setWeekRpes] = useState<number[]>([...WEEK_RPES]);
  const [bodyWeightInput, setBodyWeightInput] = useState('');
  const [name, setName] = useState(`${t('Bloc force')} ${records.length + 1}`);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (weightUnit === entryUnit) return;
    setTargets(previous => Object.fromEntries(Object.entries(previous).map(([id, value]) => [id, convertWeightInput(value, entryUnit, weightUnit)])));
    setBodyWeightInput(value => convertWeightInput(value, entryUnit, weightUnit));
    setEntryUnit(weightUnit);
  }, [weightUnit, entryUnit]);
  const needsBodyWeight = exerciseIds.some(id => STRENGTH_EXERCISES.find(ex => ex.id === id)?.weighted);
  const preview = useMemo(() => {
    const selectedExercises = STRENGTH_EXERCISES.filter(ex => exerciseIds.includes(ex.id));
    const parsedTargets = Object.fromEntries(selectedExercises.map(ex => [ex.id, parseDecimalInput(targets[ex.id] ?? '')]));
    const parsedBodyWeight = parseDecimalInput(bodyWeightInput);
    if (selectedExercises.some(ex => !Number.isFinite(parsedTargets[ex.id]) || parsedTargets[ex.id] < (ex.weighted ? 0 : toDisplayWeight(ex.step, entryUnit))) || (needsBodyWeight && (!Number.isFinite(parsedBodyWeight) || parsedBodyWeight < toDisplayWeight(1, entryUnit)))) return undefined;
    try {
      return createStrengthBlock(Object.fromEntries(selectedExercises.map(ex => [ex.id, toStoredWeight(parsedTargets[ex.id], entryUnit)])), needsBodyWeight ? toStoredWeight(parsedBodyWeight, entryUnit) : 0, { exerciseIds, weekRpes, setsByExercise });
    } catch { return undefined; }
  }, [targets, bodyWeightInput, exerciseIds, weekRpes, setsByExercise, needsBodyWeight, entryUnit]);

  useEffect(() => {
    onPendingChange(dirty || saving);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || saving) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); onPendingChange(false); };
  }, [dirty, saving, onPendingChange]);

  const persist = async (next: StrengthBlock, title: string, existing?: Workout, successMessage = t("Bloc enregistré dans ton compte.")) => {
    setSaving(true); setError(''); setMessage('');
    try {
      const saved = await saveStrengthBlock(userId, title, next, existing);
      onSaved(saved); setSelected(saved); setBlock(next); setCreating(false); setDirty(false);
      setMessage(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Enregistrement impossible. Réessaie."));
    } finally { setSaving(false); }
  };

  const updatePrescription = (id: string, update: Partial<StrengthPrescription>) => {
    setBlock(previous => previous && ({ ...previous, exercises: previous.exercises.map(ex => ({
      ...ex, prescriptions: ex.prescriptions.map(row => row.id === id ? { ...row, ...update } : row),
    })) }));
    setDirty(true); setMessage('');
  };
  const exercise = block?.exercises.find(ex => ex.id === exerciseId) ?? block?.exercises[0];
  const weeks = block ? getStrengthWeeks(block) : [];
  const plannedRows = exercise ? planStrengthLoads(exercise, block?.bodyWeight ?? 0) : [];
  const completed = block?.exercises.reduce((sum, ex) => sum + ex.prescriptions.filter(row => row.performances.length > 0).length, 0) ?? 0;

  return <section className="force-page">
    <div className="force-heading">
      <div><p className="force-eyebrow">POWERLIFTING & STREETLIFTING</p><h2>{t("Force")}</h2><p>{t("Ton cycle. Tes exercices. Tes performances.")}</p></div>
      {!creating && <button className="btn btn-primary" disabled={dirty || saving} onClick={() => {
        setName(`${t('Bloc force')} ${records.length + 1}`); setTargets(emptyTargets()); setSetsByExercise({}); setCreating(true); setMessage(''); setError('');
      }}>{t("+ Nouveau bloc")}</button>}
    </div>
    {error && <p className="force-error" role="alert">{error}</p>}
    {message && <p className="force-success" role="status">{message}</p>}

    {creating ? <form className="force-panel" onSubmit={event => {
      event.preventDefault();
      try {
        if (!preview) return;
        const next = preview;
        setActiveWeek(1); setExerciseId(next.exercises[0].id);
        void persist(records.length ? next : { ...next, currentRank: 1 }, name.trim());
      } catch (err) { setError(err instanceof Error ? t(err.message) : t('Vérifie les informations saisies.')); }
    }}>
      <h3>{t("Préparer mon bloc")}</h3>
      <p>{t("Choisis la durée, le RPE de chaque semaine et tes exercices. Chaque semaine comprend du ×5 et du ×3.")}</p>
      <fieldset className="force-configuration" disabled={saving}>
      <label>{t("Nom du bloc")}<input value={name} onChange={event => setName(event.target.value)} required maxLength={100} /></label>
      <label className="force-duration">{t("Nombre de semaines")}<select value={weekRpes.length} onChange={event => {
        const count = Number(event.target.value);
        setWeekRpes(previous => Array.from({ length: count }, (_, index) => previous[index] ?? previous[previous.length - 1]));
      }}>{Array.from({ length: MAX_BLOCK_WEEKS }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
      <div className="force-rpe-planner">{weekRpes.map((rpe, index) => <label key={index}>{t("Semaine")} {index + 1}<select aria-label={`${t('Semaine')} ${index + 1} · RPE`} value={rpe} onChange={event => setWeekRpes(previous => previous.map((value, i) => i === index ? Number(event.target.value) : value))}>{[...RPE_TABLE].reverse().map(row => <option key={row.rpe} value={row.rpe}>RPE {n(row.rpe)}</option>)}</select></label>)}</div>
      <fieldset className="force-exercise-picker"><legend>{t("Exercices du bloc")}</legend>{STRENGTH_EXERCISES.map(ex => <label key={ex.id} className={exerciseIds.includes(ex.id) ? 'selected' : ''}><input type="checkbox" checked={exerciseIds.includes(ex.id)} onChange={event => setExerciseIds(previous => event.target.checked ? STRENGTH_EXERCISES.filter(item => previous.includes(item.id) || item.id === ex.id).map(item => item.id) : previous.filter(id => id !== ex.id))} /><span>{t(ex.name)}</span></label>)}</fieldset>
      {!exerciseIds.length && <p className="force-help">{t("Choisis au moins un exercice valide.")}</p>}
      {needsBodyWeight && <label className="force-bodyweight">{t("Poids du corps")} ({entryUnit})<input type="text" inputMode="decimal" pattern={decimalPattern} required value={bodyWeightInput} onChange={event => setBodyWeightInput(event.target.value)} />
        <small>{t("Utilisé pour calculer le lest des dips, tractions et muscle-ups.")}</small>
      </label>}
      <div className="force-targets">{STRENGTH_EXERCISES.filter(ex => exerciseIds.includes(ex.id)).map(ex => <div key={ex.id}>
        <strong>{t(ex.name)}</strong><label><span>{t("1RM visé ·")} {ex.weighted ? t("lest ajouté") : t("charge totale")} ({entryUnit})</span>
        <input type="text" inputMode="decimal" pattern={decimalPattern} required value={targets[ex.id]} onChange={event => setTargets({ ...targets, [ex.id]: event.target.value })} />
        <small>{t("Arrondi au plus proche :")} {weightText(ex.step, entryUnit)}</small></label>
        {([3, 5] as const).map(reps => <label key={reps}>{t(reps === 3 ? 'Séries en ×3' : 'Séries en ×5')}<select required aria-label={`${t('Nombre de séries')} · ${t(ex.name)} · ${reps} reps`} value={setsByExercise[ex.id]?.[reps] ?? DEFAULT_STRENGTH_SETS} onChange={event => {
          const sets = Number(event.target.value);
          setSetsByExercise(previous => ({ ...previous, [ex.id]: { ...previous[ex.id], [reps]: sets } }));
        }}>{Array.from({ length: MAX_STRENGTH_SETS }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>)}
      </div>)}</div>
      <p className="force-help">{t("Base : 3 séries. Chaque série supplémentaire réduit la charge calculée de 1 % avant arrondi (5 séries : −2 %). Le RPE reste une cible estimée ; ajuste selon ton ressenti. Avec 1 ou 2 séries, la charge reste identique. La réduction est réglable par exercice après création.")}</p>
      {needsBodyWeight && <p className="force-help">{t("Pour les dips, tractions et muscle-ups, le calcul porte sur le poids du corps + le lest. Les charges prévues correspondent uniquement au lest ajouté.")} ({t("minimum")} 0 {entryUnit})</p>}
      <p className="force-help">{t("Sans réduction de charge, les arrondis suivent le calcul d’origine, quel que soit le nombre de séries. Avec une réduction active, des semaines peuvent garder la même charge pour préserver cette réduction. Les charges restent modifiables.")}</p>
      {preview && <StrengthSummaryTable block={preview} caption={t("Aperçu des charges")} unit={entryUnit} />}
      </fieldset>
      <div className="force-buttons"><button type="submit" className="btn btn-primary" disabled={saving || !name.trim() || !preview}>{saving ? t("Enregistrement…") : t("Générer et enregistrer le bloc")}</button>
        {selected && <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setCreating(false)}>{t("Annuler")}</button>}</div>
    </form> : block && exercise && <>
      <div className="force-toolbar">
        <label>{t("Mes blocs")}<select value={selected?.id ?? ''} disabled={dirty || saving} onChange={event => {
          const record = records.find(item => item.id === event.target.value);
          setSelected(record); setBlock(record && getStrengthBlock(record)); setActiveWeek(1); setMessage(''); setError('');
        }}>{records.map(record => <option key={record.id} value={record.id}>{record.name}{hasCurrentChoice && record.id === currentRecord?.id ? ` · ${t("Bloc actuel")}` : ''}</option>)}</select></label>
        <div className="force-toolbar-actions">
          <span>{completed} / {block.exercises.reduce((sum, ex) => sum + ex.prescriptions.length, 0)} {t("objectifs renseignés")}</span>
          <button type="button" className="btn btn-secondary btn-small" disabled={dirty || saving || (hasCurrentChoice && selected?.id === currentRecord?.id)} onClick={() => {
            if (selected) void persist({ ...block, currentRank: nextCurrentStrengthRank(recordBlocks) }, selected.name, selected, t("Ce bloc s’ouvrira par défaut."));
          }}>{hasCurrentChoice && selected?.id === currentRecord?.id ? t("Bloc actuel") : t("Définir comme bloc actuel")}</button>
        </div>
      </div>
      <details key={selected?.id} className="force-panel force-block-summary" open>
        <summary>{t("Récapitulatif du bloc")}</summary>
        <StrengthSummaryTable block={block} caption={t("Charges prévues")} unit={weightUnit} />
      </details>
      <div className="force-exercise-tabs" aria-label={t("Exercices de force")}>{block.exercises.map(ex => <button key={ex.id} className={exercise.id === ex.id ? 'active' : ''} onClick={() => setExerciseId(ex.id)} aria-pressed={exercise.id === ex.id}>
        {t(ex.name)}<small>{t("1RM visé")} {weightText(ex.target, weightUnit)}</small>
      </button>)}</div>
      <div className="force-exercise-heading"><h3>{t(exercise.name)}</h3><span>{exercise.weighted ? t("Lest ajouté") : t("Charge totale")} {t("· pas de")} {weightText(exercise.step, weightUnit)}</span></div>
      {exercise.weighted && block.bodyWeight === undefined && <p className="force-error" role="status">{t("Ce bloc utilise encore l’ancien calcul. Renseigne ton poids du corps puis recalcule les charges.")}</p>}
      <StrengthLoadEditor key={`${selected?.id}-${exercise.id}-${exercise.target}-${block.bodyWeight}-${exercise.setReductionPercent}`} exercise={exercise} bodyWeight={block.bodyWeight} saving={saving} onApply={(target, bodyWeight, reductionPercent) => {
        try {
          setBlock(previous => previous && updateStrengthLoads(previous, exercise.id, target, bodyWeight, reductionPercent));
          setDirty(true); setMessage(''); setError('');
        } catch (err) { setError(err instanceof Error ? t(err.message) : t('Vérifie les informations saisies.')); }
      }} />
      <fieldset className="force-editor" disabled={saving}>
        <div className="force-week-tabs" aria-label={t("Semaine du bloc")}>{weeks.map(week => <button type="button" key={week} aria-pressed={activeWeek === week} onClick={() => setActiveWeek(week)}>{t("Sem.")} {week}</button>)}</div>
        <div className="force-weeks">{weeks.map(week => <section className="force-week" data-active={activeWeek === week} key={week}>
          <header><h4>{t("Semaine")} {week}</h4><span>RPE {n(exercise.prescriptions.find(row => row.week === week)?.rpe ?? 0)}</span></header>
          {exercise.prescriptions.filter(row => row.week === week).map(row => <div className="force-prescription" key={row.id}>
            <div className="force-prescription-heading"><strong>{row.sets ?? DEFAULT_STRENGTH_SETS} × {row.reps} reps</strong><small>{n(Number((RPE_TABLE.find(r => r.rpe === row.rpe)!.percentages[row.reps - 1] * strengthVolumeFactor(row.sets, exercise.setReductionPercent)).toFixed(2)))} {t("% du 1RM")}</small></div>
            <label>{t("Nombre de séries")}<select aria-label={`${t('Nombre de séries')} · ${t(exercise.name)} · ${t('Semaine')} ${row.week} · ${row.reps} reps`} value={row.sets ?? DEFAULT_STRENGTH_SETS} onChange={event => {
              const sets = Number(event.target.value);
              setBlock(previous => previous && updateStrengthSets(previous, exercise.id, row.id, sets));
              setDirty(true); setMessage('');
            }}>{Array.from({ length: MAX_STRENGTH_SETS }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>
            <small className="force-volume-help">{t("Charge recalculée automatiquement. Base : 3 séries ; réduction par série supplémentaire :")} {n(exercise.setReductionPercent ?? DEFAULT_SET_REDUCTION_PERCENT)} %. {t("Estimation à ajuster selon le RPE ressenti.")}</small>
            <label>{t("Charge prévue")} ({weightUnit})<input key={`${row.weight}-${weightUnit}`} aria-label={`${t("Charge prévue")} ${t(exercise.name)} ${t("semaine")} ${row.week}, ${row.reps} reps (${weightUnit})`} type="text" inputMode="decimal" pattern={decimalPattern} defaultValue={toDisplayWeight(row.weight, weightUnit)} onBlur={event => {
              const parsed = parseDecimalInput(event.target.value);
              if (Number.isFinite(parsed) && parsed >= 0) {
                if (parsed !== toDisplayWeight(row.weight, weightUnit)) updatePrescription(row.id, { weight: toStoredWeight(parsed, weightUnit) });
                event.target.value = String(parsed);
              } else {
                event.target.value = String(toDisplayWeight(row.weight, weightUnit));
              }
            }} /></label>
            {row.weight !== plannedRows.find(planned => planned.id === row.id)?.weight && <button className="force-link" onClick={() => {
              updatePrescription(row.id, { weight: plannedRows.find(planned => planned.id === row.id)!.weight });
            }}>{t("Rétablir le calcul RPE")}</button>}
            <p className="force-help">{row.performances.length} / {row.sets ?? DEFAULT_STRENGTH_SETS} {t("séries enregistrées")}</p>
            {row.performances.map((perf, perfIndex) => <div className="force-result" key={perfIndex}>
              <strong>{weightText(perf.weight, weightUnit)} × {perf.reps} · RPE {n(perf.rpe)}</strong>
              <small>{new Date(perf.date).toLocaleDateString(locale())}{perf.note && ` · ${perf.note}`}</small>
              <button className="force-link" onClick={() => {
                if (confirm(t("Retirer cette performance du bloc ?"))) updatePrescription(row.id, { performances: row.performances.filter((_, i) => i !== perfIndex) });
              }}>{t("Retirer")}</button>
            </div>)}
            <PerformanceForm key={`${row.id}-${row.weight}`} prescription={row} onAdd={performance => updatePrescription(row.id, { performances: [...row.performances, performance] })} />
          </div>)}
        </section>)}</div>
      </fieldset>
      {(dirty || saving) && <div className="force-save"><span>{t("Modifications à enregistrer")}<small>{t("La date des performances est ajoutée automatiquement.")}</small></span><button className="btn btn-primary" disabled={saving} onClick={() => void persist(block, selected!.name, selected)}>{saving ? t("Enregistrement…") : t("Enregistrer le bloc")}</button></div>}
      {dirty && <p className="force-help">{t("Enregistre le bloc avant de quitter cette page ou de changer de bloc.")}</p>}
    </>}

    <details className="force-panel force-rpe" open>
      <summary>{t("Tableau RPE · % du 1RM")}</summary>
      <p>{t("Référence fournie pour les calculs. Les colonnes correspondent au nombre de répétitions.")}</p>
      <div className="force-table-scroll"><table><caption>{t("Pourcentage du 1RM selon le RPE et les répétitions")}</caption><thead><tr><th scope="col">RPE / Reps</th>{Array.from({ length: 12 }, (_, i) => <th scope="col" key={i}>{i + 1}</th>)}</tr></thead>
        <tbody>{RPE_TABLE.map(row => <tr key={row.rpe}><th scope="row">{n(row.rpe)}</th>{row.percentages.map((percentage, i) => <td key={i} style={{ backgroundColor: `hsl(${(100 - percentage) * 2.7} 65% 78%)` }}>{n(percentage)} %</td>)}</tr>)}</tbody>
      </table></div>
    </details>
  </section>;
}
