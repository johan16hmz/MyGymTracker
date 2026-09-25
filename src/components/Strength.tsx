import { t, useLanguage, locale } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import type { Workout } from '../types';
import { createStrengthBlock, DEFAULT_STRENGTH_EXERCISES, getStrengthWeeks, MAX_BLOCK_WEEKS, planStrengthLoads, RPE_TABLE, STRENGTH_EXERCISES, updateStrengthLoads, WEEK_RPES } from '../strength';
import type { StrengthBlock, StrengthExercise, StrengthExerciseId, StrengthPrescription, StrengthPerformance } from '../strength';
import { getStrengthBlock, saveStrengthBlock } from '../strengthService';

interface Props {
  userId: string;
  workouts: Workout[];
  onSaved: (workout: Workout) => void;
  onPendingChange: (pending: boolean) => void;
}

const n = (value: number) => value.toLocaleString(locale());

function PerformanceForm({ prescription, step, onAdd }: {
  prescription: StrengthPrescription;
  step: number;
  onAdd: (performance: StrengthPerformance) => void;
}) {
  useLanguage();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="btn btn-secondary btn-small" onClick={() => setOpen(!open)}>
      {open ? t("Annuler la saisie") : t("+ Enregistrer une série")}
    </button>
    {open && <form className="force-performance" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      onAdd({ weight: Number(values.get('weight')), reps: Number(values.get('reps')), rpe: Number(values.get('rpe')), note: String(values.get('note')), date: new Date().toISOString() });
      setOpen(false);
    }}>
      <label>{t("Poids réalisé (kg)")}<input name="weight" type="number" min="0" step={step} defaultValue={prescription.weight} required /></label>
      <label>{t("Reps réalisées")}<input name="reps" type="number" min="1" step="1" defaultValue={prescription.reps} required /></label>
      <label>{t("RPE ressenti")}<input name="rpe" type="number" min="1" max="10" step="0.5" defaultValue={prescription.rpe} required /></label>
      <label className="force-note">Note<input name="note" placeholder={t("Ex. : dur, propre, marge…")} maxLength={500} /></label>
      <button className="btn btn-primary" type="submit">{t("Ajouter au bloc")}</button>
    </form>}
  </>;
}

function StrengthLoadEditor({ exercise, bodyWeight, saving, onApply }: {
  exercise: StrengthExercise;
  bodyWeight?: number;
  saving: boolean;
  onApply: (target: number, bodyWeight?: number) => void;
}) {
  useLanguage();
  const [target, setTarget] = useState(String(exercise.target));
  const [bodyWeightInput, setBodyWeightInput] = useState(bodyWeight === undefined ? '' : String(bodyWeight));
  const recalculated = planStrengthLoads(exercise, bodyWeight ?? 0);
  const changed = Number(target) !== exercise.target || (exercise.weighted && Number(bodyWeightInput) !== bodyWeight) || recalculated.some((row, index) => row.weight !== exercise.prescriptions[index].weight);
  return <form className="force-load-editor" onSubmit={event => {
    event.preventDefault();
    if (!changed) return;
    onApply(Number(target), exercise.weighted ? Number(bodyWeightInput) : undefined);
  }}>
    <label>{t("1RM visé")} ({exercise.weighted ? t("lest ajouté") : t("charge totale")}, kg)
      <input type="number" min={exercise.weighted ? 0 : exercise.step} step="any" required disabled={saving} value={target} onChange={event => setTarget(event.target.value)} />
    </label>
    {exercise.weighted && <label>{t("Poids du corps (kg)")}
      <input type="number" min="1" step="any" required disabled={saving} value={bodyWeightInput} onChange={event => setBodyWeightInput(event.target.value)} />
    </label>}
    <button className="btn btn-secondary btn-small" type="submit" disabled={!changed || saving}>{t("Recalculer les charges")}</button>
    <small>{exercise.weighted ? t("Le poids du corps est commun aux dips, tractions et muscle-ups. Les charges prévues sont recalculées ; les performances enregistrées restent intactes.") : t("Les charges prévues de cet exercice sont recalculées ; les performances enregistrées restent intactes.")}</small>
  </form>;
}

export function Strength({ userId, workouts, onSaved, onPendingChange }: Props) {
  useLanguage();
  const records = workouts.filter(workout => getStrengthBlock(workout));
  const [selected, setSelected] = useState<Workout | undefined>(records[0]);
  const [block, setBlock] = useState<StrengthBlock | undefined>(() => records[0] && getStrengthBlock(records[0]));
  const [creating, setCreating] = useState(!records.length);
  const [exerciseId, setExerciseId] = useState('pullup');
  const [activeWeek, setActiveWeek] = useState(1);
  const [targets, setTargets] = useState<Record<string, string>>(Object.fromEntries(STRENGTH_EXERCISES.map(ex => [ex.id, String(ex.target)])));
  const [exerciseIds, setExerciseIds] = useState<StrengthExerciseId[]>([...DEFAULT_STRENGTH_EXERCISES]);
  const [weekRpes, setWeekRpes] = useState<number[]>([...WEEK_RPES]);
  const [bodyWeightInput, setBodyWeightInput] = useState('');
  const [name, setName] = useState(`${t('Bloc force')} ${records.length + 1}`);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const needsBodyWeight = exerciseIds.some(id => STRENGTH_EXERCISES.find(ex => ex.id === id)?.weighted);
  const preview = useMemo(() => {
    if (exerciseIds.some(id => !targets[id]?.trim()) || (needsBodyWeight && !bodyWeightInput.trim())) return undefined;
    try {
      return createStrengthBlock(Object.fromEntries(Object.entries(targets).map(([key, value]) => [key, Number(value)])), Number(bodyWeightInput), { exerciseIds, weekRpes });
    } catch { return undefined; }
  }, [targets, bodyWeightInput, exerciseIds, weekRpes, needsBodyWeight]);

  useEffect(() => {
    onPendingChange(dirty || saving);
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || saving) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('beforeunload', warn); onPendingChange(false); };
  }, [dirty, saving, onPendingChange]);

  const persist = async (next: StrengthBlock, title: string, existing?: Workout) => {
    setSaving(true); setError(''); setMessage('');
    try {
      const saved = await saveStrengthBlock(userId, title, next, existing);
      onSaved(saved); setSelected(saved); setBlock(next); setCreating(false); setDirty(false);
      setMessage(t("Bloc enregistré dans ton compte."));
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
        setName(`${t('Bloc force')} ${records.length + 1}`); setCreating(true); setMessage(''); setError('');
      }}>{t("+ Nouveau bloc")}</button>}
    </div>
    {error && <p className="force-error" role="alert">{error}</p>}
    {message && <p className="force-success" role="status">{message}</p>}

    {creating ? <form className="force-panel" onSubmit={event => {
      event.preventDefault();
      try {
        const next = createStrengthBlock(Object.fromEntries(Object.entries(targets).map(([key, value]) => [key, Number(value)])), Number(bodyWeightInput), { exerciseIds, weekRpes });
        setActiveWeek(1); setExerciseId(next.exercises[0].id);
        void persist(next, name.trim());
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
      {needsBodyWeight && <label className="force-bodyweight">{t("Poids du corps (kg)")}<input type="number" min="1" step="any" required value={bodyWeightInput} onChange={event => setBodyWeightInput(event.target.value)} />
        <small>{t("Utilisé pour calculer le lest des dips, tractions et muscle-ups.")}</small>
      </label>}
      <div className="force-targets">{STRENGTH_EXERCISES.filter(ex => exerciseIds.includes(ex.id)).map(ex => <label key={ex.id}>
        <strong>{t(ex.name)}</strong><span>{t("1RM visé ·")} {ex.weighted ? t("lest ajouté") : t("charge totale")} (kg)</span>
        <input type="number" min={ex.weighted ? 0 : ex.step} step="any" required value={targets[ex.id]} onChange={event => setTargets({ ...targets, [ex.id]: event.target.value })} />
        <small>{t("Arrondi au plus proche :")} {n(ex.step)} kg</small>
      </label>)}</div>
      {needsBodyWeight && <p className="force-help">{t("Pour les dips, tractions et muscle-ups, le calcul porte sur le poids du corps + le lest. Les charges affichées correspondent uniquement au lest ajouté (minimum 0 kg).")}</p>}
      <p className="force-help">{t("Si deux semaines consécutives donnent la même charge en ×3 ou en ×5, l’arrondi est ajusté d’un pas (+ ou −). Les charges restent modifiables.")}</p>
      {preview && <div className="force-table-scroll force-preview"><table><caption>{t("Aperçu des charges (kg)")}</caption><thead><tr><th scope="col">{t("Exercice")}</th>{weekRpes.map((rpe, index) => <th key={index} scope="col">{t("Sem.")} {index + 1}<small>RPE {n(rpe)}</small></th>)}</tr></thead><tbody>{preview.exercises.flatMap(ex => [5, 3].map(reps => <tr key={`${ex.id}-${reps}`}><th scope="row">{t(ex.name)} ×{reps}</th>{ex.prescriptions.filter(row => row.reps === reps).map(row => <td key={row.week}>{n(row.weight)}</td>)}</tr>))}</tbody></table></div>}
      </fieldset>
      <div className="force-buttons"><button type="submit" className="btn btn-primary" disabled={saving || !name.trim() || !preview}>{saving ? t("Enregistrement…") : t("Générer et enregistrer le bloc")}</button>
        {selected && <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setCreating(false)}>{t("Annuler")}</button>}</div>
    </form> : block && exercise && <>
      <div className="force-toolbar">
        <label>{t("Mes blocs")}<select value={selected?.id ?? ''} disabled={dirty || saving} onChange={event => {
          const record = records.find(item => item.id === event.target.value);
          setSelected(record); setBlock(record && getStrengthBlock(record)); setActiveWeek(1); setMessage(''); setError('');
        }}>{records.map(record => <option key={record.id} value={record.id}>{record.name}</option>)}</select></label>
        <span>{completed} / {block.exercises.reduce((sum, ex) => sum + ex.prescriptions.length, 0)} {t("objectifs renseignés")}</span>
      </div>
      <div className="force-exercise-tabs" aria-label={t("Exercices de force")}>{block.exercises.map(ex => <button key={ex.id} className={exercise.id === ex.id ? 'active' : ''} onClick={() => setExerciseId(ex.id)} aria-pressed={exercise.id === ex.id}>
        {t(ex.name)}<small>{t("1RM visé")} {n(ex.target)} kg</small>
      </button>)}</div>
      <div className="force-exercise-heading"><h3>{t(exercise.name)}</h3><span>{exercise.weighted ? t("Lest ajouté") : t("Charge totale")} {t("· pas de")} {n(exercise.step)} kg</span></div>
      {exercise.weighted && block.bodyWeight === undefined && <p className="force-error" role="status">{t("Ce bloc utilise encore l’ancien calcul. Renseigne ton poids du corps puis recalcule les charges.")}</p>}
      <StrengthLoadEditor key={`${selected?.id}-${exercise.id}-${exercise.target}-${block.bodyWeight}`} exercise={exercise} bodyWeight={block.bodyWeight} saving={saving} onApply={(target, bodyWeight) => {
        try {
          setBlock(updateStrengthLoads(block, exercise.id, target, bodyWeight));
          setDirty(true); setMessage(''); setError('');
        } catch (err) { setError(err instanceof Error ? t(err.message) : t('Vérifie les informations saisies.')); }
      }} />
      <fieldset className="force-editor" disabled={saving}>
        <div className="force-week-tabs" aria-label={t("Semaine du bloc")}>{weeks.map(week => <button type="button" key={week} aria-pressed={activeWeek === week} onClick={() => setActiveWeek(week)}>{t("Sem.")} {week}</button>)}</div>
        <div className="force-weeks">{weeks.map(week => <section className="force-week" data-active={activeWeek === week} key={week}>
          <header><h4>{t("Semaine")} {week}</h4><span>RPE {n(exercise.prescriptions.find(row => row.week === week)?.rpe ?? 0)}</span></header>
          {exercise.prescriptions.filter(row => row.week === week).map(row => <div className="force-prescription" key={row.id}>
            <div className="force-prescription-heading"><strong>× {row.reps} reps</strong><small>{n(RPE_TABLE.find(r => r.rpe === row.rpe)!.percentages[row.reps - 1])} {t("% du 1RM")}</small></div>
            <label>{t("Charge prévue (kg)")}<input key={row.weight} aria-label={`Charge prévue ${exercise.name} semaine ${row.week}, ${row.reps} reps`} type="number" min="0" step={exercise.step} defaultValue={row.weight} onBlur={event => {
              if (event.target.value !== '' && event.target.validity.valid) {
                if (Number(event.target.value) !== row.weight) updatePrescription(row.id, { weight: Number(event.target.value) });
              } else {
                event.target.value = String(row.weight);
              }
            }} /></label>
            {row.weight !== plannedRows.find(planned => planned.id === row.id)?.weight && <button className="force-link" onClick={() => {
              updatePrescription(row.id, { weight: plannedRows.find(planned => planned.id === row.id)!.weight });
            }}>{t("Rétablir le calcul RPE")}</button>}
            {row.performances.map((perf, perfIndex) => <div className="force-result" key={perfIndex}>
              <strong>{n(perf.weight)} kg × {perf.reps} · RPE {n(perf.rpe)}</strong>
              <small>{new Date(perf.date).toLocaleDateString(locale())}{perf.note && ` · ${perf.note}`}</small>
              <button className="force-link" onClick={() => {
                if (confirm(t("Retirer cette performance du bloc ?"))) updatePrescription(row.id, { performances: row.performances.filter((_, i) => i !== perfIndex) });
              }}>{t("Retirer")}</button>
            </div>)}
            <PerformanceForm prescription={row} step={exercise.step} onAdd={performance => updatePrescription(row.id, { performances: [...row.performances, performance] })} />
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
